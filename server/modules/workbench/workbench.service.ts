import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import {
  versionRequirement,
  defectItem,
  testPlan,
  mainVersionManage,
} from '@server/database/schema';
import {
  WorkbenchOverview,
  MyRequirementListResponse,
  MyDefectListResponse,
  MyVersionListResponse,
} from '@shared/api.interface';

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

  async getMyRequirements(userId: string, page: number, pageSize: number, sort?: 'priority'): Promise<MyRequirementListResponse> {
    const where = sql`(${versionRequirement.currentOwner}).user_id = ${userId}`;
    const orderBy = sort === 'priority'
      ? sql`CASE ${versionRequirement.priority} WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN '待定' THEN 3 WHEN '历史遗留' THEN 4 ELSE 5 END`
      : desc(versionRequirement.updatedAt);
    const [itemsRes, totalRes] = await Promise.all([
      this.db
        .select()
        .from(versionRequirement)
        .where(where)
        .orderBy(orderBy)
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      this.db.select({ count: count() }).from(versionRequirement).where(where),
    ]);

    return {
      items: itemsRes.map((r) => ({
        id: r.id,
        baseRecordId: r.baseRecordId || '',
        appReqName: r.appReqName || '',
        priority: r.priority || '',
        appStatus: '',
        planningVersionName: '',
        estimatedCompletionTime: r.estimatedCompletionTime?.toString() || '',
      })),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getMyDefects(userId: string, page: number, pageSize: number, sort?: 'priority'): Promise<MyDefectListResponse> {
    const where = sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${defectItem.currentOwner}) u))`;
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
