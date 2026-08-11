import { useEffect, useState } from 'react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { motion } from 'framer-motion';
import {
  getWorkbenchOverview,
  getMyRequirements,
  getMyDefects,
  getMyVersions,
} from '@client/src/api/workbench';
import type {
  WorkbenchOverview,
  MyRequirementItem,
  MyDefectItem,
  MyVersionItem,
} from '@shared/api.interface';
import { WorkbenchGreeting } from './WorkbenchGreeting';
import { WorkbenchStats } from './WorkbenchStats';
import { RequirementList } from './RequirementList';
import { DefectList } from './DefectList';
import { VersionList } from './VersionList';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import PersonnelGanttPage from '@/pages/personnel-gantt/PersonnelGanttPage';

const PAGE_SIZE = 5;
const REQUIREMENT_STATUS_OPTIONS = ['进行中', '待拆分', '已逾期', '已完成'];

function ListPager({ page, total, onPageChange }: { page: number; total: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-end gap-3 border-t border-border pt-3">
      <span className="text-xs text-muted-foreground">{page} / {totalPages} 页</span>
      <button type="button" className="text-xs text-primary disabled:text-muted-foreground" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>上一页</button>
      <button type="button" className="text-xs text-primary disabled:text-muted-foreground" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页</button>
    </div>
  );
}

