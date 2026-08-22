import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE, type PostgresJsDatabase } from '@lark-apaas/fullstack-nestjs-core';
import { and, count, desc, eq, inArray, or, sql } from 'drizzle-orm';
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
  MyTestPlanListResponse,
  MyVersionListResponse,
  MyBlockedSubRequirementListResponse,
} from '@shared/api.interface';
import { isValidUuid } from '@server/common/utils/uuid';
import { RequirementService } from '../requirement/requirement.service';

function extractParentRecordIds(value: unknown): string[] {
  if (!value) return [];
  const values = Array.isArray(value) ? value : [value];
  const ids: string[] = [];
  for (const item of values) {
    if (typeof item === 'string') {
      ids.push(item);
    } else if (item && typeof item === 'object') {
      const relation = item as Record<string, unknown>;
      if (Array.isArray(relation.link_record_ids)) {
        ids.push(...relation.link_record_ids.filter(
          (id): id is string => typeof id === 'string' && Boolean(id),
        ));
      }
      for (const key of [
        'id',
        'baseRecordId',
        'base_record_id',
        'recordId',
        'record_id',
        'name',
        'text',
        'appReqName',
        'title',
      ]) {
        const value = relation[key];
        if (typeof value === 'string' && value) ids.push(value);
      }
    }
  }
  return ids;
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
    private readonly requirementService: RequirementService,
  ) {}

  async getOverview(userId: string, projectId?: string): Promise<WorkbenchOverview> {
    const [reqCount, defectCount, testCount] = await Promise.all([
      this.db.select({ count: count() }).from(versionRequirement)
        .where(and(
          sql`(${versionRequirement.currentOwner}).user_id = ${userId}`,
          projectId ? eq(versionRequirement.projectId, projectId) : undefined,
        )),
      this.db.select({ count: count() }).from(defectItem)
        .where(and(
          sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${defectItem.currentOwner}) u))`,
          projectId ? eq(defectItem.projectId, projectId) : undefined,
        )),
      this.db.select({ count: count() }).from(testPlan)
        .where(and(
          sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${testPlan.executor}) u))`,
          projectId ? eq(testPlan.projectId, projectId) : undefined,
        )),
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
    projectId?: string,
  ): Promise<MyRequirementListResponse> {
    const where = and(
      sql`(${versionRequirement.currentOwner}).user_id = ${userId}`,
      projectId ? eq(versionRequirement.projectId, projectId) : undefined,
    );
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
          .where(and(
            or(...parentIds.map((parentId) =>
              sql`${subRequirementItem.appParentWorkItem} -> 'link_record_ids'
                @> jsonb_build_array(${parentId}::text)`,
            )),
            projectId ? eq(subRequirementItem.projectId, projectId) : undefined,
          ));
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
    const versionIds = pageItems
      .map(({ item }) => item.planningVersion)
      .filter((id): id is string => Boolean(id));
    const versions = versionIds.length === 0
      ? []
      : await this.db
          .select({
            id: mainVersionManage.id,
            baseRecordId: mainVersionManage.baseRecordId,
            versionName: mainVersionManage.versionName,
          })
          .from(mainVersionManage)
          .where(and(
            inArray(mainVersionManage.baseRecordId, versionIds),
            projectId ? eq(mainVersionManage.projectId, projectId) : undefined,
          ));
    const versionNames = new Map<string, string>();
    for (const version of versions) {
      versionNames.set(version.id, version.versionName || '');
      if (version.baseRecordId) versionNames.set(version.baseRecordId, version.versionName || '');
    }

    return {
      items: pageItems.map(({ item, currentStatus }) => ({
        id: item.id,
        baseRecordId: item.baseRecordId || '',
        appReqName: item.appReqName || '',
        priority: item.priority || '',
        appStatus: currentStatus,
        planningVersionName: item.planningVersion
          ? versionNames.get(item.planningVersion) || ''
          : '',
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
    projectId?: string,
  ): Promise<MyDefectListResponse> {
    const ownerWhere = sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${defectItem.currentOwner}) u))`;
    const where = and(
      ownerWhere,
      status ? eq(defectItem.status, status) : undefined,
      projectId ? eq(defectItem.projectId, projectId) : undefined,
    );
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
    const parentRelationValues = itemsRes.map((item) =>
      extractParentRecordIds(item.appParentOrder),
    );
    const parentRequirementIds = [...new Set(parentRelationValues.flat())];
    const localParentRequirementIds = parentRequirementIds.filter(isValidUuid);
    const requirementRows = parentRequirementIds.length === 0
      ? []
      : await this.db
          .select({
            id: versionRequirement.id,
            baseRecordId: versionRequirement.baseRecordId,
            appReqName: versionRequirement.appReqName,
            planningVersion: versionRequirement.planningVersion,
          })
          .from(versionRequirement)
          .where(and(
            localParentRequirementIds.length > 0
              ? or(
                  inArray(versionRequirement.id, localParentRequirementIds),
                  inArray(versionRequirement.baseRecordId, parentRequirementIds),
                  inArray(versionRequirement.appReqName, parentRequirementIds),
                )
              : or(
                  inArray(versionRequirement.baseRecordId, parentRequirementIds),
                  inArray(versionRequirement.appReqName, parentRequirementIds),
                ),
            projectId ? eq(versionRequirement.projectId, projectId) : undefined,
          ));
    const requirementsByIdentifier = new Map<string, (typeof requirementRows)[number]>();
    const requirementsByName = new Map<string, (typeof requirementRows)[number]>();
    const ambiguousNames = new Set<string>();
    for (const requirement of requirementRows) {
      requirementsByIdentifier.set(requirement.id, requirement);
      if (requirement.baseRecordId) {
        requirementsByIdentifier.set(requirement.baseRecordId, requirement);
      }
      const name = requirement.appReqName || '';
      if (name && requirementsByName.has(name)) ambiguousNames.add(name);
      else if (name) requirementsByName.set(name, requirement);
    }
    for (const name of ambiguousNames) requirementsByName.delete(name);
    const matchedRequirements = parentRelationValues.map((values) => (
      values.map((value) => requirementsByIdentifier.get(value)).find(Boolean)
      || values.map((value) => requirementsByName.get(value)).find(Boolean)
    ));
    const versionIds = [...new Set(
      matchedRequirements
        .map((requirement) => requirement?.planningVersion)
        .filter((value): value is string => Boolean(value)),
    )];
    const localVersionIds = versionIds.filter(isValidUuid);
    const versionRecords = versionIds.length === 0
      ? []
      : await this.db
          .select({
            id: mainVersionManage.id,
            baseRecordId: mainVersionManage.baseRecordId,
            versionName: mainVersionManage.versionName,
          })
          .from(mainVersionManage)
          .where(and(
            localVersionIds.length > 0
              ? or(
                  inArray(mainVersionManage.id, localVersionIds),
                  inArray(mainVersionManage.baseRecordId, versionIds),
                )
              : inArray(mainVersionManage.baseRecordId, versionIds),
            projectId ? eq(mainVersionManage.projectId, projectId) : undefined,
          ));
    const versionNames = new Map<string, string>();
    for (const version of versionRecords) {
      if (version.baseRecordId) versionNames.set(version.baseRecordId, version.versionName || '');
      versionNames.set(version.id, version.versionName || '');
    }

    return {
      items: itemsRes.map((d, index) => {
        const versionId = matchedRequirements[index]?.planningVersion;
        return {
          id: d.id,
          baseRecordId: d.baseRecordId || '',
          defectName: d.defectName || '',
          severity: d.severity || '',
          priority: d.priority || '',
          status: d.status || '',
          relatedVersionName: versionId ? versionNames.get(versionId) || '' : '',
          overdue: false,
        };
      }),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getMyTestPlans(
    userId: string,
    page: number,
    pageSize: number,
    projectId?: string,
  ): Promise<MyTestPlanListResponse> {
    const where = and(
      sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${testPlan.executor}) u))`,
      projectId ? eq(testPlan.projectId, projectId) : undefined,
    );
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
    const relatedVersionIds = [...new Set(
      itemsRes.flatMap((item) => extractParentRecordIds(item.relatedVersion)),
    )];
    const versions = relatedVersionIds.length === 0
      ? []
      : await this.db
          .select({
            id: mainVersionManage.id,
            baseRecordId: mainVersionManage.baseRecordId,
            versionName: mainVersionManage.versionName,
          })
          .from(mainVersionManage)
          .where(and(
            inArray(mainVersionManage.baseRecordId, relatedVersionIds),
            projectId ? eq(mainVersionManage.projectId, projectId) : undefined,
          ));
    const versionNames = new Map<string, string>();
    for (const version of versions) {
      versionNames.set(version.id, version.versionName || '');
      if (version.baseRecordId) versionNames.set(version.baseRecordId, version.versionName || '');
    }

    return {
      items: itemsRes.map((item) => {
        const relatedVersionId = extractParentRecordIds(item.relatedVersion)[0];
        return {
          id: item.id,
          baseRecordId: item.baseRecordId || '',
          planName: item.planName || '',
          testStatus: item.testStatus || '',
          priority: item.priority || '',
          relatedVersionName: relatedVersionId ? versionNames.get(relatedVersionId) || '' : '',
          expectedEndDate: item.expectedEndDate?.toString() || '',
        };
      }),
      total: Number(totalRes[0]?.count ?? 0),
    };
  }

  async getMyVersions(
    userId: string,
    page: number,
    pageSize: number,
    sort?: 'name',
    projectId?: string,
  ): Promise<MyVersionListResponse> {
    const ownerWhere = sql`(${versionRequirement.currentOwner}).user_id = ${userId}`;
    const executorWhere = sql`${userId} = ANY(ARRAY(SELECT (u).user_id FROM unnest(${testPlan.executor}) u))`;
    const [requirements, testPlans] = await Promise.all([
      this.db
        .select({ planningVersion: versionRequirement.planningVersion })
        .from(versionRequirement)
        .where(and(
          ownerWhere,
          projectId ? eq(versionRequirement.projectId, projectId) : undefined,
        )),
      this.db
        .select({ relatedVersion: testPlan.relatedVersion })
        .from(testPlan)
        .where(and(
          executorWhere,
          projectId ? eq(testPlan.projectId, projectId) : undefined,
        )),
    ]);
    const versionIds = [...new Set([
      ...requirements.map((item) => item.planningVersion).filter((id): id is string => Boolean(id)),
      ...testPlans.flatMap((item) => extractParentRecordIds(item.relatedVersion)),
    ])];
    const versionRecords = versionIds.length === 0
      ? []
      : await this.db
          .select()
          .from(mainVersionManage)
          .where(projectId ? eq(mainVersionManage.projectId, projectId) : undefined);
    const relatedVersionIds = new Set(versionIds);
    const allItems = versionRecords.filter((version) => (
      relatedVersionIds.has(version.id)
      || (version.baseRecordId ? relatedVersionIds.has(version.baseRecordId) : false)
      || (version.versionName ? relatedVersionIds.has(version.versionName) : false)
    ));
    const itemsRes = [...allItems].sort((a, b) => (
      sort === 'name'
        ? (a.versionName || '').localeCompare(b.versionName || '', 'zh-CN')
        : b.updatedAt.getTime() - a.updatedAt.getTime()
    ));
    const pageItems = itemsRes.slice((page - 1) * pageSize, page * pageSize);

    return {
      items: pageItems.map((v) => ({
        id: v.id,
        baseRecordId: v.baseRecordId || '',
        versionName: v.versionName || '',
        appStatus: v.appStatus || '',
        currentMilestone: this.getCurrentMilestone(v),
      })),
      total: itemsRes.length,
    };
  }

  async getMyBlockedSubRequirements(
    userId: string,
    page: number,
    pageSize: number,
    projectId?: string,
  ): Promise<MyBlockedSubRequirementListResponse> {
    const requirements = await this.db
      .select()
      .from(versionRequirement)
      .where(projectId ? eq(versionRequirement.projectId, projectId) : undefined);
    const parentIds = new Set(requirements.flatMap((requirement) =>
      [requirement.id, requirement.baseRecordId].filter(
        (id): id is string => Boolean(id),
      )));
    const subItems = (await this.db
      .select()
      .from(subRequirementItem)
      .where(projectId ? eq(subRequirementItem.projectId, projectId) : undefined))
      .filter((item) =>
        extractParentRecordIds(item.appParentWorkItem)
          .some((parentId) => parentIds.has(parentId)));
    const matchedItems = this.requirementService
      .getBlockedSubRequirements(requirements, subItems)
      .filter((item) => item.appCurrentOwner === userId);

    return {
      items: matchedItems.slice((page - 1) * pageSize, page * pageSize),
      total: matchedItems.length,
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
