import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  defectItem,
  mainVersionManage,
  versionRequirement,
} from '@server/database/schema';
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
  planningVersion?: string;
  currentOwner?: string;
  keyword?: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  '致命': 0,
  '严重': 1,
  '一般': 2,
  '提示': 3,
};

function requireName(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field}不能为空`);
  }
}

function validateRejectionReason(status: string | undefined, rejectionReason: string | undefined): void {
  if (status === '已驳回' && !rejectionReason?.trim()) {
    throw new BadRequestException('驳回缺陷时必须填写驳回原因');
  }
}

interface RelationCandidates {
  identifiers: string[];
  names: string[];
}

function extractRelationCandidates(value: unknown): RelationCandidates {
  const identifiers = new Set<string>();
  const names = new Set<string>();
  const add = (target: Set<string>, candidate: unknown) => {
    if (typeof candidate === 'string' && candidate.trim()) {
      target.add(candidate.trim());
    }
  };
  const visit = (relation: unknown) => {
    if (typeof relation === 'string') {
      add(identifiers, relation);
      add(names, relation);
      return;
    }
    if (Array.isArray(relation)) {
      relation.forEach(visit);
      return;
    }
    if (!relation || typeof relation !== 'object') return;

    const item = relation as Record<string, unknown>;
    if (Array.isArray(item.link_record_ids)) {
      item.link_record_ids.forEach((id) => add(identifiers, id));
    }
    for (const key of ['id', 'baseRecordId', 'base_record_id', 'recordId', 'record_id']) {
      add(identifiers, item[key]);
    }
    for (const key of ['name', 'text', 'appReqName', 'title']) {
      add(names, item[key]);
    }
  };
  visit(value);
  return { identifiers: [...identifiers], names: [...names] };
}

@Injectable()
export class DefectService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(query: ListQuery): Promise<DefectListResponse> {
    const { page, pageSize, status, severity, priority, businessLine, discoveryEnvironment, testingStage, planningVersion, currentOwner, keyword } = query;
    const conditions = [];
    if (status) conditions.push(eq(defectItem.status, status));
    if (severity) conditions.push(eq(defectItem.severity, severity));
    if (priority) conditions.push(eq(defectItem.priority, priority));
    if (businessLine) conditions.push(eq(defectItem.businessLine, businessLine));
    if (discoveryEnvironment) conditions.push(eq(defectItem.discoveryEnvironment, discoveryEnvironment));
    if (testingStage) conditions.push(eq(defectItem.testingStage, testingStage));
    if (planningVersion) {
      const requirements = await this.db
        .select({
          id: versionRequirement.id,
          baseRecordId: versionRequirement.baseRecordId,
        })
        .from(versionRequirement)
        .where(eq(versionRequirement.planningVersion, planningVersion));
      const parentIds = [...new Set(
        requirements.flatMap((requirement) =>
          [requirement.id, requirement.baseRecordId].filter(
            (id): id is string => Boolean(id),
          ),
        ),
      )];
      if (parentIds.length === 0) {
        conditions.push(sql`FALSE`);
      } else {
        conditions.push(
          or(...parentIds.map((parentId) =>
            sql`${defectItem.appParentOrder} -> 'link_record_ids'
              @> jsonb_build_array(${parentId}::text)`,
          )),
        );
      }
    }
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
    await this.enrichRelations(items, itemsRes.map((item) => item.appParentOrder));
    items.sort((a, b) => {
      const sa = SEVERITY_ORDER[a.severity] ?? 99;
      const sb = SEVERITY_ORDER[b.severity] ?? 99;
      return sa - sb;
    });

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
    await this.enrichRelations([item], [result[0].appParentOrder]);
    return item;
  }

  async create(dto: CreateDefectDto, userId: string): Promise<DefectItem> {
    requireName(dto.defectName, '缺陷名称');
    validateRejectionReason(dto.status, dto.rejectionReason);
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
        ${dto.status === '已驳回' ? dto.rejectionReason || null : null},
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
    const defect = await this.getDetail(id);
    if (dto.defectName !== undefined) requireName(dto.defectName, '缺陷名称');
    const nextStatus = dto.status ?? defect.status;
    const nextRejectionReason = dto.rejectionReason ?? defect.rejectionReason;
    validateRejectionReason(nextStatus, nextRejectionReason);

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
    if (
      dto.status !== undefined
      && nextStatus !== '已驳回'
    ) {
      setParts.push(sql`rejection_reason = NULL`);
    } else if (dto.rejectionReason !== undefined) {
      setParts.push(sql`rejection_reason = ${dto.rejectionReason || null}`);
    }
    if (dto.discoveryEnvironment !== undefined) setParts.push(sql`discovery_environment = ${dto.discoveryEnvironment || null}`);
    if (dto.testingStage !== undefined) setParts.push(sql`testing_stage = ${dto.testingStage || null}`);
    if (dto.detail !== undefined) setParts.push(sql`detail = ${dto.detail || null}`);
    if (dto.appParentOrder !== undefined) setParts.push(sql`app_parent_order = ${dto.appParentOrder ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(CAST(${dto.appParentOrder} AS text)))` : null}`);

    if (setParts.length === 0) {
      return defect;
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);
    setParts.push(sql`_updated_at = NOW()`);

    const result = await this.db.execute(
      sql`UPDATE defect_item SET ${sql.join(setParts, sql`, `)}
        WHERE id = ${defect.id}
          AND (
            ${dto.expectedUpdatedAt || null}::timestamptz IS NULL
            OR date_trunc('milliseconds', _updated_at)
              = date_trunc('milliseconds', ${dto.expectedUpdatedAt || null}::timestamptz)
          )
        RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (rows.length === 0) {
      throw new ConflictException('缺陷已被其他人修改，请刷新后重试');
    }
    return this.getDetail(rows[0].id);
  }

  async delete(id: string): Promise<void> {
    const defect = await this.getDetail(id);
    const result = await this.db
      .delete(defectItem)
      .where(eq(defectItem.id, defect.id))
      .returning({ id: defectItem.id });
    if (result.length === 0) {
      throw new NotFoundException('缺陷不存在');
    }
  }

  private mapDefect(d: typeof defectItem.$inferSelect, withDetail = false): DefectItem {
    const { identifiers } = extractRelationCandidates(d.appParentOrder);
    return {
      id: d.id,
      baseRecordId: d.baseRecordId || '',
      updatedAt: d.updatedAt.toISOString(),
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
      appParentOrderRecordId: identifiers[0],
      relatedVersionName: '',
      relatedTestPlanName: '',
    };
  }

  private async enrichRelations(
    defects: DefectItem[],
    parentRelations: unknown[],
  ): Promise<void> {
    const candidates = parentRelations.map(extractRelationCandidates);
    const identifiers = [...new Set(candidates.flatMap((item) => item.identifiers))];
    const names = [...new Set(candidates.flatMap((item) => item.names))];
    if (identifiers.length === 0 && names.length === 0) return;

    const localIds = identifiers.filter(isValidUuid);
    const requirementConditions = [
      identifiers.length > 0
        ? inArray(versionRequirement.baseRecordId, identifiers)
        : undefined,
      localIds.length > 0
        ? inArray(versionRequirement.id, localIds)
        : undefined,
      names.length > 0
        ? inArray(versionRequirement.appReqName, names)
        : undefined,
    ].filter((condition): condition is NonNullable<typeof condition> => Boolean(condition));
    const requirements = await this.db
      .select({
        id: versionRequirement.id,
        baseRecordId: versionRequirement.baseRecordId,
        appReqName: versionRequirement.appReqName,
        planningVersion: versionRequirement.planningVersion,
      })
      .from(versionRequirement)
      .where(or(...requirementConditions));

    const requirementsByIdentifier = new Map<string, (typeof requirements)[number]>();
    const requirementsByName = new Map<string, (typeof requirements)[number]>();
    const ambiguousNames = new Set<string>();
    for (const requirement of requirements) {
      requirementsByIdentifier.set(requirement.id, requirement);
      if (requirement.baseRecordId) {
        requirementsByIdentifier.set(requirement.baseRecordId, requirement);
      }
      const name = requirement.appReqName || '';
      if (name && requirementsByName.has(name)) {
        ambiguousNames.add(name);
      } else if (name) {
        requirementsByName.set(name, requirement);
      }
    }
    for (const name of ambiguousNames) requirementsByName.delete(name);

    const matchedRequirements = candidates.map((relation) => (
      relation.identifiers.map((id) => requirementsByIdentifier.get(id)).find(Boolean)
      || relation.names.map((name) => requirementsByName.get(name)).find(Boolean)
    ));
    const versionKeys = [...new Set(
      matchedRequirements
        .map((requirement) => requirement?.planningVersion)
        .filter((value): value is string => Boolean(value)),
    )];
    const localVersionIds = versionKeys.filter(isValidUuid);
    const versions = versionKeys.length === 0
      ? []
      : await this.db
          .select({
            id: mainVersionManage.id,
            baseRecordId: mainVersionManage.baseRecordId,
            versionName: mainVersionManage.versionName,
          })
          .from(mainVersionManage)
          .where(
            localVersionIds.length > 0
              ? or(
                  inArray(mainVersionManage.baseRecordId, versionKeys),
                  inArray(mainVersionManage.id, localVersionIds),
                )
              : inArray(mainVersionManage.baseRecordId, versionKeys),
          );
    const versionsByKey = new Map<string, (typeof versions)[number]>();
    for (const version of versions) {
      versionsByKey.set(version.id, version);
      if (version.baseRecordId) versionsByKey.set(version.baseRecordId, version);
    }

    defects.forEach((defect, index) => {
      const requirement = matchedRequirements[index];
      if (!requirement) {
        const fallbackName = candidates[index].names[0];
        defect.appParentOrderName = fallbackName || undefined;
        defect.appParentOrderRecordId = undefined;
        return;
      }
      defect.appParentOrderName = requirement.appReqName || undefined;
      // The client stores relation values by base record ID. Returning the
      // database UUID here prevents the edit form from matching its option.
      defect.appParentOrderRecordId = requirement.baseRecordId || requirement.id;
      const version = requirement.planningVersion
        ? versionsByKey.get(requirement.planningVersion)
        : undefined;
      defect.relatedVersionName = version?.versionName || '';
      defect.relatedVersionId = version?.id;
    });
  }
}