const WorkbenchPage = () => {
  const currentUserId = typeof window === 'undefined' ? undefined : window.userId;
  const [overview, setOverview] = useState<WorkbenchOverview | null>(null);
  const [requirements, setRequirements] = useState<MyRequirementItem[]>([]);
  const [defects, setDefects] = useState<MyDefectItem[]>([]);
  const [versions, setVersions] = useState<MyVersionItem[]>([]);
  const [requirementTotal, setRequirementTotal] = useState(0);
  const [defectTotal, setDefectTotal] = useState(0);
  const [versionTotal, setVersionTotal] = useState(0);
  const [requirementPage, setRequirementPage] = useState(1);
  const [defectPage, setDefectPage] = useState(1);
  const [versionPage, setVersionPage] = useState(1);
  const [requirementSort, setRequirementSort] = useState<'priority' | 'updated'>('priority');
  const [defectSort, setDefectSort] = useState<'priority' | 'updated'>('priority');
  const [requirementStatus, setRequirementStatus] = useState('');
  const [defectStatus, setDefectStatus] = useState('');
  const [versionSort, setVersionSort] = useState<'name' | 'updated'>('name');
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingReq, setLoadingReq] = useState(true);
  const [loadingDefect, setLoadingDefect] = useState(true);
  const [loadingVersion, setLoadingVersion] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { options: fieldOptions } = useFieldOptions();

  useEffect(() => {
    const fetchOverview = async (): Promise<void> => {
      try {
        const overviewRes = await getWorkbenchOverview();
        setOverview(overviewRes);
      } catch (err) {
        logger.error('工作台概览加载失败', err);
        setError('数据加载失败，请稍后重试');
      } finally {
        setLoadingOverview(false);
      }
    };
    void fetchOverview();
  }, []);

  useEffect(() => {
    setLoadingReq(true);
    getMyRequirements(
      requirementPage,
      PAGE_SIZE,
      requirementSort === 'priority' ? 'priority' : undefined,
      requirementStatus || undefined,
    )
      .then((response) => {
        setRequirements(response.items);
        setRequirementTotal(response.total);
      })
      .catch((err: unknown) => logger.error('工作台需求加载失败', err))
      .finally(() => setLoadingReq(false));
  }, [requirementPage, requirementSort, requirementStatus]);

  useEffect(() => {
    setLoadingDefect(true);
    getMyDefects(
      defectPage,
      PAGE_SIZE,
      defectSort === 'priority' ? 'priority' : undefined,
      defectStatus || undefined,
    )
      .then((response) => {
        setDefects(response.items);
        setDefectTotal(response.total);
      })
      .catch((err: unknown) => logger.error('工作台缺陷加载失败', err))
      .finally(() => setLoadingDefect(false));
  }, [defectPage, defectSort, defectStatus]);

  useEffect(() => {
    setLoadingVersion(true);
    getMyVersions(versionPage, PAGE_SIZE, versionSort === 'name' ? 'name' : undefined)
      .then((response) => {
        setVersions(response.items);
        setVersionTotal(response.total);
      })
      .catch((err: unknown) => logger.error('工作台版本加载失败', err))
      .finally(() => setLoadingVersion(false));
  }, [versionPage, versionSort]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-[1400px] mx-auto space-y-6"
    >
      {/* 顶部问候 */}
      <WorkbenchGreeting />

      {error && (
        <div className="rounded-sm border border-[hsl(4_50%_75%)] bg-[hsl(4_60%_97%)] p-3 text-sm text-[hsl(4_70%_35%)]">
          {error}
        </div>
      )}

      {/* 统计卡片 */}
      <section>
        <WorkbenchStats overview={loadingOverview ? null : overview} />
      </section>

      {/* 双列：需求 + 缺陷 */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h2 className="font-heading text-base font-semibold text-foreground">
              与我相关的需求
            </h2>
            <div className="flex items-center gap-3">
              <select
                className="h-7 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                value={requirementStatus}
                onChange={(event) => {
                  setRequirementStatus(event.target.value);
                  setRequirementPage(1);
                }}
              >
                <option value="">全部状态</option>
                {REQUIREMENT_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select className="h-7 rounded-sm border border-border bg-card px-2 text-xs text-foreground" value={requirementSort} onChange={(event) => { setRequirementSort(event.target.value as 'priority' | 'updated'); setRequirementPage(1); }}>
                <option value="priority">优先级排序</option>
                <option value="updated">最近更新</option>
              </select>
              <span className="text-xs text-muted-foreground font-mono">{loadingReq ? '--' : requirementTotal} 条</span>
            </div>
          </div>
          <RequirementList items={requirements} loading={loadingReq} />
          <ListPager page={requirementPage} total={requirementTotal} onPageChange={setRequirementPage} />
        </div>

        <div className="rounded-sm border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
            <h2 className="font-heading text-base font-semibold text-foreground">
              与我相关的缺陷
            </h2>
            <div className="flex items-center gap-3">
              <select
                className="h-7 rounded-sm border border-border bg-card px-2 text-xs text-foreground"
                value={defectStatus}
                onChange={(event) => {
                  setDefectStatus(event.target.value);
                  setDefectPage(1);
                }}
              >
                <option value="">全部状态</option>
                {(fieldOptions.defect_status || []).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select className="h-7 rounded-sm border border-border bg-card px-2 text-xs text-foreground" value={defectSort} onChange={(event) => { setDefectSort(event.target.value as 'priority' | 'updated'); setDefectPage(1); }}>
                <option value="priority">优先级排序</option>
                <option value="updated">最近更新</option>
              </select>
              <span className="text-xs text-muted-foreground font-mono">{loadingDefect ? '--' : defectTotal} 条</span>
            </div>
          </div>
          <DefectList items={defects} loading={loadingDefect} />
          <ListPager page={defectPage} total={defectTotal} onPageChange={setDefectPage} />
        </div>
      </section>

      <section>
        {currentUserId ? (
          <PersonnelGanttPage fixedPersonId={currentUserId} embedded />
        ) : (
          <div className="rounded-sm border border-border bg-card p-5 text-sm text-muted-foreground">
            未获取到当前用户信息，暂时无法加载个人排期。
          </div>
        )}
      </section>

      {/* 我参与的版本 */}
      <section className="rounded-sm border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <h2 className="font-heading text-base font-semibold text-foreground">
            我参与的版本
          </h2>
          <div className="flex items-center gap-3">
            <select className="h-7 rounded-sm border border-border bg-card px-2 text-xs text-foreground" value={versionSort} onChange={(event) => { setVersionSort(event.target.value as 'name' | 'updated'); setVersionPage(1); }}>
              <option value="name">名称排序</option>
              <option value="updated">最近更新</option>
            </select>
            <span className="text-xs text-muted-foreground font-mono">{loadingVersion ? '--' : versionTotal} 个</span>
          </div>
        </div>
        <VersionList items={versions} loading={loadingVersion} />
        <ListPager page={versionPage} total={versionTotal} onPageChange={setVersionPage} />
      </section>
    </motion.div>
  );
};

export default WorkbenchPage;
