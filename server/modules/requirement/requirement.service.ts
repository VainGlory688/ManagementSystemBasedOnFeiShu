import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import {
  versionRequirement,
  subRequirementItem,
  mainVersionManage,
} from '@server/database/schema';
import {
  RequirementListResponse,
  VersionRequirement,
  SubRequirementListResponse,
  CreateRequirementDto,
  UpdateRequirementDto,
  RequirementPipelineConfig,
  RequirementPipelineEdge,
  UpdateRequirementPipelineDto,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';

interface ListQuery {
  page: number;
  pageSize: number;
  businessLine?: string;
  priority?: string;
  reqType?: string;
  planningVersion?: string;
  currentOwner?: string;
  keyword?: string;
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

function parsePipeline(value: unknown): RequirementPipelineConfig {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { edges?: unknown }).edges)) {
    return { edges: [] };
  }

  const seen = new Set<string>();
  const edges: RequirementPipelineEdge[] = [];
  for (const edge of (value as { edges: unknown[] }).edges) {
    if (
      !edge ||
      typeof edge !== 'object' ||
      typeof (edge as { source?: unknown }).source !== 'string' ||
      typeof (edge as { target?: unknown }).target !== 'string'
    ) {
      continue;
    }
    const { source, target } = edge as RequirementPipelineEdge;
    if (!source || !target || source === target || seen.has(`${source}:${target}`)) continue;
    seen.add(`${source}:${target}`);
    edges.push({ source, target });
  }
  return { edges };
}

