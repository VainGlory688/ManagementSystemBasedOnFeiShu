import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { UserDisplay } from '@/components/business-ui/user-display';
import { cn } from '@/lib/utils';

import RequirementFilterBar from './RequirementFilterBar';
import { RequirementStatusBadge } from './RequirementStatusBadge';
import { getRequirementList, createRequirement, updateRequirement, deleteRequirement, type RequirementListParams } from '@/api/requirement';
import type { VersionRequirement, CreateRequirementDto, UpdateRequirementDto } from '@shared/api.interface';
import { getVersionList } from '@/api/version';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { RowActions } from '@/components/RowActions';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSelect } from '@/components/business-ui/user-select';
import { LabelBadge } from '@/components/LabelBadge';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { getPriorityRowClass } from '@/utils/version-helpers';

const PAGE_SIZE = 10;

type SortKey =
  | 'appReqName'
  | 'priority'
  | 'reqType'
  | 'businessLine'
  | 'planningVersionName';

const PRIORITY_ORDER: Record<string, number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  待定: 3,
  历史遗留: 4,
};

const getPriorityBadgeClass = (priority: string): string => {
  switch (priority) {
    case 'P0':
      return 'bg-priority-p0 text-priority-p0-foreground border-transparent';
    case 'P1':
      return 'bg-priority-p1 text-priority-p1-foreground border-transparent';
    case 'P2':
      return 'bg-priority-p2 text-[hsl(40_100%_12%)] border-transparent';
    case '待定':
      return 'bg-transparent text-muted-foreground border-border';
    case '历史遗留':
      return 'bg-priority-p3-bg text-priority-p3 border-transparent';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
};

const RequirementListPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { options: fieldOptions } = useFieldOptions();
  const reqPriorityOptions = fieldOptions['req_priority'] || [];
  const reqTypeOptions = fieldOptions['req_type'] || [];
  const businessLineOptions = fieldOptions['req_business_line'] || [];

  // Version options for planningVersion dropdown
  const [versionOptions, setVersionOptions] = useState<Array<{ value: string; label: string }>>([]);
  useEffect(() => {
    getVersionList({ pageSize: 200 }).then((res) => {
      setVersionOptions(res.items.map((v) => ({ value: v.baseRecordId || v.id, label: v.versionName })));
    }).catch(() => {});
  }, []);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VersionRequirement | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<VersionRequirement | null>(null);

  const requirementSchema = z.object({
    appReqName: z.string().min(1, '需求名称不能为空'),
    priority: z.string().optional(),
    reqType: z.string().optional(),
    businessLine: z.string().optional(),
    planningVersion: z.string().optional(),
    currentOwner: z.string().optional().nullable(),
    proposalTime: z.string().optional(),
    estimatedCompletionTime: z.string().optional(),
    description: z.string().optional(),
  });
  type RequirementFormData = z.infer<typeof requirementSchema>;

  const form = useForm<RequirementFormData>({
    resolver: zodResolver(requirementSchema),
    defaultValues: {
      appReqName: '',
      priority: '',
      reqType: '',
      businessLine: '',
      planningVersion: '',
      currentOwner: null,
      proposalTime: '',
      estimatedCompletionTime: '',
      description: '',
    },
  });

  const [params, setParams] = useState<RequirementListParams>({
    page: 1,
    pageSize: PAGE_SIZE,
    planningVersion: searchParams.get('planningVersion') || undefined,
    priority: searchParams.get('priority') || undefined,
    currentOwner: searchParams.get('currentOwner') || undefined,
  });
  const [items, setItems] = useState<VersionRequirement[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchList = () => {
    let cancelled = false;
    setLoading(true);
    getRequirementList(params)
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('加载需求列表失败', err);
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
  }, [params]);

  const sortedItems = useMemo(() => {
    if (!sortKey) return items;
    const copy = [...items];
    copy.sort((a: VersionRequirement, b: VersionRequirement) => {
      const av = String((a as unknown as Record<string, string>)[sortKey] || '');
      const bv = String((b as unknown as Record<string, string>)[sortKey] || '');
      let cmp = 0;
      if (sortKey === 'priority') {
        cmp = (PRIORITY_ORDER[av] ?? 99) - (PRIORITY_ORDER[bv] ?? 99);
      } else {
        cmp = av.localeCompare(bv, 'zh-CN');
      }
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return copy;
  }, [items, sortKey, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = params.page || 1;

  const handleCreate = async (data: RequirementFormData) => {
    try {
      await createRequirement({
        ...data,
        currentOwner: data.currentOwner || undefined,
      } as CreateRequirementDto);
      toast.success('需求创建成功');
      setDialogOpen(false);
      form.reset();
      fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '创建失败';
      toast.error(msg);
    }
  };

  const handleEdit = async (data: RequirementFormData) => {
    if (!editingItem) return;
    try {
      await updateRequirement(editingItem.id, {
        ...data,
        currentOwner: data.currentOwner || undefined,
      } as UpdateRequirementDto);
      toast.success('需求更新成功');
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
      await deleteRequirement(deletingItem.id);
      toast.success('需求已删除');
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
      appReqName: '',
      priority: '',
      reqType: '',
      businessLine: '',
      planningVersion: '',
      currentOwner: null,
      proposalTime: '',
      estimatedCompletionTime: '',
      description: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: VersionRequirement) => {
    setEditingItem(item);
    form.reset({
      appReqName: item.appReqName,
      priority: item.priority || '',
      reqType: item.reqType || '',
      businessLine: item.businessLine || '',
      planningVersion: item.planningVersion || '',
      currentOwner: item.currentOwner || null,
      proposalTime: item.proposalTime || '',
      estimatedCompletionTime: item.estimatedCompletionTime || '',
      description: item.description || '',
    });
    setDialogOpen(true);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const handlePageChange = (page: number) => {
    setParams({ ...params, page });
  };

  const SortHeader = ({
    label,
    sortKey: key,
    className,
  }: {
    label: string;
    sortKey: SortKey;
    className?: string;
  }) => (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={() => handleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey !== key ? (
          <ChevronUp className="size-3 opacity-20" />
        ) : sortOrder === 'asc' ? (
          <ChevronUp className="size-3 text-primary" />
        ) : (
          <ChevronDown className="size-3 text-primary" />
        )}
      </span>
    </TableHead>
  );

  const renderPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('ellipsis');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="h-full flex flex-col" data-ai-section-type="card-list">
      <RequirementFilterBar params={params} onChange={setParams} onCreate={openCreateDialog} />

      <div className="bg-card border border-border rounded-sm overflow-x-clip overflow-y-hidden">
        <div className="overflow-x-clip overflow-y-hidden">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="w-[40px] px-0"></TableHead>
                <SortHeader label="需求名称" sortKey="appReqName" className="min-w-[220px]" />
                <TableHead className="w-[140px]">负责人</TableHead>
                <TableHead className="w-[100px]">当前状态</TableHead>
                <SortHeader label="优先级" sortKey="priority" className="w-[90px]" />
                <SortHeader label="需求类型" sortKey="reqType" className="w-[110px]" />
                <SortHeader label="业务线" sortKey="businessLine" className="w-[110px]" />
                <SortHeader label="计划版本" sortKey="planningVersionName" className="w-[160px]" />
                <TableHead className="w-[160px]">提出时间</TableHead>
                <TableHead className="w-[160px]">预计完成时间</TableHead>
                <TableHead className="w-[120px]">创建人</TableHead>
                <TableHead className="w-[100px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={12} className="text-center py-12">
                    <Loader2 className="size-5 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              )}
              {!loading && sortedItems.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground text-sm">
                    暂无需求数据
                  </TableCell>
                </TableRow>
              )}
              {!loading &&
                sortedItems.map((item: VersionRequirement, idx: number) => {
                  const isP0 = item.priority === 'P0';
                  return (
                    <TableRow
                      key={item.id}
                      className={cn(
                        'cursor-pointer group relative transition-all duration-200',
                        'opacity-0 translate-y-1',
                        'animate-[fade-slide-up_0.3s_ease-out_forwards]',
                        getPriorityRowClass(item.priority),
                        'hover:bg-accent/70 hover:[&>td]:translate-x-[2px] [&>td]:transition-transform [&>td]:duration-200',
                      )}
                      style={{ animationDelay: `${idx * 30}ms` }}
                      onClick={() => navigate(`/requirements/${item.id}`)}
                    >
                                            <TableCell className="p-0 w-[40px]" />
                      <TableCell className="font-medium text-foreground min-w-[220px] pl-2 transition-all duration-200 group-hover:pl-3">
                        <span className="relative">
                          <span
                            className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                            aria-hidden
                          />
                          <span className="block truncate max-w-[260px]" title={item.appReqName}>
                            {item.appReqName}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="w-[140px]">
                        {item.currentOwner && (
                          <UserDisplay value={[item.currentOwner]} size="small" />
                        )}
                      </TableCell>
                      <TableCell className="w-[100px]">
                        <RequirementStatusBadge status={item.currentStatus} />
                      </TableCell>
                      <TableCell className="w-[90px]">
                        <Badge
                          variant="default"
                          className={cn(
                            'h-[22px] px-2 text-[11px] font-semibold rounded-full',
                            getPriorityBadgeClass(item.priority),
                            isP0 && 'animate-pulse-soft',
                          )}
                        >
                          {item.priority || '-'}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-[110px]">
                        <LabelBadge type="requirementType" value={item.reqType} />
                      </TableCell>
                      <TableCell className="w-[110px]">
                        <LabelBadge type="businessLine" value={item.businessLine} />
                      </TableCell>
                      <TableCell className="w-[160px] text-muted-foreground">
                        {item.planningVersionName || '-'}
                      </TableCell>
                      <TableCell className="w-[160px] font-mono text-xs text-muted-foreground">
                        {item.proposalTime
                          ? new Date(item.proposalTime).toLocaleDateString('zh-CN')
                          : '-'}
                      </TableCell>
                      <TableCell className="w-[160px] font-mono text-xs text-muted-foreground">
                        {item.estimatedCompletionTime
                          ? new Date(item.estimatedCompletionTime).toLocaleDateString('zh-CN')
                          : '-'}
                      </TableCell>
                      <TableCell className="w-[120px]">
                        {item.creator && (
                          <UserDisplay value={[item.creator]} size="small" />
                        )}
                      </TableCell>
                      <TableCell className="w-[100px]" onClick={(e) => e.stopPropagation()}>
                        <RowActions
                          label={`需求：${item.appReqName}`}
                          onEdit={() => openEditDialog(item)}
                          onDelete={() => {
                            setDeletingItem(item);
                            setDeleteConfirmOpen(true);
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            共 <span className="font-mono font-medium text-foreground">{total}</span> 条，第{' '}
            <span className="font-mono font-medium text-foreground">{currentPage}</span> / {totalPages} 页
          </div>
          <Pagination className="w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      if (currentPage > 1) handlePageChange(currentPage - 1);
                    }}
                    className={cn(
                      'cursor-pointer',
                      currentPage <= 1 && 'pointer-events-none opacity-50',
                    )}
                  />
                </PaginationItem>
                {renderPageNumbers().map((p, i: number) =>
                  p === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${i}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={p}>
                      <PaginationLink
                        isActive={p === currentPage}
                        onClick={(e: React.MouseEvent) => {
                          e.preventDefault();
                          handlePageChange(p);
                        }}
                        className="cursor-pointer"
                      >
                        {p}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      if (currentPage < totalPages) handlePageChange(currentPage + 1);
                    }}
                    className={cn(
                      'cursor-pointer',
                      currentPage >= totalPages && 'pointer-events-none opacity-50',
                    )}
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
            <DialogTitle>{editingItem ? '编辑需求' : '新建需求'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingItem ? handleEdit : handleCreate)} className="space-y-4">
              <FormField control={form.control} name="appReqName" render={({ field }) => (
                <FormItem>
                  <FormLabel>需求名称 <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="请输入需求名称" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="priority" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>优先级</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {reqPriorityOptions.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reqType" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>需求类型</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {reqTypeOptions.map((s: string) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
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
                <FormField control={form.control} name="planningVersion" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>计划版本</FormLabel>
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
              </div>
              <FormField control={form.control} name="currentOwner" render={({ field }) => (
                <FormItem>
                  <FormLabel>负责人</FormLabel>
                  <FormControl>
                    <UserSelect
                      value={field.value}
                      onChange={field.onChange}
                      triggerType="search"
                      placeholder="请选择负责人"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="proposalTime" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>提出时间</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="estimatedCompletionTime" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>预计完成时间</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="description" render={({ field }) => (
                <FormItem>
                  <FormLabel>描述</FormLabel>
                  <FormControl><Textarea placeholder="需求描述" className="resize-none" rows={3} {...field} /></FormControl>
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
            确定要删除需求「{deletingItem?.appReqName}」吗？此操作不可撤销。
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
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default RequirementListPage;
