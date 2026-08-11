import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { defectItem, versionRequirement } from '@server/database/schema';
import {
  DefectListResponse,
  DefectItem,
  CreateDefectDto,
  UpdateDefectDto,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';

interface ListQuery {
  page: number;
  pageSize: number;
  status?: string;
  severity?: string;
  priority?: string;
  businessLine?: string;
  discoveryEnvironment?: string;
  testingStage?: string;
  currentOwner?: string;
  keyword?: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  '致命': 0,
  '严重': 1,
  '一般': 2,
  '提示': 3,
};

@Injectable()
export class DefectService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(query: ListQuery): Promise<DefectListResponse> {
    const { page, pageSize, status, severity, priority, businessLine, discoveryEnvironment, testingStage, currentOwner, keyword } = query;
    const conditions = [];
    if (status) conditions.push(eq(defectItem.status, status));
    if (severity) conditions.push(eq(defectItem.severity, severity));
    if (priority) conditions.push(eq(defectItem.priority, priority));
    if (businessLine) conditions.push(eq(defectItem.businessLine, businessLine));
    if (discoveryEnvironment) conditions.push(eq(defectItem.discoveryEnvironment, discoveryEnvironment));
    if (testingStage) conditions.push(eq(defectItem.testingStage, testingStage));
    if (currentOwner) conditions.push(sql`${currentOwner} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${defectItem.currentOwner}) u))`);
    if (keyword) conditions.push(ilike(defectItem.defectName, `%${keyword}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(defectItem)
        .where(where)
        .orderBy(desc(defectItem.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(defectItem).where(where),
    ]);

    const items = itemsRes.map((d) => this.mapDefect(d));
    items.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 99;
      const sb = SEVERITY_ORDER[b.severity] ?? 99;
      return sa - sb;
    });

    // Resolve parent order names from version_requirement
    const parentOrderIds = items
      .map((d: DefectItem) => d.appParentOrderRecordId)
      .filter((id): id is string => Boolean(id));
    if (parentOrderIds.length > 0) {
      const localParentOrderIds = parentOrderIds.filter(isValidUuid);
      const reqs = await this.db
        .select({
          id: versionRequirement.id,
          baseRecordId: versionRequirement.baseRecordId,
          appReqName: versionRequirement.appReqName,
        })
        .from(versionRequirement)
        .where(
          localParentOrderIds.length > 0
            ? or(
                inArray(versionRequirement.baseRecordId, parentOrderIds),
                inArray(versionRequirement.id, localParentOrderIds),
              )
            : inArray(versionRequirement.baseRecordId, parentOrderIds),
        );
      const nameMap = new Map<string, string>();
      for (const requirement of reqs) {
        nameMap.set(requirement.id, requirement.appReqName || '');
        if (requirement.baseRecordId) {
          nameMap.set(requirement.baseRecordId, requirement.appReqName || '');
        }
      }
      for (const item of items) {
        if (item.appParentOrderRecordId) {
          item.appParentOrderName = nameMap.get(
            item.appParentOrderRecordId,
          );
        }
      }
    }

    return {
      items,
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getDetail(id: string): Promise<DefectItem> {
    const result = await this.db
      .select()
      .from(defectItem)
      .where(
        isValidUuid(id)
          ? or(eq(defectItem.id, id), eq(defectItem.baseRecordId, id))
          : eq(defectItem.baseRecordId, id),
      )
      .limit(1);
    if (result.length === 0) {
      throw new NotFoundException('缺陷不存在');
    }
    const item = this.mapDefect(result[0], true);
    if (item.appParentOrderRecordId) {
      const reqs = await this.db
        .select({ appReqName: versionRequirement.appReqName })
        .from(versionRequirement)
        .where(
          isValidUuid(item.appParentOrderRecordId)
            ? or(
                eq(versionRequirement.id, item.appParentOrderRecordId),
                eq(versionRequirement.baseRecordId, item.appParentOrderRecordId),
              )
            : eq(versionRequirement.baseRecordId, item.appParentOrderRecordId),
        )
        .limit(1);
      if (reqs.length > 0) {
        item.appParentOrderName = reqs[0].appReqName || undefined;
      }
    }
    return item;
  }

  async create(dto: CreateDefectDto, userId: string): Promise<DefectItem> {
    const ownerProfiles = dto.currentOwner && dto.currentOwner.length > 0
      ? sql`ARRAY[${sql.join(dto.currentOwner.map((id: string) => sql`ROW(${id})::user_profile`), sql`, `)}]::user_profile[]`
      : null;
    const result = await this.db.execute(
      sql`INSERT INTO defect_item (
        defect_name, status, severity, priority, current_owner, business_line,
        rejection_reason, discovery_environment, testing_stage, creator, detail, app_parent_order,
        _created_by, _updated_by
      ) VALUES (
        ${dto.defectName},
        ${dto.status || null},
        ${dto.severity || null},
        ${dto.priority || null},
        ${ownerProfiles},
        ${dto.businessLine || null},
        ${dto.rejectionReason || null},
        ${dto.discoveryEnvironment || null},
        ${dto.testingStage || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${dto.detail || null},
        ${dto.appParentOrder ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(CAST(${dto.appParentOrder} AS text)))` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateDefectDto, userId: string): Promise<DefectItem> {
    const setParts: any[] = [];
    if (dto.defectName !== undefined) setParts.push(sql`defect_name = ${dto.defectName}`);
    if (dto.status !== undefined) setParts.push(sql`status = ${dto.status || null}`);
    if (dto.severity !== undefined) setParts.push(sql`severity = ${dto.severity || null}`);
    if (dto.priority !== undefined) setParts.push(sql`priority = ${dto.priority || null}`);
    if (dto.currentOwner !== undefined) {
      setParts.push(sql`current_owner = ${
        dto.currentOwner && dto.currentOwner.length > 0
          ? sql`ARRAY[${sql.join(dto.currentOwner.map((id: string) => sql`ROW(${id})::user_profile`), sql`, `)}]::user_profile[]`
          : null
      }`);
    }
    if (dto.businessLine !== undefined) setParts.push(sql`business_line = ${dto.businessLine || null}`);
    if (dto.rejectionReason !== undefined) setParts.push(sql`rejection_reason = ${dto.rejectionReason || null}`);
    if (dto.discoveryEnvironment !== undefined) setParts.push(sql`discovery_environment = ${dto.discoveryEnvironment || null}`);
    if (dto.testingStage !== undefined) setParts.push(sql`testing_stage = ${dto.testingStage || null}`);
    if (dto.detail !== undefined) setParts.push(sql`detail = ${dto.detail || null}`);
    if (dto.appParentOrder !== undefined) setParts.push(sql`app_parent_order = ${dto.appParentOrder ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(CAST(${dto.appParentOrder} AS text)))` : null}`);

    if (setParts.length === 0) {
      return this.getDetail(id);
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);

    const result = await this.db.execute(
      sql`UPDATE defect_item SET ${sql.join(setParts, sql`, `)} WHERE ${
        isValidUuid(id)
          ? sql`id = ${id} OR base_record_id = ${id}`
          : sql`base_record_id = ${id}`
      } RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (rows.length === 0) {
      throw new NotFoundException('缺陷不存在');
    }
    return this.getDetail(rows[0].id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(defectItem)
      .where(
        isValidUuid(id)
          ? or(eq(defectItem.id, id), eq(defectItem.baseRecordId, id))
          : eq(defectItem.baseRecordId, id),
      )
      .returning({ id: defectItem.id });
    if (result.length === 0) {
      throw new NotFoundException('缺陷不存在');
    }
  }

  private mapDefect(d: typeof defectItem.$inferSelect, withDetail = false): DefectItem {
    const parent = d.appParentOrder as any;
    const parentRecordId = Array.isArray(parent?.link_record_ids)
      ? parent.link_record_ids[0]
      : parent?.recordId;
    return {
      id: d.id,
      baseRecordId: d.baseRecordId || '',
      defectName: d.defectName || '',
      status: d.status || '',
      severity: d.severity || '',
      priority: d.priority || '',
      currentOwner: Array.isArray(d.currentOwner) ? d.currentOwner : [],
      businessLine: d.businessLine || '',
      rejectionReason: d.rejectionReason || undefined,
      discoveryEnvironment: d.discoveryEnvironment || '',
      testingStage: d.testingStage || '',
      creator: d.creator || '',
      createdAt: d.createdAt.toISOString(),
      detail: withDetail ? d.detail || '' : undefined,
      appParentOrderName: undefined,
      appParentOrderRecordId: parentRecordId || undefined,
      relatedVersionName: '',
      relatedTestPlanName: '',
    };
  }
}
