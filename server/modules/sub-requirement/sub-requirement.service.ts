import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm';
import { subRequirementItem, versionRequirement } from '@server/database/schema';
import {
  SubRequirementListResponse,
  SubRequirementItem,
  CreateSubRequirementDto,
  UpdateSubRequirementDto,
  RequirementPipelineEdge,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';
import {
  getIncompletePipelinePredecessorIds,
  isCompletedPipelineStatus,
} from '@shared/requirement-business-rules';

interface ListQuery {
  page: number;
  pageSize: number;
  keyword?: string;
  appStatus?: string;
  appPriority?: string;
}

type DatabaseExecutor = Pick<PostgresJsDatabase, 'select' | 'execute'>;

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

function calculateOverdueDays(
  expectedEndDate: Date | string | null,
  status: string | null,
): number {
  if (!expectedEndDate || status === '已完成') return 0;
  const dateText = expectedEndDate instanceof Date
    ? `${expectedEndDate.getFullYear()}-${String(expectedEndDate.getMonth() + 1).padStart(2, '0')}-${String(expectedEndDate.getDate()).padStart(2, '0')}`
    : String(expectedEndDate).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return 0;

  const dueDate = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.floor((today - dueDate) / 86_400_000));
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
    if (!dto.appSubRequirementName?.trim()) {
      throw new BadRequestException('子需求名称不能为空');
    }
    const parent = dto.appParentWorkItem
      ? await this.findParentRequirement(dto.appParentWorkItem)
      : undefined;
    const rows = await this.db.transaction(async (tx) => {
      const result = await tx.execute(
      sql`INSERT INTO sub_requirement_item (
        app_sub_requirement_name, app_status, app_current_owner,
        app_expected_start_date, app_expected_end_date,
        app_priority, app_parent_work_item, app_details, _created_by, _updated_by
      ) VALUES (
        ${dto.appSubRequirementName},
        ${dto.appStatus || null},
        ${dto.appCurrentOwner ? sql`ROW(${dto.appCurrentOwner})::user_profile` : null},
        ${dto.appExpectedStartDate || null}::date,
        ${dto.appExpectedEndDate || null}::date,
        ${dto.appPriority || null},
        ${parent ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(${parent.baseRecordId || parent.id}::text))` : sql`jsonb_build_object('link_record_ids', '[]'::jsonb)`},
        ${dto.appDetails || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
      );
      const createdRows = result as unknown as { id: string }[];
      if (parent) {
        await this.addToParentRequirement(
          parent.id,
          createdRows[0].id,
          userId,
          tx,
        );
      }
      return createdRows;
    });
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateSubRequirementDto, userId: string): Promise<SubRequirementItem> {
    const existing = await this.findSubRequirement(id);
    if (dto.appSubRequirementName !== undefined && !dto.appSubRequirementName.trim()) {
      throw new BadRequestException('子需求名称不能为空');
    }
    const currentParentIds = extractParentRecordIds(existing.appParentWorkItem);
    const nextParent = dto.appParentWorkItem === undefined || !dto.appParentWorkItem
      ? undefined
      : await this.findParentRequirement(dto.appParentWorkItem);
    if (
      dto.appStatus !== undefined
      && isCompletedPipelineStatus(dto.appStatus)
      && !isCompletedPipelineStatus(existing.appStatus)
    ) {
      await this.validateCompletionDependencies(
        existing,
        nextParent
          ? [nextParent.id, nextParent.baseRecordId].filter((value): value is string => Boolean(value))
          : currentParentIds,
      );
    }
    const setParts: any[] = [];
    if (dto.appSubRequirementName !== undefined) setParts.push(sql`app_sub_requirement_name = ${dto.appSubRequirementName}`);
    if (dto.appStatus !== undefined) setParts.push(sql`app_status = ${dto.appStatus || null}`);
    if (dto.appCurrentOwner !== undefined) setParts.push(sql`app_current_owner = ${dto.appCurrentOwner ? sql`ROW(${dto.appCurrentOwner})::user_profile` : null}`);
    if (dto.appExpectedStartDate !== undefined) setParts.push(sql`app_expected_start_date = ${dto.appExpectedStartDate || null}::date`);
    if (dto.appExpectedEndDate !== undefined) setParts.push(sql`app_expected_end_date = ${dto.appExpectedEndDate || null}::date`);
    if (dto.appPriority !== undefined) setParts.push(sql`app_priority = ${dto.appPriority || null}`);
    if (dto.appParentWorkItem !== undefined) {
      setParts.push(sql`app_parent_work_item = ${
        nextParent
          ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(${nextParent.baseRecordId || nextParent.id}::text))`
          : sql`jsonb_build_object('link_record_ids', '[]'::jsonb)`
      }`);
    }
    if (dto.appDetails !== undefined) setParts.push(sql`app_details = ${dto.appDetails || null}`);

    if (setParts.length === 0) {
      return this.getDetail(existing.id);
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);
    setParts.push(sql`_updated_at = now()`);

    await this.db.transaction(async (tx) => {
      const subRequirementRecordId = existing.baseRecordId || existing.id;
      if (dto.appParentWorkItem !== undefined && nextParent) {
        await this.addToParentRequirement(
          nextParent.id,
          subRequirementRecordId,
          userId,
          tx,
        );
      }
      const result = await tx.execute(
        sql`UPDATE sub_requirement_item SET ${sql.join(setParts, sql`, `)}
          WHERE id = ${existing.id}
            AND (
              ${dto.expectedUpdatedAt || null}::timestamptz IS NULL
              OR date_trunc('milliseconds', _updated_at)
                = date_trunc('milliseconds', ${dto.expectedUpdatedAt || null}::timestamptz)
            )
          RETURNING id`,
      );
      if ((result as unknown as { id: string }[]).length === 0) {
        throw new ConflictException('子需求已被其他人修改，请刷新后重试');
      }
      if (dto.appParentWorkItem !== undefined) {
        for (const parentId of currentParentIds) {
          const parent = await this.findParentRequirement(parentId, tx, false);
          if (parent && parent.id !== nextParent?.id) {
            await this.removeFromParentRequirement(
              parent.id,
              existing.id,
              subRequirementRecordId,
              userId,
              tx,
            );
          }
        }
      }
    });
    return this.getDetail(existing.id);
  }

  async delete(id: string, userId: string): Promise<void> {
    const item = await this.findSubRequirement(id);
    const subRequirementRecordId = item.baseRecordId || item.id;
    await this.db.transaction(async (tx) => {
      for (const parentId of extractParentRecordIds(item.appParentWorkItem)) {
        const parent = await this.findParentRequirement(parentId, tx, false);
        if (parent) {
          await this.removeFromParentRequirement(
            parent.id,
            item.id,
            subRequirementRecordId,
            userId,
            tx,
          );
        }
      }
      const result = await tx
        .delete(subRequirementItem)
        .where(eq(subRequirementItem.id, item.id))
        .returning({ id: subRequirementItem.id });
      if (result.length === 0) {
        throw new NotFoundException('子需求不存在');
      }
    });
  }

  private mapSubRequirement(s: typeof subRequirementItem.$inferSelect): SubRequirementItem {
    return {
      id: s.id,
      baseRecordId: s.baseRecordId || '',
      updatedAt: s.updatedAt.toISOString(),
      appSubRequirementName: s.appSubRequirementName || '',
      appStatus: s.appStatus || '',
      appCurrentOwner: s.appCurrentOwner || '',
      appExpectedStartDate: s.appExpectedStartDate?.toString() || '',
      appExpectedEndDate: s.appExpectedEndDate?.toString() || '',
      appOverdueDays: calculateOverdueDays(s.appExpectedEndDate, s.appStatus),
      appPriority: s.appPriority || '',
      appDetails: s.appDetails || undefined,
      appParentWorkItemName: undefined,
    };
  }

  private async findSubRequirement(id: string) {
    const items = await this.db
      .select()
      .from(subRequirementItem)
      .where(
        isValidUuid(id)
          ? or(eq(subRequirementItem.id, id), eq(subRequirementItem.baseRecordId, id))
          : eq(subRequirementItem.baseRecordId, id),
      )
      .limit(1);
    if (!items[0]) {
      throw new NotFoundException('子需求不存在');
    }
    return items[0];
  }

  private async findParentRequirement(
    parentId: string,
    db: DatabaseExecutor = this.db,
    required = true,
  ) {
    const parents = await db
      .select({
        id: versionRequirement.id,
        baseRecordId: versionRequirement.baseRecordId,
      })
      .from(versionRequirement)
      .where(
        isValidUuid(parentId)
          ? or(
              eq(versionRequirement.id, parentId),
              eq(versionRequirement.baseRecordId, parentId),
            )
          : eq(versionRequirement.baseRecordId, parentId),
      )
      .limit(1);
    if (!parents[0] && required) {
      throw new NotFoundException('父需求不存在');
    }
    return parents[0];
  }

  private async validateCompletionDependencies(
    item: typeof subRequirementItem.$inferSelect,
    parentRecordIds: string[],
  ): Promise<void> {
    if (parentRecordIds.length === 0) return;

    const parents = await this.db
      .select({
        id: versionRequirement.id,
        baseRecordId: versionRequirement.baseRecordId,
        subRequirementItem: versionRequirement.subRequirementItem,
      })
      .from(versionRequirement)
      .where(
        or(
          ...parentRecordIds.map((parentId) =>
            isValidUuid(parentId)
              ? or(
                  eq(versionRequirement.id, parentId),
                  eq(versionRequirement.baseRecordId, parentId),
                )
              : eq(versionRequirement.baseRecordId, parentId)),
        ),
      )
      .limit(1);
    const parent = parents[0];
    if (!parent) return;

    const stableParentIds = [parent.id, parent.baseRecordId].filter(
      (value): value is string => Boolean(value),
    );
    const siblings = await this.db
      .select({
        id: subRequirementItem.id,
        baseRecordId: subRequirementItem.baseRecordId,
        appStatus: subRequirementItem.appStatus,
        appSubRequirementName: subRequirementItem.appSubRequirementName,
      })
      .from(subRequirementItem)
      .where(
        or(
          ...stableParentIds.map((parentId) =>
            sql`${subRequirementItem.appParentWorkItem} -> 'link_record_ids'
              @> jsonb_build_array(${parentId}::text)`),
        ),
      );
    const stableId = item.baseRecordId || item.id;
    const statusById = new Map(
      siblings.map((sibling) => [sibling.baseRecordId || sibling.id, sibling]),
    );
    const edges = this.parsePipelineEdges(parent.subRequirementItem);
    const incompletePredecessorIds = getIncompletePipelinePredecessorIds(
      stableId,
      [...statusById.entries()].map(([id, sibling]) => ({ id, status: sibling.appStatus })),
      edges,
    );
    if (incompletePredecessorIds.length === 0) return;

    const incompletePredecessors = incompletePredecessorIds
      .map((predecessorId) => statusById.get(predecessorId)?.appSubRequirementName)
      .map((name) => name || '未命名前置子需求');
    throw new BadRequestException(
      `当前子需求存在未完成的前置子需求：${incompletePredecessors.join('、') || '请先完成前置子需求'}`,
    );
  }

  private parsePipelineEdges(value: unknown): RequirementPipelineEdge[] {
    if (!value || typeof value !== 'object' || !Array.isArray((value as { edges?: unknown }).edges)) {
      return [];
    }
    return (value as { edges: unknown[] }).edges.flatMap((edge): RequirementPipelineEdge[] => {
      if (
        !edge
        || typeof edge !== 'object'
        || typeof (edge as RequirementPipelineEdge).source !== 'string'
        || typeof (edge as RequirementPipelineEdge).target !== 'string'
      ) {
        return [];
      }
      const { source, target } = edge as RequirementPipelineEdge;
      return source && target && source !== target ? [{ source, target }] : [];
    });
  }

  private async addToParentRequirement(
    parentRequirementId: string,
    subRequirementId: string,
    userId: string,
    db: DatabaseExecutor = this.db,
  ): Promise<void> {
    const result = await db.execute(
      sql`UPDATE version_requirement
        SET sub_requirement_item = jsonb_set(
              COALESCE(sub_requirement_item, '{}'::jsonb),
              '{link_record_ids}',
              CASE
                WHEN COALESCE(
                  NULLIF(sub_requirement_item -> 'link_record_ids', 'null'::jsonb),
                  '[]'::jsonb
                )
                  @> jsonb_build_array(${subRequirementId}::text)
                  THEN COALESCE(
                    NULLIF(sub_requirement_item -> 'link_record_ids', 'null'::jsonb),
                    '[]'::jsonb
                  )
                ELSE COALESCE(
                  NULLIF(sub_requirement_item -> 'link_record_ids', 'null'::jsonb),
                  '[]'::jsonb
                )
                  || jsonb_build_array(${subRequirementId}::text)
              END
            ),
            _updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null},
            _updated_at = now()
        WHERE id = ${parentRequirementId}
        RETURNING id`,
    );
    if ((result as unknown as { id: string }[]).length === 0) {
      throw new NotFoundException('父需求不存在');
    }
  }

  private async removeFromParentRequirement(
    parentRequirementId: string,
    subRequirementId: string,
    subRequirementRecordId: string,
    userId: string,
    db: DatabaseExecutor = this.db,
  ): Promise<void> {
    await db.execute(
      sql`UPDATE version_requirement
        SET sub_requirement_item = jsonb_set(
              jsonb_set(
                COALESCE(sub_requirement_item, '{}'::jsonb),
                '{link_record_ids}',
                COALESCE(
                  (
                    SELECT jsonb_agg(linked_id)
                    FROM jsonb_array_elements_text(
                      COALESCE(
                        NULLIF(sub_requirement_item -> 'link_record_ids', 'null'::jsonb),
                        '[]'::jsonb
                      )
                    ) AS linked_id
                    WHERE linked_id <> ${subRequirementId}
                      AND linked_id <> ${subRequirementRecordId}
                  ),
                  '[]'::jsonb
                )
              ),
              '{edges}',
              COALESCE(
                (
                  SELECT jsonb_agg(edge)
                  FROM jsonb_array_elements(
                    COALESCE(
                      NULLIF(sub_requirement_item -> 'edges', 'null'::jsonb),
                      '[]'::jsonb
                    )
                  ) AS edge
                  WHERE edge ->> 'source' <> ${subRequirementId}
                    AND edge ->> 'target' <> ${subRequirementId}
                    AND edge ->> 'source' <> ${subRequirementRecordId}
                    AND edge ->> 'target' <> ${subRequirementRecordId}
                ),
                '[]'::jsonb
              )
            ),
            _updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null},
            _updated_at = now()
        WHERE id = ${parentRequirementId}`,
    );
  }
}