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
  mainVersionManage,
  versionRequirement,
  subRequirementItem,
  testPlan,
  defectItem,
} from '@server/database/schema';
import {
  VersionListResponse,
  MainVersion,
  RequirementListResponse,
  VersionSummary,
  DefectSeverityStat,
  CreateVersionDto,
  UpdateVersionDto,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';

function extractParentRecordIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const ids = (value as { link_record_ids?: unknown }).link_record_ids;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
}

function requireName(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field}不能为空`);
  }
}

function calculateRequirementStatus(
  items: Array<{ appStatus: string | null; appExpectedEndDate: Date | string | null }>,
): '待拆分' | '进行中' | '已完成' | '已逾期' {
  if (items.length === 0) return '待拆分';
  if (items.every((item) => item.appStatus === '已完成')) return '已完成';
  if (items.some((item) => calculateOverdueDays(item.appExpectedEndDate, item.appStatus) > 0)) return '已逾期';
  return '进行中';
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

interface ListQuery {
  page: number;
  pageSize: number;
  status?: string;
  businessLine?: string;
  versionType?: string;
  priority?: string;
  keyword?: string;
}

@Injectable()
export class VersionService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(query: ListQuery): Promise<VersionListResponse> {
    const { page, pageSize, status, businessLine, versionType, priority, keyword } = query;
    const conditions = [];
    if (status) conditions.push(eq(mainVersionManage.appStatus, status));

    if (versionType) conditions.push(eq(mainVersionManage.versionType, versionType));
    if (priority) conditions.push(eq(mainVersionManage.priority, priority));
    if (keyword) conditions.push(ilike(mainVersionManage.versionName, `%${keyword}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(mainVersionManage)
        .where(where)
        .orderBy(desc(mainVersionManage.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(mainVersionManage).where(where),
    ]);

    return {
      items: itemsRes.map((v) => this.mapVersion(v)),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getDetail(id: string): Promise<MainVersion> {
    const result = await this.db
      .select()
      .from(mainVersionManage)
      .where(
        isValidUuid(id)
          ? or(eq(mainVersionManage.id, id), eq(mainVersionManage.baseRecordId, id))
          : or(
              eq(mainVersionManage.baseRecordId, id),
              eq(mainVersionManage.versionName, id),
            ),
      )
      .limit(1);
    if (result.length === 0) {
      throw new NotFoundException('版本不存在');
    }
    return this.mapVersion(result[0]);
  }

  async getRequirements(versionId: string, page: number, pageSize: number): Promise<RequirementListResponse> {
    const version = await this.getDetail(versionId);
    const where = eq(versionRequirement.planningVersion, version.baseRecordId || version.id);

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
    const requirementIds = [...new Set(
      itemsRes.flatMap((item) =>
        [item.id, item.baseRecordId].filter(
          (value): value is string => Boolean(value),
        ),
      ),
    )];
    const subItems = requirementIds.length === 0
      ? []
      : await this.db
          .select({
            appParentWorkItem: subRequirementItem.appParentWorkItem,
            appStatus: subRequirementItem.appStatus,
            appExpectedEndDate: subRequirementItem.appExpectedEndDate,
          })
          .from(subRequirementItem)
          .where(
            or(
              ...requirementIds.map(
                (requirementId) =>
                  sql`${subRequirementItem.appParentWorkItem}::text LIKE '%' || ${requirementId} || '%'`,
              ),
            ),
          );
    const subItemsByParent = new Map<string, typeof subItems>();
    for (const item of subItems) {
      for (const parentId of extractParentRecordIds(item.appParentWorkItem)) {
        subItemsByParent.set(parentId, [...(subItemsByParent.get(parentId) || []), item]);
      }
    }

    return {
      items: itemsRes.map((r) => ({
        id: r.id,
        baseRecordId: r.baseRecordId || '',
        updatedAt: r.updatedAt.toISOString(),
        appReqName: r.appReqName || '',
        currentOwner: r.currentOwner || '',
        currentStatus: calculateRequirementStatus(
          subItemsByParent.get(r.baseRecordId || r.id)
          || subItemsByParent.get(r.id)
          || [],
        ),
        priority: r.priority || '',
        appStatus: '',
        reqType: r.reqType || '',
        businessLine: r.businessLine || '',
        planningVersion: r.planningVersion || '',
        planningVersionName: version.versionName,
        planningVersionId: version.id,
        proposalTime: r.proposalTime?.toString() || '',
        estimatedCompletionTime: r.estimatedCompletionTime?.toString() || '',
        creator: r.creator || '',
        description: r.description || '',
      })),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getSummary(versionId: string): Promise<VersionSummary> {
    const version = await this.getDetail(versionId);

    const [testCount, reqCount, defectRows] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(testPlan)
        .where(
          or(
            sql`${testPlan.relatedVersion}::text LIKE '%' || ${version.baseRecordId || version.id} || '%'`,
            sql`${testPlan.relatedVersion}::text LIKE '%' || ${version.versionName} || '%'`,
          ),
        ),
      this.db
        .select({ count: count() })
        .from(versionRequirement)
        .where(eq(versionRequirement.planningVersion, version.baseRecordId || version.id)),
      this.db
        .select({
          severity: defectItem.severity,
          count: count(),
        })
        .from(defectItem)
        .where(sql`${defectItem.testingStage} IS NOT NULL`)
        .groupBy(defectItem.severity),
    ]);

    const defectBySeverity: DefectSeverityStat[] = defectRows.map((r) => ({
      severity: r.severity || '未知',
      count: Number(r.count),
    }));
    const defectCount = defectBySeverity.reduce((sum, s) => sum + s.count, 0);

    return {
      testPlanCount: Number(testCount[0]?.count ?? 0),
      defectCount,
      defectBySeverity,
    };
  }

  async create(dto: CreateVersionDto, userId: string): Promise<MainVersion> {
    requireName(dto.versionName, '版本名称');
    const result = await this.db.execute(
      sql`INSERT INTO main_version_manage (
        base_record_id, version_name, app_status, priority, version_type, version_doc, version_risk,
        version_start_date, pack_time, expected_test_time, version_close_date,
        actual_gray_date, actual_release_date, rollback_reason_and_process, _created_by, _updated_by
      ) VALUES (
        gen_random_uuid()::text,
        ${dto.versionName}, ${dto.appStatus || null}, ${dto.priority || null},
        ${dto.versionType || null}, ${dto.versionDoc || null}, ${dto.versionRisk || null},
        ${dto.versionStartDate || null}::date,
        ${dto.packTime || null}::date,
        ${dto.expectedTestTime || null}::date,
        ${dto.versionCloseDate || null}::date,
        ${dto.actualGrayDate || null}::date,
        ${dto.actualReleaseDate || null}::date,
        ${dto.rollbackReasonAndProcess || null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateVersionDto, userId: string): Promise<MainVersion> {
    const version = await this.getDetail(id);
    if (dto.versionName !== undefined) requireName(dto.versionName, '版本名称');

    const setParts: any[] = [];
    if (dto.versionName !== undefined) setParts.push(sql`version_name = ${dto.versionName}`);
    if (dto.appStatus !== undefined) setParts.push(sql`app_status = ${dto.appStatus || null}`);
    if (dto.priority !== undefined) setParts.push(sql`priority = ${dto.priority || null}`);
    if (dto.versionType !== undefined) setParts.push(sql`version_type = ${dto.versionType || null}`);
    if (dto.versionDoc !== undefined) setParts.push(sql`version_doc = ${dto.versionDoc || null}`);
    if (dto.versionRisk !== undefined) setParts.push(sql`version_risk = ${dto.versionRisk || null}`);
    if (dto.versionStartDate !== undefined) setParts.push(sql`version_start_date = ${dto.versionStartDate || null}::date`);
    if (dto.packTime !== undefined) setParts.push(sql`pack_time = ${dto.packTime || null}::date`);
    if (dto.expectedTestTime !== undefined) setParts.push(sql`expected_test_time = ${dto.expectedTestTime || null}::date`);
    if (dto.versionCloseDate !== undefined) setParts.push(sql`version_close_date = ${dto.versionCloseDate || null}::date`);
    if (dto.actualGrayDate !== undefined) setParts.push(sql`actual_gray_date = ${dto.actualGrayDate || null}::date`);
    if (dto.actualReleaseDate !== undefined) setParts.push(sql`actual_release_date = ${dto.actualReleaseDate || null}::date`);
    if (dto.rollbackReasonAndProcess !== undefined) setParts.push(sql`rollback_reason_and_process = ${dto.rollbackReasonAndProcess || null}`);

    if (setParts.length === 0) {
      return version;
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);
    setParts.push(sql`_updated_at = NOW()`);

    const result = await this.db.execute(
      sql`UPDATE main_version_manage SET ${sql.join(setParts, sql`, `)}
        WHERE id = ${version.id}
          AND (
            ${dto.expectedUpdatedAt || null}::timestamptz IS NULL
            OR date_trunc('milliseconds', _updated_at)
              = date_trunc('milliseconds', ${dto.expectedUpdatedAt || null}::timestamptz)
          )
        RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (rows.length === 0) {
      throw new ConflictException('版本已被其他人修改，请刷新后重试');
    }
    return this.getDetail(rows[0].id);
  }

  async delete(id: string): Promise<void> {
    const version = await this.getDetail(id);
    const versionRecordIds = [version.id, version.baseRecordId].filter(Boolean);
    const [requirements, plans] = await Promise.all([
      this.db
        .select({ id: versionRequirement.id })
        .from(versionRequirement)
        .where(inArray(versionRequirement.planningVersion, versionRecordIds))
        .limit(1),
      this.db
        .select({ id: testPlan.id })
        .from(testPlan)
        .where(
          or(
            ...versionRecordIds.map(
              (recordId) =>
                sql`${testPlan.relatedVersion} @> jsonb_build_object(
                  'link_record_ids', jsonb_build_array(CAST(${recordId} AS text))
                ) OR ${testPlan.relatedVersion}::text LIKE '%' || ${recordId} || '%'`,
            ),
          ),
        )
        .limit(1),
    ]);
    if (requirements.length > 0 || plans.length > 0) {
      throw new ConflictException('版本仍有关联需求或测试计划，无法删除');
    }

    const result = await this.db
      .delete(mainVersionManage)
      .where(eq(mainVersionManage.id, version.id))
      .returning({ id: mainVersionManage.id });
    if (result.length === 0) {
      throw new NotFoundException('版本不存在');
    }
  }

  private mapVersion(v: typeof mainVersionManage.$inferSelect): MainVersion {
    return {
      id: v.id,
      baseRecordId: v.baseRecordId || '',
      updatedAt: v.updatedAt.toISOString(),
      versionName: v.versionName || '',
      appStatus: v.appStatus || '',
      priority: v.priority || '',
      versionType: v.versionType || '',
      businessLine: '',
      versionDoc: v.versionDoc || undefined,
      versionRisk: v.versionRisk || undefined,
      versionStartDate: v.versionStartDate?.toString() || '',
      packTime: v.packTime?.toString() || '',
      expectedTestTime: v.expectedTestTime?.toString() || '',
      versionCloseDate: v.versionCloseDate?.toString() || '',
      actualGrayDate: v.actualGrayDate?.toString() || undefined,
      actualReleaseDate: v.actualReleaseDate?.toString() || undefined,
      rollbackReasonAndProcess: v.rollbackReasonAndProcess || undefined,
    };
  }
}
