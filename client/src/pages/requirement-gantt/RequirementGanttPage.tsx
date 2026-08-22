import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import dayjs, { type Dayjs } from 'dayjs';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { getSubRequirementDetail, updateSubRequirement } from '@/api/sub-requirement';
import { isOptimisticLockConflict } from '../../api/request-error';
import { toast } from 'sonner';
import type {
  MainVersion,
  RequirementListResponse,
  SubRequirementItem,
  SubRequirementListResponse,
  VersionListResponse,
  VersionRequirement,
} from '@shared/api.interface';
import { RequirementGanttChart, REQUIREMENT_GANTT_PRIORITIES, REQUIREMENT_GANTT_STATUSES } from './RequirementGanttChart';

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

const RequirementGanttPage = () => {
  const [requirements, setRequirements] = useState<VersionRequirement[]>([]);
  const [subRequirements, setSubRequirements] = useState<SubRequirementItem[]>([]);
  const [versions, setVersions] = useState<MainVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterVersion, setFilterVersion] = useState('all');
  const [filterBusinessLine, setFilterBusinessLine] = useState('all');
  const [filterRequirementType, setFilterRequirementType] = useState('all');
  const [view, setView] = useState<GanttView>('month');
  const [currentDate, setCurrentDate] = useState(() => dayjs());
  const [pendingReschedule, setPendingReschedule] = useState<{
    item: SubRequirementItem;
    startDate: string;
    endDate: string;
    mode: 'move' | 'extend';
  } | null>(null);
  const [savingReschedule, setSavingReschedule] = useState(false);
  const { options: fieldOptions } = useFieldOptions();

  useEffect(() => {
    let cancelled = false;
    const load = async (): Promise<void> => {
      try {
        const [reqRes, subRes, verRes] = await Promise.all([
          axiosForBackend({ url: '/api/requirements?page=1&pageSize=1000', method: 'GET' }),
          axiosForBackend({ url: '/api/sub-requirements?page=1&pageSize=1000', method: 'GET' }),
          axiosForBackend({ url: '/api/versions?page=1&pageSize=1000', method: 'GET' }),
        ]);
        if (cancelled) return;
        const reqData: RequirementListResponse = reqRes.data;
        const subData: SubRequirementListResponse = subRes.data;
        const verData: VersionListResponse = verRes.data;
        setRequirements(reqData.items ?? []);
        setSubRequirements(subData.items ?? []);
          setVersions([...(verData.items ?? [])].sort((a, b) =>
            a.versionName.localeCompare(b.versionName, 'zh-CN')));
      } catch (loadError) {
        if (!cancelled) {
          logger.error('加载需求甘特图数据失败', loadError);
          setError('数据加载失败，请稍后重试');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const filteredRequirements = useMemo(() => requirements.filter((requirement) => (
    (filterVersion === 'all' || requirement.planningVersionId === filterVersion)
    && (filterBusinessLine === 'all' || requirement.businessLine === filterBusinessLine)
    && (filterRequirementType === 'all' || requirement.reqType === filterRequirementType)
  )), [requirements, filterBusinessLine, filterRequirementType, filterVersion]);

  const businessLines = fieldOptions.req_business_line || [];
  const requirementTypes = fieldOptions.req_type || [];

  const range = useMemo(() => getViewRange(currentDate, view), [currentDate, view]);

  const moveView = (amount: number) => {
    setCurrentDate((date) => {
      if (view === 'week') return date.add(amount, 'week');
      if (view === 'quarter') return date.add(amount * 3, 'month');
      return date.add(amount, view);
    });
  };

  const confirmReschedule = async () => {
    if (!pendingReschedule) return;
    setSavingReschedule(true);
    try {
      const updated = await updateSubRequirement(pendingReschedule.item.id, {
        appExpectedStartDate: pendingReschedule.startDate,
        appExpectedEndDate: pendingReschedule.endDate,
        expectedUpdatedAt: pendingReschedule.item.updatedAt,
      });
      setSubRequirements((items) => items.map((item) => item.id === updated.id ? updated : item));
      setPendingReschedule(null);
      toast.success('子需求排期已更新');
    } catch (saveError) {
      if (isOptimisticLockConflict(saveError)) {
        try {
          const freshItem = await getSubRequirementDetail(pendingReschedule.item.id);
          setSubRequirements((items) => items.map((item) => item.id === freshItem.id ? freshItem : item));
          setPendingReschedule((pending) => pending?.item.id === freshItem.id
            ? { ...pending, item: freshItem }
            : pending);
          toast.info('子需求已被其他人修改，已刷新最新数据，请核对后重新确认');
        } catch (refreshError) {
          logger.error('刷新冲突子需求失败', refreshError);
          toast.error('子需求已被其他人修改，且最新数据加载失败，请稍后刷新页面后重试');
        }
      } else {
        toast.error('保存子需求排期失败，请稍后重试');
      }
    } finally {
      setSavingReschedule(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中...</div>;
  }

  if (error) {
    return <div className="flex h-64 items-center justify-center text-sm text-[hsl(4_75%_52%)]">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">需求排期甘特图</h1>
        <p className="mt-1 text-sm text-muted-foreground">按父需求分组查看子需求排期，支持版本、业务线与时间范围筛选</p>
        <p className="mt-1 text-xs text-muted-foreground">拖动子需求条可整体改期；拖动右侧手柄仅调整结束日期。确认前不会保存，未设置完整起止日期的任务不可拖动。</p>
      </div>

      <div className="rounded-sm border border-border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">版本</label>
            <Select value={filterVersion} onValueChange={setFilterVersion}>
              <SelectTrigger className="w-48"><SelectValue placeholder="全部版本" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部版本</SelectItem>
                {versions.map((version) => <SelectItem key={version.id} value={version.id}>{version.versionName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">业务线</label>
            <Select value={filterBusinessLine} onValueChange={setFilterBusinessLine}>
              <SelectTrigger className="w-48"><SelectValue placeholder="全部业务线" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部业务线</SelectItem>
                {businessLines.map((businessLine) => <SelectItem key={businessLine} value={businessLine}>{businessLine}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">需求类型</label>
            <Select value={filterRequirementType} onValueChange={setFilterRequirementType}>
              <SelectTrigger className="w-48"><SelectValue placeholder="全部需求类型" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部需求类型</SelectItem>
                {requirementTypes.map((requirementType) => (
                  <SelectItem key={requirementType} value={requirementType}>{requirementType}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-medium text-muted-foreground">优先级：</span>
          {REQUIREMENT_GANTT_PRIORITIES.map((priority) => (
            <div key={priority.key} className="flex items-center gap-1.5">
              <span className={`h-1 w-6 ${priority.lineClassName}`} />
              <span className="text-xs text-muted-foreground">{priority.label}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="text-xs font-medium text-muted-foreground">状态：</span>
          {REQUIREMENT_GANTT_STATUSES.map((status) => (
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
          <RequirementGanttChart
            rangeStart={range.start}
            rangeEnd={range.end}
            requirements={filteredRequirements}
            subRequirements={subRequirements}
            onReschedule={(item, startDate, endDate) => setPendingReschedule({ item, startDate, endDate, mode: 'move' })}
            onDurationChange={(item, startDate, endDate) => setPendingReschedule({ item, startDate, endDate, mode: 'extend' })}
          />
        </CardContent>
      </Card>

      <Dialog open={pendingReschedule !== null} onOpenChange={(open) => !open && !savingReschedule && setPendingReschedule(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>{pendingReschedule?.mode === 'extend' ? '确认调整子需求工期' : '确认调整子需求排期'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-foreground">{pendingReschedule?.item.appSubRequirementName}</p>
            <p className="text-muted-foreground">
              {pendingReschedule?.item.appExpectedStartDate.slice(0, 10)} 至 {pendingReschedule?.item.appExpectedEndDate.slice(0, 10)}
              {' → '}
              <span className="font-mono text-foreground">{pendingReschedule?.startDate} 至 {pendingReschedule?.endDate}</span>
            </p>
            <p className="border-l-2 border-warning bg-[hsl(38_70%_93%)] px-3 py-2 text-xs text-[hsl(38_75%_30%)]">
              {pendingReschedule?.mode === 'extend'
                ? '将保持开始日期与负责人不变，仅调整预计结束日期，最短工期为 1 天。确认前不会写入数据。'
                : '将保持工期不变，仅整体移动开始和结束日期。确认前不会写入数据。'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={savingReschedule} onClick={() => setPendingReschedule(null)}>取消</Button>
            <Button disabled={savingReschedule} onClick={() => void confirmReschedule()}>
              {savingReschedule ? '保存中…' : '确认改期'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RequirementGanttPage;
