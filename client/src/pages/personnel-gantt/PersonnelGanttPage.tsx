import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import dayjs, { type Dayjs } from 'dayjs';

import { searchUsers } from '@/components/business-ui/api/users/service';
import type { UserInput } from '@/components/business-ui/types/user';
import { getRequirementList } from '@/api/requirement';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UserSelect } from '@/components/business-ui/user-select';
import { searchUserInfoToUser } from '@/components/business-ui/user-select/utils';
import type { SubRequirementItem, SubRequirementListResponse, VersionRequirement } from '@shared/api.interface';
import { GANTT_PRIORITIES, GANTT_STATUSES, PersonnelGanttChart } from './PersonnelGanttChart';

type GanttView = 'week' | 'month' | 'quarter' | 'year';

const VIEW_OPTIONS: Array<{ key: GanttView; label: string }> = [
  { key: 'week', label: '周' },
  { key: 'month', label: '月' },
  { key: 'quarter', label: '季度' },
  { key: 'year', label: '年' },
];

function getViewRange(anchor: Dayjs, view: GanttView) {
  if (view === 'week') {
    return { start: anchor.startOf('week'), end: anchor.endOf('week'), label: `${anchor.startOf('week').format('YYYY/MM/DD')} - ${anchor.endOf('week').format('MM/DD')}` };
  }
  if (view === 'quarter') {
    const quarterStartMonth = Math.floor(anchor.month() / 3) * 3;
    const start = anchor.month(quarterStartMonth).startOf('month');
    return { start, end: start.add(2, 'month').endOf('month'), label: `${start.format('YYYY')} 年 Q${Math.floor(quarterStartMonth / 3) + 1}` };
  }
  if (view === 'year') {
    return { start: anchor.startOf('year'), end: anchor.endOf('year'), label: anchor.format('YYYY 年') };
  }
  return { start: anchor.startOf('month'), end: anchor.endOf('month'), label: anchor.format('YYYY 年 MM 月') };
}

const PersonnelGanttPage = () => {
  const [subReqs, setSubReqs] = useState<SubRequirementItem[]>([]);
  const [requirements, setRequirements] = useState<VersionRequirement[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserInput>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterPerson, setFilterPerson] = useState<string | null>(null);
  const [view, setView] = useState<GanttView>('month');
  const [currentDate, setCurrentDate] = useState(() => dayjs());

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const res = await axiosForBackend({
          url: '/api/sub-requirements?page=1&pageSize=1000',
          method: 'GET',
        });
        const data: SubRequirementListResponse = res.data;
        if (!cancelled) {
          setSubReqs(data.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          logger.error('加载子需求列表失败', err);
          setError('数据加载失败，请稍后重试');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadRequirements = async (): Promise<void> => {
      try {
        const data = await getRequirementList({ page: 1, pageSize: 1000 });
        if (!cancelled) setRequirements(data.items ?? []);
      } catch (err) {
        logger.error('加载父需求列表失败', err);
      }
    };
    void loadRequirements();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadUsers = async (): Promise<void> => {
      try {
        const response = await searchUsers({ query: '', pageSize: 500 });
        if (cancelled) return;
        const userList = response?.data?.userList ?? [];
        const profiles = userList.reduce<Record<string, UserInput>>((result, user) => {
          const normalized = searchUserInfoToUser(user, 'apaas');
          if (normalized.id && normalized.raw) result[normalized.id] = normalized.raw;
          return result;
        }, {});
        setUserProfiles(profiles);
      } catch (err) {
        logger.error('加载人员目录失败', err);
      }
    };
    void loadUsers();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!filterPerson) return subReqs;
    return subReqs.filter((item) => item.appCurrentOwner === filterPerson);
  }, [subReqs, filterPerson]);

  const range = useMemo(() => getViewRange(currentDate, view), [currentDate, view]);
  const viewItems = useMemo(() => {
    return filtered.filter((item) => {
      if (!item.appExpectedStartDate) return false;
      const endDate = item.appExpectedEndDate || item.appExpectedStartDate;
      return !dayjs(endDate).isBefore(range.start, 'day')
        && !dayjs(item.appExpectedStartDate).isAfter(range.end, 'day');
    });
  }, [filtered, range]);

  const personIds = useMemo(
    () => filterPerson
      ? [filterPerson]
      : Array.from(new Set([
        ...Object.keys(userProfiles),
        ...subReqs.map((item) => item.appCurrentOwner).filter(Boolean),
      ])),
    [filterPerson, subReqs, userProfiles],
  );

  const moveView = (amount: number) => {
    setCurrentDate((date) => {
      if (view === 'week') return date.add(amount, 'week');
      if (view === 'quarter') return date.add(amount * 3, 'month');
      return date.add(amount, view);
    });
  };

  /* ---------- 渲染 ---------- */

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground text-sm">加载中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[hsl(4_75%_52%)] text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 标题 */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground tracking-tight">
          人员排期甘特图
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          按人员查看子需求排期，支持周、月、季度、年度时间视图
        </p>
      </div>

      {/* 筛选区 */}
      <div className="bg-card border border-border rounded-sm p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground font-medium">人员</label>
            <div className="w-48">
              <UserSelect
                value={filterPerson}
                onChange={setFilterPerson}
                placeholder="全部人员"
              />
            </div>
          </div>
          {filterPerson && (
            <Button type="button" variant="outline" size="sm" onClick={() => setFilterPerson(null)}>
              <RotateCcw className="mr-1.5 size-3.5" />
              重置筛选
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-medium text-muted-foreground">优先级：</span>
          {GANTT_PRIORITIES.map((priority) => (
            <div key={priority.key} className="flex items-center gap-1.5">
              <span className={`h-1 w-6 ${priority.lineClassName}`} />
              <span className="text-xs text-muted-foreground">{priority.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-medium text-muted-foreground">状态：</span>
          {GANTT_STATUSES.map((status) => (
            <div key={status.key} className="flex items-center gap-1.5">
              <span className={`size-3 rounded-sm border ${status.className}`} />
              <span className="text-xs text-muted-foreground">{status.label}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="rounded-sm border border-border bg-card">
        <CardHeader className="flex-row items-center justify-between space-y-0 border-b border-border px-4 py-3">
          <CardTitle className="font-mono text-sm font-semibold">{range.label}</CardTitle>
          <div className="flex items-center gap-1">
            <div className="mr-2 flex items-center rounded-sm border border-border p-0.5">
              {VIEW_OPTIONS.map((option) => (
                <Button
                  key={option.key}
                  type="button"
                  variant={view === option.key ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 px-2.5 text-xs"
                  onClick={() => setView(option.key)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={() => moveView(-1)} aria-label="上一时间段">
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setCurrentDate(dayjs())}>今天</Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => moveView(1)} aria-label="下一时间段">
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <PersonnelGanttChart
            rangeStart={range.start}
            rangeEnd={range.end}
            items={viewItems}
            personIds={personIds}
            userProfiles={userProfiles}
            requirements={requirements}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonnelGanttPage;