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
    const result = await this.db.execute(
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
        ${dto.appParentWorkItem ? sql`jsonb_build_object('link_record_ids', jsonb_build_array(${dto.appParentWorkItem}::text))` : null},
        ${dto.appDetails || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (dto.appParentWorkItem) {
      await this.addToParentRequirement(
        dto.appParentWorkItem,
        rows[0].id,
        userId,
      );
    }
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateSubRequirementDto, userId: string): Promise<SubRequirementItem> {
    const setParts: any[] = [];
    if (dto.appSubRequirementName !== undefined) setParts.push(sql`app_sub_requirement_name = ${dto.appSubRequirementName}`);
    if (dto.appStatus !== undefined) setParts.push(sql`app_status = ${dto.appStatus || null}`);
    if (dto.appCurrentOwner !== undefined) setParts.push(sql`app_current_owner = ${dto.appCurrentOwner ? sql`ROW(${dto.appCurrentOwner})::user_profile` : null}`);
    if (dto.appExpectedStartDate !== undefined) setParts.push(sql`app_expected_start_date = ${dto.appExpectedStartDate || null}::date`);
    if (dto.appExpectedEndDate !== undefined) setParts.push(sql`app_expected_end_date = ${dto.appExpectedEndDate || null}::date`);
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

  async delete(id: string, userId: string): Promise<void> {
    const items = await this.db
      .select({
        id: subRequirementItem.id,
        baseRecordId: subRequirementItem.baseRecordId,
        appParentWorkItem: subRequirementItem.appParentWorkItem,
      })
      .from(subRequirementItem)
      .where(
        isValidUuid(id)
          ? or(eq(subRequirementItem.id, id), eq(subRequirementItem.baseRecordId, id))
          : eq(subRequirementItem.baseRecordId, id),
      )
      .limit(1);
    const item = items[0];
    if (!item) {
      throw new NotFoundException('子需求不存在');
    }

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

    const parentIds = extractParentRecordIds(item.appParentWorkItem);
    await Promise.all(
      parentIds.map((parentId) =>
        this.removeFromParentRequirement(
          parentId,
          item.id,
          item.baseRecordId || item.id,
          userId,
        ),
      ),
    );
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
      appOverdueDays: calculateOverdueDays(s.appExpectedEndDate, s.appStatus),
      appPriority: s.appPriority || '',
      appDetails: s.appDetails || undefined,
      appParentWorkItemName: undefined,
    };
  }

  private async addToParentRequirement(
    parentId: string,
    subRequirementId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.db.execute(
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
            _updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}
        WHERE ${
          isValidUuid(parentId)
            ? sql`id = ${parentId} OR base_record_id = ${parentId}`
            : sql`base_record_id = ${parentId}`
        }
        RETURNING id`,
    );
    if ((result as unknown as { id: string }[]).length === 0) {
      throw new NotFoundException('父需求不存在');
    }
  }

  private async removeFromParentRequirement(
    parentId: string,
    subRequirementId: string,
    subRequirementRecordId: string,
    userId: string,
  ): Promise<void> {
    await this.db.execute(
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
                  'null'::jsonb
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
            _updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}
        WHERE ${
          isValidUuid(parentId)
            ? sql`id = ${parentId} OR base_record_id = ${parentId}`
            : sql`base_record_id = ${parentId}`
        }`,
    );
  }
}