function hasCycle(edges: RequirementPipelineEdge[]): boolean {
  const neighbors = new Map<string, string[]>();
  for (const { source, target } of edges) {
    neighbors.set(source, [...(neighbors.get(source) || []), target]);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    if ((neighbors.get(node) || []).some(visit)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };

  return [...neighbors.keys()].some(visit);
}

@Injectable()
export class RequirementService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(query: ListQuery): Promise<RequirementListResponse> {
    const { page, pageSize, businessLine, priority, reqType, planningVersion, currentOwner, keyword } = query;
    const conditions = [];
    if (businessLine) conditions.push(eq(versionRequirement.businessLine, businessLine));
    if (priority) conditions.push(eq(versionRequirement.priority, priority));
    if (reqType) conditions.push(eq(versionRequirement.reqType, reqType));
    if (planningVersion) conditions.push(eq(versionRequirement.planningVersion, planningVersion));
    if (currentOwner) conditions.push(sql`(${versionRequirement.currentOwner}).user_id = ${currentOwner}`);
    if (keyword) conditions.push(ilike(versionRequirement.appReqName, `%${keyword}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(versionRequirement)
        .where(where)
        .orderBy(desc(versionRequirement.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(versionRequirement).where(where),
    ]);

    const versionIds = itemsRes
      .map((r) => r.planningVersion)
      .filter((v): v is string => Boolean(v));
    const localVersionIds = versionIds.filter(isValidUuid);
    const versions = versionIds.length > 0
      ? await this.db
          .select({ baseRecordId: mainVersionManage.baseRecordId, versionName: mainVersionManage.versionName, id: mainVersionManage.id })
          .from(mainVersionManage)
          .where(
            localVersionIds.length > 0
              ? or(
                  inArray(mainVersionManage.baseRecordId, versionIds),
                  inArray(mainVersionManage.id, localVersionIds),
                )
              : inArray(mainVersionManage.baseRecordId, versionIds),
          )
      : [];
    const versionMap = new Map<string, (typeof versions)[number]>();
    for (const version of versions) {
      versionMap.set(version.id, version);
      if (version.baseRecordId) {
        versionMap.set(version.baseRecordId, version);
      }
    }

    return {
      items: itemsRes.map((r) => {
        const v = r.planningVersion ? versionMap.get(r.planningVersion) : undefined;
        return {
          id: r.id,
          baseRecordId: r.baseRecordId || '',
          appReqName: r.appReqName || '',
          currentOwner: r.currentOwner || '',
          priority: r.priority || '',
          appStatus: '',
          reqType: r.reqType || '',
          businessLine: r.businessLine || '',
          planningVersion: r.planningVersion || '',
          planningVersionName: v?.versionName || '',
          planningVersionId: v?.id,
          proposalTime: r.proposalTime?.toString() || '',
          estimatedCompletionTime: r.estimatedCompletionTime?.toString() || '',
          creator: r.creator || '',
          description: r.description || '',
        };
      }),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getDetail(id: string): Promise<VersionRequirement> {
    const result = await this.db
      .select()
      .from(versionRequirement)
      .where(
        isValidUuid(id)
          ? or(eq(versionRequirement.id, id), eq(versionRequirement.baseRecordId, id))
          : eq(versionRequirement.baseRecordId, id),
      )
      .limit(1);
    if (result.length === 0) {
      throw new NotFoundException('需求不存在');
    }
    const r = result[0];
    const version = r.planningVersion
      ? await this.db
          .select({ versionName: mainVersionManage.versionName, id: mainVersionManage.id })
          .from(mainVersionManage)
          .where(
            isValidUuid(r.planningVersion)
              ? or(
                  eq(mainVersionManage.id, r.planningVersion),
                  eq(mainVersionManage.baseRecordId, r.planningVersion),
                )
              : eq(mainVersionManage.baseRecordId, r.planningVersion),
          )
          .limit(1)
      : [];
    return {
      id: r.id,
      baseRecordId: r.baseRecordId || '',
      appReqName: r.appReqName || '',
      currentOwner: r.currentOwner || '',
      priority: r.priority || '',
      appStatus: '',
      reqType: r.reqType || '',
      businessLine: r.businessLine || '',
      planningVersion: r.planningVersion || '',
      planningVersionName: version[0]?.versionName || '',
      planningVersionId: version[0]?.id,
      proposalTime: r.proposalTime?.toString() || '',
      estimatedCompletionTime: r.estimatedCompletionTime?.toString() || '',
      creator: r.creator || '',
      description: r.description || '',
      pipeline: parsePipeline(r.subRequirementItem),
    };
  }

  async updatePipeline(
    id: string,
    dto: UpdateRequirementPipelineDto,
    userId: string,
  ): Promise<RequirementPipelineConfig> {
    if (!Array.isArray(dto?.edges) || dto.edges.length > 500) {
      throw new BadRequestException('流水线连线格式无效');
    }

    const requirement = await this.getDetail(id);
    const parentRecordId = requirement.baseRecordId || requirement.id;
    const items = await this.db
      .select({
        id: subRequirementItem.id,
        baseRecordId: subRequirementItem.baseRecordId,
      })
      .from(subRequirementItem)
      .where(sql`${subRequirementItem.appParentWorkItem}::text LIKE '%' || ${parentRecordId} || '%'`);

    const stableIds = new Map<string, string>();
    for (const item of items) {
      const stableId = item.baseRecordId || item.id;
      stableIds.set(item.id, stableId);
      if (item.baseRecordId) stableIds.set(item.baseRecordId, stableId);
    }

    const seen = new Set<string>();
    const edges: RequirementPipelineEdge[] = dto.edges.map((edge) => {
      if (
        !edge ||
        typeof edge.source !== 'string' ||
        typeof edge.target !== 'string' ||
        !stableIds.has(edge.source) ||
        !stableIds.has(edge.target)
      ) {
        throw new BadRequestException('流水线只能关联当前需求下的子需求');
      }
      const source = stableIds.get(edge.source)!;
      const target = stableIds.get(edge.target)!;
      if (source === target) {
        throw new BadRequestException('子需求不能依赖自身');
      }
      if (seen.has(`${source}:${target}`)) {
        throw new BadRequestException('流水线包含重复连线');
      }
      seen.add(`${source}:${target}`);
      return { source, target };
    });

    if (hasCycle(edges)) {
      throw new BadRequestException('流水线不能产生循环依赖');
    }

    const config = { edges };
    const storedConfig = {
      link_record_ids: items.map((item) => item.baseRecordId || item.id),
      ...config,
    };
    const result = await this.db.execute(
      sql`UPDATE version_requirement
        SET sub_requirement_item = CAST(${JSON.stringify(storedConfig)} AS jsonb),
            _updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}
        WHERE ${isValidUuid(id) ? sql`id = ${id} OR base_record_id = ${id}` : sql`base_record_id = ${id}`}
        RETURNING id`,
    );
    if ((result as unknown as { id: string }[]).length === 0) {
      throw new NotFoundException('需求不存在');
    }

    return config;
  }

  async create(dto: CreateRequirementDto, userId: string): Promise<VersionRequirement> {
    const planningVersion = await this.resolvePlanningVersion(dto.planningVersion, userId);
    const result = await this.db.execute(
      sql`INSERT INTO version_requirement (
        app_req_name, current_owner, priority, req_type, business_line,
        planning_version, proposal_time, estimated_completion_time, creator, description,
        _created_by, _updated_by
      ) VALUES (
        ${dto.appReqName},
        ${dto.currentOwner ? sql`ROW(${dto.currentOwner})::user_profile` : null},
        ${dto.priority || null},
        ${dto.reqType || null},
        ${dto.businessLine || null},
        ${planningVersion},
        ${dto.proposalTime || null}::date,
        ${dto.estimatedCompletionTime || null}::date,
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${dto.description || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateRequirementDto, userId: string): Promise<VersionRequirement> {
    const setParts: any[] = [];
    const planningVersion =
      dto.planningVersion !== undefined
        ? await this.resolvePlanningVersion(dto.planningVersion, userId)
        : undefined;
    if (dto.appReqName !== undefined) setParts.push(sql`app_req_name = ${dto.appReqName}`);
    if (dto.currentOwner !== undefined) setParts.push(sql`current_owner = ${dto.currentOwner ? sql`ROW(${dto.currentOwner})::user_profile` : null}`);
    if (dto.priority !== undefined) setParts.push(sql`priority = ${dto.priority || null}`);
    if (dto.reqType !== undefined) setParts.push(sql`req_type = ${dto.reqType || null}`);
    if (dto.businessLine !== undefined) setParts.push(sql`business_line = ${dto.businessLine || null}`);
    if (planningVersion !== undefined) setParts.push(sql`planning_version = ${planningVersion}`);
    if (dto.proposalTime !== undefined) setParts.push(sql`proposal_time = ${dto.proposalTime || null}::date`);
    if (dto.estimatedCompletionTime !== undefined) setParts.push(sql`estimated_completion_time = ${dto.estimatedCompletionTime || null}::date`);
    if (dto.description !== undefined) setParts.push(sql`description = ${dto.description || null}`);

    if (setParts.length === 0) {
      return this.getDetail(id);
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);

    const result = await this.db.execute(
      sql`UPDATE version_requirement SET ${sql.join(setParts, sql`, `)} WHERE ${
        isValidUuid(id)
          ? sql`id = ${id} OR base_record_id = ${id}`
          : sql`base_record_id = ${id}`
      } RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (rows.length === 0) {
      throw new NotFoundException('需求不存在');
    }
    return this.getDetail(rows[0].id);
  }

  async delete(id: string): Promise<void> {
    const result = await this.db
      .delete(versionRequirement)
      .where(
        isValidUuid(id)
          ? or(eq(versionRequirement.id, id), eq(versionRequirement.baseRecordId, id))
          : eq(versionRequirement.baseRecordId, id),
      )
      .returning({ id: versionRequirement.id });
    if (result.length === 0) {
      throw new NotFoundException('需求不存在');
    }
  }

  private async resolvePlanningVersion(value?: string, userId?: string): Promise<string | null> {
    if (!value) return null;

    const versions = await this.db
      .select({
        id: mainVersionManage.id,
        baseRecordId: mainVersionManage.baseRecordId,
      })
      .from(mainVersionManage)
      .where(
        isValidUuid(value)
          ? or(
              eq(mainVersionManage.id, value),
              eq(mainVersionManage.baseRecordId, value),
            )
          : eq(mainVersionManage.baseRecordId, value),
      )
      .limit(1);

    const version = versions[0];
    if (!version) {
      throw new BadRequestException('计划版本不存在');
    }

    if (version.baseRecordId) {
      return version.baseRecordId;
    }

    // Legacy records created before base_record_id was initialized use their
    // local UUID as a stable relation key. The FK then has a valid target.
    await this.db
      .update(mainVersionManage)
      .set({
        baseRecordId: version.id,
        updatedBy: userId || null,
      })
      .where(eq(mainVersionManage.id, version.id));

    return version.id;
  }


  private mapRequirement(r: typeof versionRequirement.$inferSelect): VersionRequirement {
    return {
      id: r.id,
      baseRecordId: r.baseRecordId || '',
      appReqName: r.appReqName || '',
      currentOwner: r.currentOwner || '',
      priority: r.priority || '',
      appStatus: '',
      reqType: r.reqType || '',
      businessLine: r.businessLine || '',
      planningVersion: r.planningVersion || '',
      planningVersionName: '',
      planningVersionId: undefined,
      proposalTime: r.proposalTime?.toString() || '',
      estimatedCompletionTime: r.estimatedCompletionTime?.toString() || '',
      creator: r.creator || '',
      description: r.description || '',
      pipeline: parsePipeline(r.subRequirementItem),
    };
  }

  async getSubItems(requirementId: string, page: number, pageSize: number): Promise<SubRequirementListResponse> {
    const req = await this.getDetail(requirementId);
    // New records created outside Bitable have no baseRecordId until synchronization.
    // Use the local UUID in that case; never query with an empty identifier, which
    // would turn the LIKE pattern into '%%' and return every sub-requirement.
    const parentRecordId = req.baseRecordId || req.id;
    const where = sql`${subRequirementItem.appParentWorkItem}::text LIKE '%' || ${parentRecordId} || '%'`;

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
      items: itemsRes.map((s) => {
        const parentIds = extractParentRecordIds(s.appParentWorkItem);
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
          appParentWorkItemName: parentIds.length > 0
            ? nameMap.get(parentIds[0]) || undefined
            : undefined,
        };
      }),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }
}
