import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { eq, count, desc, inArray, sql } from 'drizzle-orm';
import {
  mainVersionManage,
  versionRequirement,
  testPlan,
  defectItem,
} from '@server/database/schema';
import {
  DashboardKpis,
  DefectSeverityResponse,
  BusinessLineStatsResponse,
  VersionStatusResponse,
  RecentActivitiesResponse,
  RecentActivity,
} from '@shared/api.interface';

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: PostgresJsDatabase,
  ) {}

  async getKpis(): Promise<DashboardKpis> {
    const [versionRes, reqRes, defectRes, testRes] = await Promise.all([
      this.db.select({ count: count() }).from(mainVersionManage)
        .where(inArray(mainVersionManage.appStatus, ['开发中', '进行中'])),
      this.db.select({ count: count() }).from(versionRequirement)
        .where(eq(versionRequirement.priority, 'P0')),
      this.db.select({ count: count() }).from(defectItem)
        .where(sql`${defectItem.status} != '已关闭'`),
      this.db.select({ count: count() }).from(testPlan)
        .where(inArray(testPlan.testStatus, ['进行中', '测试中'])),
    ]);
    return {
      activeVersions: Number(versionRes[0]?.count ?? 0),
      pendingRequirements: Number(reqRes[0]?.count ?? 0),
      activeDefects: Number(defectRes[0]?.count ?? 0),
      activeTestPlans: Number(testRes[0]?.count ?? 0),
    };
  }

  async getDefectSeverity(): Promise<DefectSeverityResponse> {
    const result = await this.db
      .select({
        severity: defectItem.severity,
        count: count(),
      })
      .from(defectItem)
      .groupBy(defectItem.severity);
    return {
      items: result.map((r) => ({
        severity: r.severity || '未知',
        count: Number(r.count),
      })),
    };
  }

  async getBusinessLineStats(): Promise<BusinessLineStatsResponse> {
    const reqResult = await this.db
      .select({
        businessLine: versionRequirement.businessLine,
        count: count(),
      })
      .from(versionRequirement)
      .groupBy(versionRequirement.businessLine);

    const defectResult = await this.db
      .select({
        businessLine: defectItem.businessLine,
        count: count(),
      })
      .from(defectItem)
      .groupBy(defectItem.businessLine);

    const map = new Map<string, { businessLine: string; requirementCount: number; defectCount: number }>();
    for (const r of reqResult) {
      const bl = r.businessLine || '未分类';
      map.set(bl, { businessLine: bl, requirementCount: Number(r.count), defectCount: 0 });
    }
    for (const r of defectResult) {
      const bl = r.businessLine || '未分类';
      if (map.has(bl)) {
        map.get(bl)!.defectCount = Number(r.count);
      } else {
        map.set(bl, { businessLine: bl, requirementCount: 0, defectCount: Number(r.count) });
      }
    }
    return { items: Array.from(map.values()) };
  }

  async getVersionStatus(): Promise<VersionStatusResponse> {
    const result = await this.db
      .select({
        status: mainVersionManage.appStatus,
        count: count(),
      })
      .from(mainVersionManage)
      .groupBy(mainVersionManage.appStatus);
    return {
      items: result.map((r) => ({
        status: r.status || '未知',
        count: Number(r.count),
      })),
    };
  }

  async getRecentActivities(limit: number): Promise<RecentActivitiesResponse> {
    const [versions, requirements, defects] = await Promise.all([
      this.db
        .select({
          id: mainVersionManage.id,
          baseRecordId: mainVersionManage.baseRecordId,
          title: mainVersionManage.versionName,
          status: mainVersionManage.appStatus,
          updatedAt: mainVersionManage.updatedAt,
        })
        .from(mainVersionManage)
        .orderBy(desc(mainVersionManage.updatedAt))
        .limit(limit),
      this.db
        .select({
          id: versionRequirement.id,
          baseRecordId: versionRequirement.baseRecordId,
          title: versionRequirement.appReqName,
          status: versionRequirement.priority,
          updatedAt: versionRequirement.updatedAt,
          ownerId: versionRequirement.currentOwner,
        })
        .from(versionRequirement)
        .orderBy(desc(versionRequirement.updatedAt))
        .limit(limit),
      this.db
        .select({
          id: defectItem.id,
          baseRecordId: defectItem.baseRecordId,
          title: defectItem.defectName,
          status: defectItem.severity,
          updatedAt: defectItem.updatedAt,
        })
        .from(defectItem)
        .orderBy(desc(defectItem.updatedAt))
        .limit(limit),
    ]);

    const activities: RecentActivity[] = [
      ...versions.map((v) => ({
        id: `v-${v.id}`,
        type: 'version' as const,
        title: v.title || '未命名版本',
        status: v.status || '-',
        updatedAt: v.updatedAt.toISOString(),
        targetId: v.baseRecordId || v.id,
      })),
      ...requirements.map((r) => ({
        id: `r-${r.id}`,
        type: 'requirement' as const,
        title: r.title || '未命名需求',
        status: r.status || '-',
        updatedAt: r.updatedAt.toISOString(),
        ownerId: r.ownerId || undefined,
        targetId: r.baseRecordId || r.id,
      })),
      ...defects.map((d) => ({
        id: `d-${d.id}`,
        type: 'defect' as const,
        title: d.title || '未命名缺陷',
        status: d.status || '-',
        updatedAt: d.updatedAt.toISOString(),
        targetId: d.baseRecordId || d.id,
      })),
    ];

    activities.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return { items: activities.slice(0, limit) };
  }
}
