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
  testPlan,
  mainVersionManage,
} from '@server/database/schema';
import {
  TestPlanListResponse,
  TestPlan,
  CreateTestPlanDto,
  UpdateTestPlanDto,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';

interface VersionRef {
  recordId: string;
  name: string;
}

interface ListQuery {
  page: number;
  pageSize: number;
  testStatus?: string;
  priority?: string;
  testPlanType?: string;
  businessLine?: string;
  planningVersion?: string;
  executor?: string;
  keyword?: string;
}

function requireName(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`${field}不能为空`);
  }
}

@Injectable()
export class TestPlanService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getList(query: ListQuery): Promise<TestPlanListResponse> {
    const { page, pageSize, testStatus, priority, testPlanType, businessLine, planningVersion, executor, keyword } = query;
    const conditions = [];
    if (testStatus) conditions.push(eq(testPlan.testStatus, testStatus));
    if (priority) conditions.push(eq(testPlan.priority, priority));
    if (testPlanType) conditions.push(eq(testPlan.testPlanType, testPlanType));
    if (businessLine) conditions.push(eq(testPlan.businessLine, businessLine));
    if (planningVersion) conditions.push(sql`${testPlan.relatedVersion}::text LIKE '%' || ${planningVersion} || '%'`);
    if (executor) conditions.push(sql`${executor} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${testPlan.executor}) u))`);
    if (keyword) conditions.push(ilike(testPlan.planName, `%${keyword}%`));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(testPlan)
        .where(where)
        .orderBy(desc(testPlan.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(testPlan).where(where),
    ]);

