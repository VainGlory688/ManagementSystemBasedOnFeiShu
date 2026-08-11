import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, X } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserDisplay } from '@/components/business-ui/user-display';
import { cn } from '@/lib/utils';

import { getDefectList, createDefect, updateDefect, deleteDefect } from '@/api/defect';
import type { DefectItem, CreateDefectDto, UpdateDefectDto } from '@shared/api.interface';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { UserSelect } from '@/components/business-ui/user-select';
import { LabelBadge } from '@/components/LabelBadge';
import { getRequirementList } from '@/api/requirement';

import SortHeader, { type SortKey, type SortDir } from './SortHeader';
import {
  PillBadge,
  SEVERITY_ORDER,
} from './badge-helpers';
import { useFieldOptions } from '@/hooks/useFieldOptions';

const PAGE_SIZE = 10;

// ---------- DefectListPage ----------

const DefectListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentOwner = searchParams.get('currentOwner') || undefined;

  const { options: fieldOptions } = useFieldOptions();
  const severityList = fieldOptions['defect_severity'] || [];
  const priorityList = fieldOptions['defect_priority'] || [];
  const statusList = fieldOptions['defect_status'] || [];
  const businessLineList = fieldOptions['defect_business_line'] || [];
  const discoveryEnvList =
    fieldOptions['defect_discovery_environment'] || [];
  const rejectReasonList = fieldOptions['defect_reject_reason'] || [];
  const testingStageList = fieldOptions['defect_testing_stage'] || [];

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DefectItem | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<DefectItem | null>(null);

  const defectSchema = z.object({
    defectName: z.string().min(1, '缺陷名称不能为空'),
    status: z.string().optional(),
    severity: z.string().optional(),
    priority: z.string().optional(),
    businessLine: z.string().optional(),
    rejectionReason: z.string().optional(),
    discoveryEnvironment: z.string().optional(),
    testingStage: z.string().optional(),
    currentOwner: z.array(z.string()).optional(),
    detail: z.string().optional(),
    appParentOrder: z.string().optional(),
  });
  type DefectFormData = z.infer<typeof defectSchema>;

  const form = useForm<DefectFormData>({
    resolver: zodResolver(defectSchema),
    defaultValues: {
      defectName: '',
      status: '',
      severity: '',
      priority: '',
      businessLine: '',
      rejectionReason: '',
      discoveryEnvironment: '',
      testingStage: '',
      currentOwner: [],
      detail: '',
      appParentOrder: '',
    },
  });

  const [items, setItems] = useState<DefectItem[]>([]);
  const [parentOrders, setParentOrders] = useState<Array<{ id: string; baseRecordId: string; appReqName: string }>>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [businessLineFilter, setBusinessLineFilter] = useState<string[]>([]);
  const [discoveryEnvFilter, setDiscoveryEnvFilter] = useState<string[]>([]);
  const [testingStageFilter, setTestingStageFilter] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [keywordInput, setKeywordInput] = useState('');

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey | null>('severity');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleCreate = async (data: DefectFormData) => {
    try {
      await createDefect(data as CreateDefectDto);
      toast.success('缺陷创建成功');
      setDialogOpen(false);
      form.reset();
      fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '创建失败';
      toast.error(msg);
    }
  };

  const handleEdit = async (data: DefectFormData) => {
    if (!editingItem) return;
    try {
      await updateDefect(editingItem.id, data as UpdateDefectDto);
      toast.success('缺陷更新成功');
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
      await deleteDefect(deletingItem.id);
      toast.success('缺陷已删除');
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
      defectName: '',
      status: '',
      severity: '',
      priority: '',
      businessLine: '',
      rejectionReason: '',
      discoveryEnvironment: '',
      testingStage: '',
      currentOwner: [],
      detail: '',
      appParentOrder: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: DefectItem) => {
    setEditingItem(item);
    form.reset({
      defectName: item.defectName,
      status: item.status || '',
      severity: item.severity || '',
      priority: item.priority || '',
      businessLine: item.businessLine || '',
      rejectionReason: item.rejectionReason || '',
      discoveryEnvironment: item.discoveryEnvironment || '',
      testingStage: item.testingStage || '',
      currentOwner: item.currentOwner || [],
      detail: item.detail || '',
      appParentOrder: item.appParentOrderRecordId || '',
    });
    setDialogOpen(true);
  };

  const handleSearch = () => {
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  // Client-side sorting
  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    const copy = [...items];
    if (sortKey === 'severity') {
      copy.sort((a: DefectItem, b: DefectItem) => {
        const sa = SEVERITY_ORDER[a.severity] ?? 99;
        const sb = SEVERITY_ORDER[b.severity] ?? 99;
        return sortDir === 'asc' ? sa - sb : sb - sa;
      });
    } else {
      copy.sort((a: DefectItem, b: DefectItem) => {
        const aValue = String((a as unknown as Record<string, string>)[sortKey] || '');
        const bValue = String((b as unknown as Record<string, string>)[sortKey] || '');
        const comparison = aValue.localeCompare(bValue, 'zh-CN');
        return sortDir === 'asc' ? comparison : -comparison;
      });
    }
    return copy;
  }, [items, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const fetchList = () => {
    let cancelled = false;
    setLoading(true);

    const params: Record<string, string> = {
      page: String(page),
      pageSize: String(PAGE_SIZE),
    };
    if (statusFilter.length === 1) params.status = statusFilter[0];
    if (severityFilter.length === 1) params.severity = severityFilter[0];
    if (priorityFilter.length === 1) params.priority = priorityFilter[0];
    if (businessLineFilter.length === 1) params.businessLine = businessLineFilter[0];
    if (discoveryEnvFilter.length === 1) params.discoveryEnvironment = discoveryEnvFilter[0];
    if (testingStageFilter.length === 1) params.testingStage = testingStageFilter[0];
    if (currentOwner) params.currentOwner = currentOwner;
    if (keyword) params.keyword = keyword;

    getDefectList(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('缺陷列表加载失败', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    const cleanup = fetchList();
    return cleanup;
  }, [
    page,
    statusFilter,
    severityFilter,
    priorityFilter,
    businessLineFilter,
    discoveryEnvFilter,
    testingStageFilter,
    currentOwner,
    keyword,
  ]);

  useEffect(() => {
    let cancelled = false;
    getRequirementList({ page: 1, pageSize: 1000 })
      .then((response) => {
        if (!cancelled) setParentOrders(response.items);
      })
      .catch((err: unknown) => logger.error('关联父单列表加载失败', err));
    return () => { cancelled = true; };
  }, []);

  const handleFilterChange = (setter: (v: string[]) => void) => (vals: string[]) => {
    setter(vals);
    setPage(1);
  };

  const filterConfigs = [
    { key: 'status', label: '状态', options: statusList, selected: statusFilter, setSelected: setStatusFilter },
    { key: 'severity', label: '严重程度', options: severityList, selected: severityFilter, setSelected: setSeverityFilter },
    { key: 'priority', label: '优先级', options: priorityList, selected: priorityFilter, setSelected: setPriorityFilter },
    { key: 'businessLine', label: '业务线', options: businessLineList, selected: businessLineFilter, setSelected: setBusinessLineFilter },
    { key: 'discoveryEnv', label: '发现环境', options: discoveryEnvList, selected: discoveryEnvFilter, setSelected: setDiscoveryEnvFilter },
    { key: 'testingStage', label: '测试阶段', options: testingStageList, selected: testingStageFilter, setSelected: setTestingStageFilter },
  ];
  const activeFilters = filterConfigs.filter((config) => config.selected.length > 0);

  const clearAllFilters = () => {
    filterConfigs.forEach((config) => config.setSelected([]));
    setKeyword('');
    setKeywordInput('');
    setPage(1);
  };

  return (
    <>
    <div className="flex flex-col gap-4">
      {/* Title bar */}
      <div className="flex items-end">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground tracking-tight">
            缺陷管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            共 <span className="font-mono text-foreground">{total}</span> 条缺陷
          </p>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex items-center gap-3 flex-wrap">
          {filterConfigs.map((config) => (
            <div key={config.key} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs text-muted-foreground">{config.label}</span>
              <Select
                value={config.selected[0] || ''}
                onValueChange={(value: string) => handleFilterChange(config.setSelected)(value ? [value] : [])}
              >
                <SelectTrigger size="sm" className="w-[160px] h-8">
                  <SelectValue placeholder="全部" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  {config.options.map((option: string) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <Button size="sm" variant="default" onClick={openCreateDialog}>
            新建缺陷
          </Button>
          <form
            className="ml-auto flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              handleSearch();
            }}
          >
            <div className="relative w-[220px]">
              <Input
                placeholder="搜索缺陷名称..."
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            </div>
            <Button type="submit" size="sm" variant="default">搜索</Button>
          </form>
        </div>
        {activeFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-border/60">
            <span className="text-xs text-muted-foreground">已选条件：</span>
            {activeFilters.map((config, index) => (
              <Badge
                key={config.key}
                variant="secondary"
                className="h-[22px] px-2 gap-1 cursor-pointer group animate-grow-in"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => handleFilterChange(config.setSelected)([])}
              >
                <span className="text-[11px] text-muted-foreground">{config.label}:</span>
                <span className="text-[11px] font-medium">{config.selected.join('、')}</span>
                <X className="size-3 text-muted-foreground group-hover:text-destructive transition-colors" />
              </Badge>
            ))}
            <button
              className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={clearAllFilters}
            >
              清空全部
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border rounded-sm overflow-x-clip overflow-y-hidden">
        <div className="overflow-x-clip overflow-y-hidden">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[280px] pl-4">缺陷名称</TableHead>
                <TableHead className="w-[180px]">关联父单</TableHead>
                <SortHeader
                  label="状态"
                  sortKey="status"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[100px]"
                />
                <SortHeader
                  label="严重程度"
                  sortKey="severity"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                />
                <SortHeader
                  label="优先级"
                  sortKey="priority"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[80px]"
                />
                <TableHead className="w-[140px]">当前负责人</TableHead>
                <SortHeader
                  label="业务线"
                  sortKey="businessLine"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[100px]"
                />
                <SortHeader
                  label="发现环境"
                  sortKey="discoveryEnvironment"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[100px]"
                />
                <SortHeader
                  label="测试阶段"
                  sortKey="testingStage"
                  currentKey={sortKey}
                  currentDir={sortDir}
                  onSort={handleSort}
                  className="w-[100px]"
                />
                <TableHead className="w-[100px]">创建人</TableHead>
                <TableHead className="pr-4 text-right">创建时间</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    加载中...
                  </TableCell>
                </TableRow>
              )}
              {!loading && sortedItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                    暂无数据
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                sortedItems.map((item: DefectItem, index: number) => {
                  const isHighRisk = item.severity === '致命' || item.severity === '严重';
                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => navigate(`/defects/${item.id}`)}
                      className={cn(
                        'group cursor-pointer relative transition-all duration-200',
                        'hover:bg-accent/70 hover:[&>td]:translate-x-[2px] [&>td]:transition-transform [&>td]:duration-200',
                        isHighRisk && 'bg-severity-fatal-bg/30'
                      )}
                      style={{
                        opacity: 0,
                        transform: 'translateY(8px)',
                        animation: 'fade-row-in 0.4s ease-out forwards',
                        animationDelay: `${index * 40}ms`,
                      }}
                    >
                      <TableCell className="font-medium text-foreground pl-3 max-w-[280px]">
                        <span className="relative">
                          <span
                            className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            aria-hidden
                          />
                          <span className="block truncate">{item.defectName}</span>
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[180px] text-sm text-foreground">
                        <span className="block truncate">{item.appParentOrderName || '-'}</span>
                      </TableCell>
                      <TableCell>
                        <PillBadge text={item.status} variant="status" />
                      </TableCell>
                      <TableCell>
                        <PillBadge text={item.severity} variant="severity" />
                      </TableCell>
                      <TableCell>
                        <PillBadge text={item.priority} variant="priority" mono />
                      </TableCell>
                      <TableCell>
                        <UserDisplay value={item.currentOwner} size="small" />
                      </TableCell>
                      <TableCell><LabelBadge type="businessLine" value={item.businessLine} /></TableCell>
                      <TableCell><LabelBadge type="environment" value={item.discoveryEnvironment} /></TableCell>
                      <TableCell><LabelBadge type="testingStage" value={item.testingStage} /></TableCell>
                      <TableCell>
                        <UserDisplay value={item.creator} size="small" />
                      </TableCell>
                      <TableCell className="pr-4 text-right font-mono text-xs text-muted-foreground">
                        {new Date(item.createdAt).toLocaleDateString('zh-CN')}
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
                  );
                })}
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
                  aria-disabled={page <= 1}
                  className={cn(page <= 1 && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i: number) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (page <= 3) {
                  pageNum = i + 1;
                } else if (page >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={page === pageNum}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  aria-disabled={page >= totalPages}
                  className={cn(page >= totalPages && 'pointer-events-none opacity-50')}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { setDialogOpen(false); setEditingItem(null); form.reset(); }
        else setDialogOpen(true);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑缺陷' : '新建缺陷'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingItem ? handleEdit : handleCreate)} className="space-y-4">
              <FormField control={form.control} name="defectName" render={({ field }) => (
                <FormItem>
                  <FormLabel>缺陷名称 <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="请输入缺陷名称" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {statusList.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="severity" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>严重程度</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {severityList.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>优先级</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {priorityList.map((s: string) => (
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
                        {businessLineList.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="rejectionReason" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>驳回原因</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {rejectReasonList.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="discoveryEnvironment" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>发现环境</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {discoveryEnvList.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="testingStage" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>测试阶段</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {testingStageList.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="currentOwner" render={({ field }) => (
                <FormItem>
                  <FormLabel>当前负责人</FormLabel>
                  <FormControl>
                    <UserSelect
                      multiple
                      value={field.value || []}
                      onChange={field.onChange}
                      triggerType="search"
                      placeholder="请选择负责人"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="appParentOrder" render={({ field }) => (
                <FormItem>
                  <FormLabel>关联父单</FormLabel>
                  <Select
                    value={field.value || '__none__'}
                    onValueChange={(value) => field.onChange(value === '__none__' ? '' : value)}
                  >
                    <FormControl><SelectTrigger><SelectValue placeholder="请选择关联父单" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="__none__">不关联父单</SelectItem>
                      {parentOrders.map((parentOrder) => (
                        <SelectItem key={parentOrder.id} value={parentOrder.baseRecordId || parentOrder.id}>
                          {parentOrder.appReqName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="detail" render={({ field }) => (
                <FormItem>
                  <FormLabel>缺陷详情</FormLabel>
                  <FormControl><Textarea placeholder="缺陷详细描述" className="resize-none" rows={3} {...field} /></FormControl>
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
            确定要删除缺陷「{deletingItem?.defectName}」吗？此操作不可撤销。
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
    </>
  );
};

export default DefectListPage;
