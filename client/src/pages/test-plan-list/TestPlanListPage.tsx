import { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

import { getTestPlanList, createTestPlan, updateTestPlan, deleteTestPlan, type TestPlanListParams } from '@/api/test-plan';
import { getVersionList } from '@/api/version';
import type { TestPlan, CreateTestPlanDto, UpdateTestPlanDto } from '@shared/api.interface';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelect } from '@/components/business-ui/user-select';
import { LabelBadge } from '@/components/LabelBadge';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { cn } from '@/lib/utils';

import { TestStatusProgress } from './TestStatusProgress';
import { ExecutorAvatarStack } from './ExecutorAvatarStack';
import { PriorityBadge } from './PriorityBadge';
import { FilterToolbar, type FilterState } from './FilterToolbar';

type SortKey =
  | 'planName'
  | 'testStatus'
  | 'priority'
  | 'testPlanType'
  | 'businessLine';
type SortOrder = 'asc' | 'desc' | null;

const TestPlanListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const executor = searchParams.get('executor') || undefined;

  const { options: fieldOptions } = useFieldOptions();
  const testStatusOptions = fieldOptions['test_plan_status'] || [];
  const priorityOptions = fieldOptions['test_plan_priority'] || [];
  const testPlanTypeOptions = fieldOptions['test_plan_type'] || [];
  const businessLineOptions = fieldOptions['test_plan_business_line'] || [];

  // Version options for relatedVersion dropdown
  const [versionOptions, setVersionOptions] = useState<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    getVersionList({ pageSize: 200 }).then((res) => {
      setVersionOptions(res.items.map((v) => ({ value: v.baseRecordId || v.id, label: v.versionName })));
    }).catch(() => {});
  }, []);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TestPlan | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<TestPlan | null>(null);

  const testPlanSchema = z.object({
    planName: z.string().min(1, '计划名称不能为空'),
    testStatus: z.string().optional(),
    priority: z.string().optional(),
    testPlanType: z.string().optional(),
    businessLine: z.string().optional(),
    executor: z.array(z.string()).optional(),
    expectedStartDate: z.string().optional(),
    expectedEndDate: z.string().optional(),
    relatedVersion: z.string().optional(),
  });
  type TestPlanFormData = z.infer<typeof testPlanSchema>;

  const form = useForm<TestPlanFormData>({
    resolver: zodResolver(testPlanSchema),
    defaultValues: {
      planName: '',
      testStatus: '',
      priority: '',
      testPlanType: '',
      businessLine: '',
      executor: [],
      expectedStartDate: '',
      expectedEndDate: '',
      relatedVersion: '',
    },
  });

  const [items, setItems] = useState<TestPlan[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);

  const [filters, setFilters] = useState<FilterState>({
    testStatus: '',
    priority: '',
    testPlanType: '',
    businessLine: '',
    planningVersion: '',
  });
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);



  const fetchList = useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const params: TestPlanListParams = {
          page,
          pageSize,
          testStatus: filters.testStatus || undefined,
          priority: filters.priority || undefined,
          testPlanType: filters.testPlanType || undefined,
          businessLine: filters.businessLine || undefined,
          planningVersion: filters.planningVersion || undefined,
          executor,
          keyword: keyword || undefined,
        };
        const response = await getTestPlanList(params);
        setItems(response.items);
        setTotal(response.total);
      } catch (err) {
        logger.error('加载测试计划列表失败', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }, [page, pageSize, filters, executor, keyword]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleKeywordSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilter = (key: keyof TestPlanListParams) => {
    setFilters((prev) => ({ ...prev, [key]: '' }));
    setPage(1);
  };

  const clearAllFilters = () => {
    setFilters({
      testStatus: '',
      priority: '',
      testPlanType: '',
      businessLine: '',
      planningVersion: '',
    });
    setKeyword('');
    setKeywordInput('');
    setPage(1);
  };

  const handleCreate = async (data: TestPlanFormData) => {
    try {
      await createTestPlan(data as unknown as CreateTestPlanDto);
      toast.success('测试计划创建成功');
      setDialogOpen(false);
      form.reset();
      fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '创建失败';
      toast.error(msg);
    }
  };

  const handleEdit = async (data: TestPlanFormData) => {
    if (!editingItem) return;
    try {
      await updateTestPlan(editingItem.id, data as unknown as UpdateTestPlanDto);
      toast.success('测试计划更新成功');
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
      fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '更新失败';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteTestPlan(deletingItem.id);
      toast.success('测试计划已删除');
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
      fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '删除失败';
      toast.error(msg);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    form.reset({
      planName: '',
      testStatus: '',
      priority: '',
      testPlanType: '',
      businessLine: '',
      executor: [],
      expectedStartDate: '',
      expectedEndDate: '',
      relatedVersion: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: TestPlan) => {
    setEditingItem(item);
    form.reset({
      planName: item.planName,
      testStatus: item.testStatus || '',
      priority: item.priority || '',
      testPlanType: item.testPlanType || '',
      businessLine: item.businessLine || '',
      executor: item.executor || [],
      expectedStartDate: item.expectedStartDate || '',
      expectedEndDate: item.expectedEndDate || '',
      relatedVersion: item.relatedVersion || '',
    });
    setDialogOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortOrder('asc');
    } else if (sortOrder === 'asc') {
      setSortOrder('desc');
    } else if (sortOrder === 'desc') {
      setSortKey(null);
      setSortOrder(null);
    } else {
      setSortOrder('asc');
    }
  };

  const sortedItems = useMemo(() => {
    if (!sortKey || !sortOrder) return items;
    const sorted = [...items].sort((a: TestPlan, b: TestPlan) => {
      let aVal: string = '';
      let bVal: string = '';
      switch (sortKey) {
        case 'planName':
          aVal = a.planName;
          bVal = b.planName;
          break;
        case 'priority':
          aVal = a.priority;
          bVal = b.priority;
          break;
        case 'testStatus':
          aVal = a.testStatus;
          bVal = b.testStatus;
          break;
        case 'testPlanType':
          aVal = a.testPlanType;
          bVal = b.testPlanType;
          break;
        case 'businessLine':
          aVal = a.businessLine;
          bVal = b.businessLine;
          break;
      }
      if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [items, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleRowClick = (id: string) => {
    navigate(`/test-plans/${id}`);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ChevronUp className="size-3 opacity-20" />;
    }
    if (sortOrder === 'asc') {
      return <ChevronUp className="size-3 text-primary" />;
    }
    return <ChevronDown className="size-3 text-primary" />;
  };

  return (
    <div className="flex flex-col gap-4" data-ai-section-type="card-list">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold text-foreground">测试计划</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            共 {total} 条测试计划
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <FilterToolbar
        filters={filters}
        keywordInput={keywordInput}
        onKeywordInputChange={setKeywordInput}
        onKeywordSearch={handleKeywordSearch}
        onFilterChange={handleFilterChange}
        onClearFilter={clearFilter}
        onClearAll={clearAllFilters}
        onCreate={openCreateDialog}
        versionOptions={versionOptions}
      />

      {/* Table */}
      <div className="bg-card border border-t-0 border-border rounded-b-sm overflow-x-clip overflow-y-hidden">
        <div className="overflow-x-clip overflow-y-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead
                  className="w-[220px] cursor-pointer select-none"
                  onClick={() => handleSort('planName')}
                >
                  <span className="inline-flex items-center gap-1">
                    计划名称
                    {renderSortIcon('planName')}
                  </span>
                </TableHead>
                <TableHead
                  className="w-[180px] cursor-pointer select-none"
                  onClick={() => handleSort('testStatus')}
                >
                  <span className="inline-flex items-center gap-1">
                    测试状态
                    {renderSortIcon('testStatus')}
                  </span>
                </TableHead>
                <TableHead
                  className="w-[90px] cursor-pointer select-none"
                  onClick={() => handleSort('priority')}
                >
                  <span className="inline-flex items-center gap-1">
                    优先级
                    {renderSortIcon('priority')}
                  </span>
                </TableHead>
                <TableHead
                  className="w-[110px] cursor-pointer select-none"
                  onClick={() => handleSort('testPlanType')}
                >
                  <span className="inline-flex items-center gap-1">
                    计划类型
                    {renderSortIcon('testPlanType')}
                  </span>
                </TableHead>
                <TableHead
                  className="w-[100px] cursor-pointer select-none"
                  onClick={() => handleSort('businessLine')}
                >
                  <span className="inline-flex items-center gap-1">
                    业务线
                    {renderSortIcon('businessLine')}
                  </span>
                </TableHead>
                <TableHead className="w-[140px]">执行人员</TableHead>
                <TableHead className="w-[120px]">预计开始</TableHead>
                <TableHead className="w-[120px]">预计结束</TableHead>
                <TableHead className="w-[160px]">关联版本</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} className="h-40 text-center">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span className="text-sm">加载中...</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {!loading && error && (
                <TableRow>
                  <TableCell colSpan={10} className="h-40 text-center text-destructive text-sm">
                    {error}
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="h-40 text-center text-muted-foreground text-sm">
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
              {!loading && !error && sortedItems.map((item: TestPlan, index: number) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer group relative transition-all duration-200 hover:bg-accent/70 hover:[&>td]:translate-x-[2px] [&>td]:transition-transform [&>td]:duration-200"
                  style={{
                    animation: `fadeInUp 0.3s ease-out ${index * 30}ms both`,
                  }}
                  onClick={() => handleRowClick(item.id)}
                >
                  <TableCell className="font-medium text-foreground pl-3">
                    <span className="relative">
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      {item.planName}
                    </span>
                  </TableCell>
                  <TableCell>
                    <TestStatusProgress status={item.testStatus} />
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={item.priority} />
                  </TableCell>
                  <TableCell><LabelBadge type="testPlanType" value={item.testPlanType} /></TableCell>
                  <TableCell><LabelBadge type="businessLine" value={item.businessLine} /></TableCell>
                  <TableCell>
                    <ExecutorAvatarStack userIds={item.executor} max={3} size="small" />
                  </TableCell>
                  <TableCell className="text-sm font-mono text-foreground/80 tabular-nums">
                    {item.expectedStartDate || '-'}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-foreground/80 tabular-nums">
                    {item.expectedEndDate || '-'}
                  </TableCell>
                  <TableCell className="text-sm text-primary truncate max-w-[160px]">
                    {item.relatedVersionName || item.relatedVersion || '-'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditDialog(item);
                        }}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingItem(item);
                          setDeleteConfirmOpen(true);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            共 <span className="font-mono font-medium text-foreground">{total}</span> 条，第{' '}
            <span className="font-mono font-medium text-foreground">{page}</span> / {totalPages} 页
          </div>
          <Pagination className="w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage(Math.max(1, page - 1))}
                  className={cn(page <= 1 && 'opacity-50 cursor-not-allowed')}
                  aria-disabled={page <= 1}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, i: number) => i + 1)
                .filter((p: number) => {
                  if (totalPages <= 5) return true;
                  if (p === 1 || p === totalPages) return true;
                  if (Math.abs(p - page) <= 1) return true;
                  return false;
                })
                .map((p: number, idx: number, arr: number[]) => {
                  const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                  return (
                    <div key={p} className="flex items-center">
                      {showEllipsis && <span className="px-1 text-muted-foreground">...</span>}
                      <PaginationItem>
                        <PaginationLink
                          isActive={page === p}
                          onClick={() => setPage(p)}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    </div>
                  );
                })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  className={cn(page >= totalPages && 'opacity-50 cursor-not-allowed')}
                  aria-disabled={page >= totalPages}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { setDialogOpen(false); setEditingItem(null); form.reset(); }
        else setDialogOpen(true);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑测试计划' : '新建测试计划'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingItem ? handleEdit : handleCreate)} className="space-y-4">
              <FormField control={form.control} name="planName" render={({ field }) => (
                <FormItem>
                  <FormLabel>计划名称 <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="请输入计划名称" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="testStatus" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>测试状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {testStatusOptions.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>优先级</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {priorityOptions.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="testPlanType" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>计划类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {testPlanTypeOptions.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="businessLine" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>业务线</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {businessLineOptions.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="executor" render={({ field }) => (
                <FormItem>
                  <FormLabel>执行人员</FormLabel>
                  <FormControl>
                    <UserSelect
                      multiple
                      value={field.value || []}
                      onChange={field.onChange}
                      triggerType="search"
                      placeholder="请选择执行人员"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="expectedStartDate" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>预计开始日期</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expectedEndDate" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>预计结束日期</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="relatedVersion" render={({ field }) => (
                <FormItem>
                  <FormLabel>关联版本</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {versionOptions.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null); form.reset(); }}>
                  取消
                </Button>
                <Button type="submit">{editingItem ? '保存' : '创建'}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            确定要删除测试计划「{deletingItem?.planName}」吗？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setDeletingItem(null); }}>
              取消
            </Button>
            <Button variant="default" onClick={handleDelete}>
              确认删除
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TestPlanListPage;