    const items = itemsRes.map((t) => this.mapTestPlan(t));
    const versionIds = new Map<string, string>();
    const toLookup: string[] = [];
    for (const it of items) {
      if (it.relatedVersion && !versionIds.has(it.relatedVersion)) {
        versionIds.set(it.relatedVersion, '');
        toLookup.push(it.relatedVersion);
      }
    }
    if (toLookup.length > 0) {
      const localVersionIds = toLookup.filter(isValidUuid);
      const versions = await this.db
        .select({
          id: mainVersionManage.id,
          baseRecordId: mainVersionManage.baseRecordId,
          versionName: mainVersionManage.versionName,
        })
        .from(mainVersionManage)
        .where(
          localVersionIds.length > 0
            ? or(
                inArray(mainVersionManage.baseRecordId, toLookup),
                inArray(mainVersionManage.id, localVersionIds),
                inArray(mainVersionManage.versionName, toLookup),
              )
            : or(
                inArray(mainVersionManage.baseRecordId, toLookup),
                inArray(mainVersionManage.versionName, toLookup),
              ),
        );
      for (const v of versions) {
        versionIds.set(v.id, v.versionName || '');
        if (v.baseRecordId) versionIds.set(v.baseRecordId, v.versionName || '');
        if (v.versionName) versionIds.set(v.versionName, v.versionName);
      }
      for (const it of items) {
        if (it.relatedVersion) {
          it.relatedVersionName = versionIds.get(it.relatedVersion) || '';
        }
      }
    }
    return {
      items,
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getDetail(id: string): Promise<TestPlan> {
    const result = await this.db
      .select()
      .from(testPlan)
      .where(
        isValidUuid(id)
          ? or(eq(testPlan.id, id), eq(testPlan.baseRecordId, id))
          : eq(testPlan.baseRecordId, id),
      )
      .limit(1);
    if (result.length === 0) {
      throw new NotFoundException('测试计划不存在');
    }
    const plan = this.mapTestPlan(result[0]);
    if (plan.relatedVersion) {
      const versions = await this.db
        .select({ versionName: mainVersionManage.versionName })
        .from(mainVersionManage)
        .where(
          isValidUuid(plan.relatedVersion)
            ? or(
                eq(mainVersionManage.id, plan.relatedVersion),
                eq(mainVersionManage.baseRecordId, plan.relatedVersion),
              )
            : or(
                eq(mainVersionManage.baseRecordId, plan.relatedVersion),
                eq(mainVersionManage.versionName, plan.relatedVersion),
              ),
        )
        .limit(1);
      if (versions.length > 0) {
        plan.relatedVersionName = versions[0].versionName || '';
      }
    }
    return plan;
  }

  async create(dto: CreateTestPlanDto, userId: string): Promise<TestPlan> {
    requireName(dto.planName, '测试计划名称');
    const executorProfiles = dto.executor && dto.executor.length > 0
      ? sql`ARRAY[${sql.join(dto.executor.map((id: string) => sql`ROW(${id})::user_profile`), sql`, `)}]::user_profile[]`
      : null;
    const result = await this.db.execute(
      sql`INSERT INTO test_plan (
        plan_name, test_status, priority, test_plan_type, business_line,
        executor, expected_start_date, expected_end_date, related_version, _created_by, _updated_by
      ) VALUES (
        ${dto.planName},
        ${dto.testStatus || null},
        ${dto.priority || null},
        ${dto.testPlanType || null},
        ${dto.businessLine || null},
        ${executorProfiles},
        ${dto.expectedStartDate || null}::date,
        ${dto.expectedEndDate || null}::date,
        ${dto.relatedVersion
          ? sql`jsonb_build_object(
              'link_record_ids', jsonb_build_array(CAST(${dto.relatedVersion} AS text))
            )`
          : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null},
        ${userId ? sql`ROW(${userId})::user_profile` : null}
      ) RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    return this.getDetail(rows[0].id);
  }

  async update(id: string, dto: UpdateTestPlanDto, userId: string): Promise<TestPlan> {
    const plan = await this.getDetail(id);
    if (dto.planName !== undefined) requireName(dto.planName, '测试计划名称');

    const setParts: any[] = [];
    if (dto.planName !== undefined) setParts.push(sql`plan_name = ${dto.planName}`);
    if (dto.testStatus !== undefined) setParts.push(sql`test_status = ${dto.testStatus || null}`);
    if (dto.priority !== undefined) setParts.push(sql`priority = ${dto.priority || null}`);
    if (dto.testPlanType !== undefined) setParts.push(sql`test_plan_type = ${dto.testPlanType || null}`);
    if (dto.businessLine !== undefined) setParts.push(sql`business_line = ${dto.businessLine || null}`);
    if (dto.executor !== undefined) {
      setParts.push(sql`executor = ${
        dto.executor && dto.executor.length > 0
          ? sql`ARRAY[${sql.join(dto.executor.map((id: string) => sql`ROW(${id})::user_profile`), sql`, `)}]::user_profile[]`
          : null
      }`);
    }
    if (dto.expectedStartDate !== undefined) setParts.push(sql`expected_start_date = ${dto.expectedStartDate || null}::date`);
    if (dto.expectedEndDate !== undefined) setParts.push(sql`expected_end_date = ${dto.expectedEndDate || null}::date`);
    if (dto.relatedVersion !== undefined) {
      setParts.push(sql`related_version = ${
        dto.relatedVersion
          ? sql`jsonb_build_object(
              'link_record_ids', jsonb_build_array(CAST(${dto.relatedVersion} AS text))
            )`
          : null
      }`);
    }

    if (setParts.length === 0) {
      return plan;
    }
    setParts.push(sql`_updated_by = ${userId ? sql`ROW(${userId})::user_profile` : null}`);
    setParts.push(sql`_updated_at = NOW()`);

    const result = await this.db.execute(
      sql`UPDATE test_plan SET ${sql.join(setParts, sql`, `)}
        WHERE id = ${plan.id}
          AND (
            ${dto.expectedUpdatedAt || null}::timestamptz IS NULL
            OR date_trunc('milliseconds', _updated_at)
              = date_trunc('milliseconds', ${dto.expectedUpdatedAt || null}::timestamptz)
          )
        RETURNING id`
    );
    const rows = result as unknown as { id: string }[];
    if (rows.length === 0) {
      throw new ConflictException('测试计划已被其他人修改，请刷新后重试');
    }
    return this.getDetail(rows[0].id);
  }

  async delete(id: string): Promise<void> {
    const plan = await this.getDetail(id);
    const result = await this.db
      .delete(testPlan)
      .where(eq(testPlan.id, plan.id))
      .returning({ id: testPlan.id });
    if (result.length === 0) {
      throw new NotFoundException('测试计划不存在');
    }
  }

  private extractRecordIds(value: unknown): string[] {
    if (!value) return [];
    const arr = Array.isArray(value) ? value : [value];
    const ids: string[] = [];
    for (const item of arr) {
      if (typeof item === 'string') {
        ids.push(item);
      } else if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>;
        if (Array.isArray(obj.link_record_ids)) {
          ids.push(
            ...obj.link_record_ids.filter(
              (id): id is string => typeof id === 'string' && Boolean(id),
            ),
          );
        } else if (typeof obj.recordId === 'string' && obj.recordId) {
          ids.push(obj.recordId);
        } else if (typeof obj.text === 'string' && obj.text) {
          ids.push(obj.text);
        }
      }
    }
    return ids;
  }

  private mapTestPlan(t: typeof testPlan.$inferSelect): TestPlan {
    const versionIds = this.extractRecordIds(t.relatedVersion);
    const relatedVersion = versionIds.length > 0 ? versionIds[0] : undefined;
    return {
      id: t.id,
      baseRecordId: t.baseRecordId || '',
      updatedAt: t.updatedAt.toISOString(),
      planName: t.planName || '',
      testStatus: t.testStatus || '',
      priority: t.priority || '',
      testPlanType: t.testPlanType || '',
      businessLine: t.businessLine || '',
      executor: Array.isArray(t.executor) ? t.executor : [],
      expectedStartDate: t.expectedStartDate?.toString() || '',
      expectedEndDate: t.expectedEndDate?.toString() || '',
      relatedVersion,
      relatedVersionName: '',
    };
  }
}
