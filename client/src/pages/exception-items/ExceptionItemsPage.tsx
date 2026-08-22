import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, CalendarDays, ClipboardList, Loader2, Search } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserDisplay } from '@/components/business-ui/user-display';
import { UserSelect } from '@/components/business-ui/user-select';
import { LabelBadge } from '@/components/LabelBadge';
import { cn } from '@/lib/utils';
import { getPriorityRowClass } from '@/utils/version-helpers';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import RequirementFilterBar from '@/pages/requirement-list/RequirementFilterBar';
import { RequirementStatusBadge } from '@/pages/requirement-list/RequirementStatusBadge';
import {
  getExceptionItems,
  type ExceptionItemsParams,
  type RequirementListParams,
} from '@/api/requirement';
import type {
  ExceptionItemsResponse,
  SubRequirementItem,
  VersionRequirement,
} from '@shared/api.interface';

const EMPTY_RESPONSE: ExceptionItemsResponse = {
  overdueRequirements: [],
  unscheduledOrTodoRequirements: [],
  todayDueSubRequirements: [],
  blockedSubRequirements: [],
};

type ExceptionTab = 'overdue' | 'unscheduled' | 'today-due' | 'blocked';
type SubRequirementParams = Pick<ExceptionItemsParams, 'subPriority' | 'subOwner' | 'subKeyword'>;

