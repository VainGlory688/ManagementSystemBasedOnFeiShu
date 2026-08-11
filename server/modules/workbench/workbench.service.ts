import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { asc, count, desc, or, sql } from 'drizzle-orm';
import {
  versionRequirement,
  defectItem,
  testPlan,
  mainVersionManage,
  subRequirementItem,
} from '@server/database/schema';
import {
  WorkbenchOverview,
  MyRequirementListResponse,
  MyDefectListResponse,
  MyVersionListResponse,
} from '@shared/api.interface';

function extractParentRecordIds(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  const ids = (value as { link_record_ids?: unknown }).link_record_ids;
  return Array.isArray(ids)
    ? ids.filter((id): id is string => typeof id === 'string')
    : [];
}

function isOverdue(expectedEndDate: Date | string | null, status: string | null): boolean {
  if (!expectedEndDate || status === '已完成') return false;
  const dateText = expectedEndDate instanceof Date
    ? `${expectedEndDate.getFullYear()}-${String(expectedEndDate.getMonth() + 1).padStart(2, '0')}-${String(expectedEndDate.getDate()).padStart(2, '0')}`
    : String(expectedEndDate).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return false;
  const dueDate = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return today > dueDate;
}

function getRequirementStatus(
  items: Array<{ appStatus: string | null; appExpectedEndDate: Date | string | null }>,
): '待拆分' | '进行中' | '已完成' | '已逾期' {
  if (items.length === 0) return '待拆分';
  if (items.every((item) => item.appStatus === '已完成')) return '已完成';
  if (items.some((item) => isOverdue(item.appExpectedEndDate, item.appStatus))) return '已逾期';
  return '进行中';
}

@Injectable()
export class WorkbenchService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getOverview(userId: string): Promise<WorkbenchOverview> {
    const [reqCount, defectCount, testCount] = await Promise.all([
      this.db.select({ count: count() }).from(versionRequirement)
        .where(sql`(${versionRequirement.currentOwner}).user_id = ${userId}`),
      this.db.select({ count: count() }).from(defectItem)
        .where(sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${defectItem.currentOwner}) u))`),
      this.db.select({ count: count() }).from(testPlan)
        .where(sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${testPlan.executor}) u))`),
    ]);
    return {
      myRequirementCount: Number(reqCount[0]?.count ?? 0),
      myDefectCount: Number(defectCount[0]?.count ?? 0),
      myTestPlanCount: Number(testCount[0]?.count ?? 0),
    };
  }

  async getMyRequirements(
    userId: string,
    page: number,
    pageSize: number,
    sort?: 'priority',
    status?: string,
  ): Promise<MyRequirementListResponse> {
    const where = sql`(${versionRequirement.currentOwner}).user_id = ${userId}`;
    const orderBy = sort === 'priority'
      ? sql`CASE ${versionRequirement.priority} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN '待定' THEN 3 WHEN '历史遗留' THEN 4 ELSE 5 END`
      : desc(versionRequirement.updatedAt);
    const itemsRes = await this.db
      .select()
      .from(versionRequirement)
      .where(where)
      .orderBy(orderBy);
    const parentIds = [...new Set(
      itemsRes.flatMap((item) =>
        [item.id, item.baseRecordId].filter((id): id is string => Boolean(id)),
      ),
    )];
    const subItems = parentIds.length === 0
      ? []
      : await this.db
          .select({
            appParentWorkItem: subRequirementItem.appParentWorkItem,
            appStatus: subRequirementItem.appStatus,
            appExpectedEndDate: subRequirementItem.appExpectedEndDate,
          })
          .from(subRequirementItem)
          .where(
            or(...parentIds.map((parentId) =>
              sql`${subRequirementItem.appParentWorkItem} -> 'link_record_ids'
                @> jsonb_build_array(${parentId}::text)`,
            )),
          );
    const subItemsByParent = new Map<string, typeof subItems>();
    for (const item of subItems) {
      for (const parentId of extractParentRecordIds(item.appParentWorkItem)) {
        subItemsByParent.set(parentId, [...(subItemsByParent.get(parentId) || []), item]);
      }
    }
    const itemsWithStatus = itemsRes.map((item) => ({
      item,
      currentStatus: getRequirementStatus(
        subItemsByParent.get(item.baseRecordId || item.id)
        || subItemsByParent.get(item.id)
        || [],
      ),
    }));
    const matchedItems = status
      ? itemsWithStatus.filter((item) => item.currentStatus === status)
      : itemsWithStatus;
    const pageItems = matchedItems.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: pageItems.map(({ item, currentStatus }) => ({
        id: item.id,
        baseRecordId: item.baseRecordId || '',
        appReqName: item.appReqName || '',
        priority: item.priority || '',
        appStatus: currentStatus,
        planningVersionName: '',
        estimatedCompletionTime: item.estimatedCompletionTime?.toString() || '',
      })),
      total: matchedItems.length,
    };
  }

  async getMyDefects(
    userId: string,
    page: number,
    pageSize: number,
    sort?: 'priority',
    status?: string,
  ): Promise<MyDefectListResponse> {
    const ownerWhere = sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${defectItem.currentOwner}) u))`;
    const where = status
      ? sql`${ownerWhere} AND ${defectItem.status} = ${status}`
      : ownerWhere;
    const orderBy = sort === 'priority'
      ? sql`CASE ${defectItem.priority} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN '待定' THEN 3 WHEN '历史遗留' THEN 4 ELSE 5 END`
      : desc(defectItem.updatedAt);
    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(defectItem)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(defectItem).where(where),
    ]);

    return {
      items: itemsRes.map((d) => ({
        id: d.id,
        baseRecordId: d.baseRecordId || '',
        defectName: d.defectName || '',
        severity: d.severity || '',
        priority: d.priority || '',
        status: d.status || '',
        relatedVersionName: '',
        overdue: false,
      })),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getMyVersions(userId: string, page: number, pageSize: number, sort?: 'name'): Promise<MyVersionListResponse> {
    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(mainVersionManage)
        .orderBy(sort === 'name' ? asc(mainVersionManage.versionName) : desc(mainVersionManage.updatedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(mainVersionManage),
    ]);

    return {
      items: itemsRes.map((v) => ({
        id: v.id,
        baseRecordId: v.baseRecordId || '',
        versionName: v.versionName || '',
        appStatus: v.appStatus || '',
        currentMilestone: this.getCurrentMilestone(v),
      })),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  private getCurrentMilestone(v: typeof mainVersionManage.$inferSelect): string {
    if (v.actualReleaseDate) return '已发布';
    if (v.actualGrayDate) return '灰度中';
    if (v.versionCloseDate) return '待关闭';
    if (v.expectedTestTime) return '提测阶段';
    if (v.packTime) return '打包阶段';
    if (v.versionStartDate) return '开发中';
    return '未开始';
  }
}
