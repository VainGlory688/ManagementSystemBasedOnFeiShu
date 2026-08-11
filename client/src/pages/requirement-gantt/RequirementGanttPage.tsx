import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';
import { axiosForBackend } from '@lark-apaas/client-toolkit/utils/getAxiosForBackend';
import dayjs, { type Dayjs } from 'dayjs';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
        setVersions(verData.items ?? []);
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

  const businessLines = useMemo(() => {
    const lines = new Set<string>();
    requirements.forEach((requirement) => {
      if (requirement.businessLine) lines.add(requirement.businessLine);
    });
    return Array.from(lines).sort();
  }, [requirements]);

  const requirementTypes = useMemo(() => {
    const types = new Set<string>();
    requirements.forEach((requirement) => {
      if (requirement.reqType) types.add(requirement.reqType);
    });
    return Array.from(types).sort();
  }, [requirements]);

  const range = useMemo(() => getViewRange(currentDate, view), [currentDate, view]);

  const moveView = (amount: number) => {
    setCurrentDate((date) => {
      if (view === 'week') return date.add(amount, 'week');
      if (view === 'quarter') return date.add(amount * 3, 'month');
      return date.add(amount, view);
    });
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
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default RequirementGanttPage;