function formatDate(value?: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

function getSubRequirementStatusClass(status: string): string {
  if (status === '已完成') {
    return 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-transparent';
  }
  if (['已阻塞', '有风险'].includes(status)) {
    return 'bg-severity-fatal-bg text-severity-fatal border-transparent';
  }
  return 'bg-muted text-muted-foreground border-transparent';
}

function SectionTitle({
  icon: Icon,
  title,
  count,
  tone,
}: {
  icon: typeof AlertTriangle;
  title: string;
  count: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4', tone)} />
        <h2 className="font-heading text-sm font-semibold text-foreground">{title}</h2>
      </div>
      <span className="font-mono text-xs text-muted-foreground">
        {count} 条
      </span>
    </div>
  );
}

function SubRequirementFilterBar({
  params,
  onChange,
}: {
  params: SubRequirementParams;
  onChange: (params: SubRequirementParams) => void;
}) {
  const { options } = useFieldOptions();
  const [keywordInput, setKeywordInput] = useState(params.subKeyword || '');

  const updateParams = (next: SubRequirementParams) => onChange(next);
  const handlePriorityChange = (subPriority: string) => {
    updateParams({ ...params, subPriority: subPriority || undefined });
  };
  const handleOwnerChange = (subOwner: string | null) => {
    updateParams({ ...params, subOwner: subOwner || undefined });
  };
  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    updateParams({ ...params, subKeyword: keywordInput.trim() || undefined });
  };

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-muted-foreground">优先级</span>
          <Select value={params.subPriority || ''} onValueChange={handlePriorityChange}>
            <SelectTrigger className="h-8 w-[160px]" size="sm">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              {(options.sub_req_priority || []).map((priority) => (
                <SelectItem key={priority} value={priority}>{priority}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-muted-foreground">负责人</span>
          <div className="w-[160px]">
            <UserSelect
              value={params.subOwner || null}
              onChange={handleOwnerChange}
              triggerType="search"
              placeholder="全部"
            />
          </div>
        </div>
        <form onSubmit={handleSearch} className="ml-auto flex items-center gap-2">
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="搜索子需求名称..."
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm">搜索</Button>
        </form>
      </div>
    </div>
  );
}

function RequirementTable({
  items,
  emptyText,
}: {
  items: VersionRequirement[];
  emptyText: string;
}) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="w-[40px] px-0" />
          <TableHead className="min-w-[240px]">需求名称</TableHead>
          <TableHead className="w-[140px]">负责人</TableHead>
          <TableHead className="w-[100px]">当前状态</TableHead>
          <TableHead className="w-[90px]">优先级</TableHead>
          <TableHead className="w-[120px]">需求类型</TableHead>
          <TableHead className="w-[120px]">业务线</TableHead>
          <TableHead className="w-[160px]">计划版本</TableHead>
          <TableHead className="w-[150px]">预计完成时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow
              key={item.id}
              className={cn(
                'group cursor-pointer transition-colors hover:bg-accent/70',
                getPriorityRowClass(item.priority),
              )}
              onClick={() => navigate(`/requirements/${item.id}`)}
            >
              <TableCell className="w-[40px] p-0" />
              <TableCell className="min-w-[240px] pl-2 font-medium group-hover:pl-3 transition-all">
                <span className="relative">
                  <span className="absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="block max-w-[300px] truncate" title={item.appReqName}>{item.appReqName}</span>
                </span>
              </TableCell>
              <TableCell>{item.currentOwner ? <UserDisplay value={[item.currentOwner]} size="small" /> : '-'}</TableCell>
              <TableCell><RequirementStatusBadge status={item.currentStatus} /></TableCell>
              <TableCell>{item.priority || '-'}</TableCell>
              <TableCell><LabelBadge type="requirementType" value={item.reqType} /></TableCell>
              <TableCell><LabelBadge type="businessLine" value={item.businessLine} /></TableCell>
              <TableCell className="text-muted-foreground">{item.planningVersionName || '未排期'}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{formatDate(item.estimatedCompletionTime)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

function SubRequirementTable({
  items,
  emptyText,
}: {
  items: SubRequirementItem[];
  emptyText: string;
}) {
  const navigate = useNavigate();

  return (
    <Table>
      <TableHeader>
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableHead className="w-[40px] px-0" />
          <TableHead className="min-w-[260px]">子需求名称</TableHead>
          <TableHead className="w-[180px]">所属需求</TableHead>
          <TableHead className="w-[140px]">负责人</TableHead>
          <TableHead className="w-[100px]">状态</TableHead>
          <TableHead className="w-[100px]">优先级</TableHead>
          <TableHead className="w-[150px]">预计结束时间</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
              {emptyText}
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow
              key={item.id}
              className="group cursor-pointer transition-colors hover:bg-accent/70"
              onClick={() => navigate(`/sub-requirements/${item.id}`)}
            >
              <TableCell className="w-[40px] p-0" />
              <TableCell className="min-w-[260px] pl-2 font-medium group-hover:pl-3 transition-all">
                <span className="relative">
                  <span className="absolute -left-2 top-1/2 h-4 w-0.5 -translate-y-1/2 bg-primary opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="block max-w-[300px] truncate" title={item.appSubRequirementName}>{item.appSubRequirementName}</span>
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.appParentWorkItemName || '-'}</TableCell>
              <TableCell>{item.appCurrentOwner ? <UserDisplay value={[item.appCurrentOwner]} size="small" /> : '-'}</TableCell>
              <TableCell>
                <Badge variant="outline" className={cn('h-[22px] rounded-full px-2 text-xs font-medium', getSubRequirementStatusClass(item.appStatus))}>
                  {item.appStatus || '-'}
                </Badge>
              </TableCell>
              <TableCell>{item.appPriority || '-'}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{formatDate(item.appExpectedEndDate)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

const ExceptionItemsPage = () => {
  const [activeTab, setActiveTab] = useState<ExceptionTab>('overdue');
  const [overdueParams, setOverdueParams] = useState<RequirementListParams>({ page: 1, pageSize: 20 });
  const [unscheduledParams, setUnscheduledParams] = useState<RequirementListParams>({ page: 1, pageSize: 20 });
  const [todayDueParams, setTodayDueParams] = useState<SubRequirementParams>({});
  const [blockedParams, setBlockedParams] = useState<SubRequirementParams>({});
  const [data, setData] = useState<ExceptionItemsResponse>(EMPTY_RESPONSE);
  const [loading, setLoading] = useState(true);
  const activeParams = useMemo<ExceptionItemsParams>(() => (
    activeTab === 'overdue'
      ? overdueParams
      : activeTab === 'unscheduled'
        ? unscheduledParams
        : activeTab === 'today-due'
          ? todayDueParams
          : blockedParams
  ), [activeTab, blockedParams, overdueParams, unscheduledParams, todayDueParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getExceptionItems(activeParams)
      .then((response) => {
        if (!cancelled) setData(response);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          logger.error('加载异常事项失败', error);
          setData(EMPTY_RESPONSE);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeParams]);

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 pb-8">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ExceptionTab)} className="gap-4">
        <TabsList className="h-10 rounded-sm border border-border bg-card p-1">
          <TabsTrigger value="overdue" className="rounded-sm px-4">
            所有逾期事项
          </TabsTrigger>
          <TabsTrigger value="unscheduled" className="rounded-sm px-4">
            未排期或待办事项
          </TabsTrigger>
          <TabsTrigger value="today-due" className="rounded-sm px-4">
            今日到期事项
          </TabsTrigger>
          <TabsTrigger value="blocked" className="rounded-sm px-4">
            流水线阻塞
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'today-due' || activeTab === 'blocked' ? (
        <SubRequirementFilterBar
          params={activeTab === 'today-due' ? todayDueParams : blockedParams}
          onChange={activeTab === 'today-due' ? setTodayDueParams : setBlockedParams}
        />
      ) : (
        <RequirementFilterBar
          params={activeTab === 'overdue' ? overdueParams : unscheduledParams}
          onChange={activeTab === 'overdue' ? setOverdueParams : setUnscheduledParams}
          showCurrentStatusFilter={false}
        />
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center rounded-sm border border-border bg-card">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        activeTab === 'overdue' ? (
          <section className="overflow-hidden rounded-sm border border-border bg-card">
            <SectionTitle icon={AlertTriangle} title="所有逾期事项" count={data.overdueRequirements.length} tone="text-severity-fatal" />
            <RequirementTable items={data.overdueRequirements} emptyText="暂无逾期需求" />
          </section>
        ) : activeTab === 'unscheduled' ? (
          <section className="overflow-hidden rounded-sm border border-border bg-card">
            <SectionTitle icon={ClipboardList} title="未排期或待办事项" count={data.unscheduledOrTodoRequirements.length} tone="text-[hsl(38_90%_42%)]" />
            <RequirementTable items={data.unscheduledOrTodoRequirements} emptyText="暂无未排期或待办需求" />
          </section>
        ) : activeTab === 'today-due' ? (
          <section className="overflow-hidden rounded-sm border border-border bg-card">
            <SectionTitle icon={CalendarDays} title="今日到期事项" count={data.todayDueSubRequirements.length} tone="text-primary" />
            <SubRequirementTable items={data.todayDueSubRequirements} emptyText="今日暂无到期子需求" />
          </section>
        ) : (
          <section className="overflow-hidden rounded-sm border border-border bg-card">
            <SectionTitle icon={AlertTriangle} title="流水线阻塞" count={data.blockedSubRequirements.length} tone="text-severity-fatal" />
            <SubRequirementTable items={data.blockedSubRequirements} emptyText="暂无受阻子需求" />
          </section>
        )
      )}
    </div>
  );
};

export default ExceptionItemsPage;
