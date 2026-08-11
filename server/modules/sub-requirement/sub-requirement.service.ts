import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { subRequirementItem, versionRequirement } from '@server/database/schema';
import {
  SubRequirementListResponse,
  SubRequirementItem,
  CreateSubRequirementDto,
  UpdateSubRequirementDto,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';

interface ListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  appStatus?: string;
  appPriority?: string;
}

function extractParentRecordIds(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'object' && value !== null) {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.link_record_ids)) {
      return obj.link_record_ids.filter(
        (id): id is string => typeof id === 'string',
      );
    }
  }
  return [];
}

@Injectable()
export class SubRequirementService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(query: ListQuery): Promise<SubRequirementListResponse> {
    const { page, pageSize, keyword, appStatus, appPriority } = query;
    const conditions = [];
    if (appStatus) conditions.push(eq(subRequirementItem.appStatus, appStatus));
    if (appPriority) conditions.push(eq(subRequirementItem.appPriority, appPriority));
    if (keyword) conditions.push(ilike(subRequirementItem.appSubRequirementName, `%${keyword}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(subRequirementItem)
        .where(where)
        .orderBy(desc(subRequirementItem.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(subRequirementItem).where(where),
    ]);

    // Collect all parent record IDs from app_parent_work_item
    const allParentIds: string[] = [];
    for (const item of itemsRes) {
      allParentIds.push(...extractParentRecordIds(item.appParentWorkItem));
    }

    let nameMap = new Map<string, string>();
    if (allParentIds.length > 0) {
      const reqs = await this.db
        .select({
          baseRecordId: versionRequirement.baseRecordId,
          appReqName: versionRequirement.appReqName,
        })
        .from(versionRequirement)
        .where(inArray(versionRequirement.baseRecordId, allParentIds));
      nameMap = new Map(
        reqs.map((r) => [r.baseRecordId, r.appReqName || '']),
      );
    }

    return {
      items: itemsRes.map(
        (s: typeof subRequirementItem.$inferSelect) => {
          const item = this.mapSubRequirement(s);
          const parentIds = extractParentRecordIds(
            s.appParentWorkItem,
          );
          if (parentIds.length > 0) {
            item.appParentWorkItemRecordId = parentIds[0];
            item.appParentWorkItemName =
              nameMap.get(parentIds[0]) || undefined;
          }
          return item;
        },
      ),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getDetail(id: string): Promise<SubRequirementItem> {
    const result = await this.db
      .select()
      .from(subRequirementItem)
      .where(
        isValidUuid(id)
          ? or(eq(subRequirementItem.id, id), eq(subRequirementItem.baseRecordId, id))
          : eq(subRequirementItem.baseRecordId, id),
      )
      .limit(1);
    if (result.length === 0) {
      throw new NotFoundException('子需求不存在');
    }
    const item = this.mapSubRequirement(result[0]);
    const parentIds = extractParentRecordIds(
      result[0].appParentWorkItem,
    );
    if (parentIds.length > 0) {
      item.appParentWorkItemRecordId = parentIds[0];
      const reqs = await this.db
        .select({ appReqName: versionRequirement.appReqName })
        .from(versionRequirement)
        .where(
          isValidUuid(parentIds[0])
            ? or(
                eq(versionRequirement.id, parentIds[0]),
                eq(versionRequirement.baseRecordId, parentIds[0]),
              )
            : eq(versionRequirement.baseRecordId, parentIds[0]),
        )
        .limit(1);
      if (reqs.length > 0) {
        item.appParentWorkItemName = reqs[0].appReqName || undefined;
      }
    }
    return item;
  }

  async create(dto: CreateSubRequirementDto, userId: string): Promise<SubRequirementItem> {
    const result = await this.db.execute(
      sql`INSERT INTO sub_requirement_item (
        app_sub_requirement_name, app_status, app_current_owner,
        app_expected_start_date, app_expected_end_date, app_overdue_days,
        app_priority, app_parent_work_item, app_details, _created_by, _updated_by
      ) VALUES (
        ${dto.appSubRequirementName},
        ${dto.appStatus || null},
        ${dto.appCurrentOwner ? sql`ROW(${dto.appCurrentOwner})::user_profile` : null},
        ${dto.appExpectedStartDate || null}::date,
        ${dto.appExpectedEndDate || null}::date,
        ${dto.appOverdueDays !== undefined ? String(dto.appOverdueDays) : null},
        ${dto.appPriority || null},
        ${dto.appParentWorkItem ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(${dto.appParentWorkItem}::text))` : null},
        ${dto.appDetails || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateSubRequirementDto, userId: string): Promise<SubRequirementItem> {
    const setParts: any[] = [];
    if (dto.appSubRequirementName !== undefined) setParts.push(sql`app_sub_requirement_name = ${dto.appSubRequirementName}`);
    if (dto.appStatus !== undefined) setParts.push(sql`app_status = ${dto.appStatus || null}`);
    if (dto.appCurrentOwner !== undefined) setParts.push(sql`app_current_owner = ${dto.appCurrentOwner ? sql`ROW(${dto.appCurrentOwner})::user_profile` : null}`);
    if (dto.appExpectedStartDate !== undefined) setParts.push(sql`app_expected_start_date = ${dto.appExpectedStartDate || null}::date`);
    if (dto.appExpectedEndDate !== undefined) setParts.push(sql`app_expected_end_date = ${dto.appExpectedEndDate || null}::date`);
    if (dto.appOverdueDays !== undefined) setParts.push(sql`app_overdue_days = ${String(dto.appOverdueDays)}`);
    if (dto.appPriority !== undefined) setParts.push(sql`app_priority = ${dto.appPriority || null}`);
    if (dto.appParentWorkItem !== undefined) setParts.push(sql`app_parent_work_item = ${dto.appParentWorkItem ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(${dto.appParentWorkItem}::text))` : null}`);
    if (dto.appDetails !== undefined) setParts.push(sql`app_details = ${dto.appDetails || null}`);

    if (setParts.length === 0) {
      return this.getDetail(id);
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);

    const result = await this.db.execute(
      sql`UPDATE sub_requirement_item SET ${sql.join(setParts, sql`, `)} WHERE ${
        isValidUuid(id)
          ? sql`id = ${id} OR base_record_id = ${id}`
          : sql`base_record_id = ${id}`
      } RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (rows.length === 0) {
      throw new NotFoundException('子需求不存在');
    }
    return this.getDetail(rows[0].id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(subRequirementItem)
      .where(
        isValidUuid(id)
          ? or(eq(subRequirementItem.id, id), eq(subRequirementItem.baseRecordId, id))
          : eq(subRequirementItem.baseRecordId, id),
      )
      .returning({ id: subRequirementItem.id });
    if (result.length === 0) {
      throw new NotFoundException('子需求不存在');
    }
  }

  private mapSubRequirement(s: typeof subRequirementItem.$inferSelect): SubRequirementItem {
    return {
      id: s.id,
      baseRecordId: s.baseRecordId || '',
      appSubRequirementName: s.appSubRequirementName || '',
      appStatus: s.appStatus || '',
      appCurrentOwner: s.appCurrentOwner || '',
      appExpectedStartDate: s.appExpectedStartDate?.toString() || '',
      appExpectedEndDate: s.appExpectedEndDate?.toString() || '',
      appOverdueDays: Number(s.appOverdueDays ?? 0),
      appPriority: s.appPriority || '',
      appDetails: s.appDetails || undefined,
      appParentWorkItemName: undefined,
    };
  }
}