import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RowActions } from '@/components/RowActions';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';

import {
  getVersionList,
  createVersion,
  updateVersion,
  deleteVersion,
  getVersionRequirements,
  getVersionSummary,
} from '@/api/version';
import type { MainVersion, UpdateVersionDto } from '@shared/api.interface';
import {
  getPriorityInfo,
  getStatusInfo,
  getVersionTypeInfo,
  isHighRisk,
  formatDate,
} from '@/utils/version-helpers';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { toast } from 'sonner';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type SortField =
  | 'versionName'
  | 'appStatus'
  | 'priority';
type SortOrder = 'asc' | 'desc';

interface FilterTags {
  status?: string;
  versionType?: string;
  priority?: string;
}

const toDateInputValue = (value?: string) => value ? value.slice(0, 10) : '';

const VersionListPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MainVersion[]>([]);
  const [total, setTotal] = useState(0);

  // 筛选器状态
  const [status, setStatus] = useState<string>('');
  const [versionType, setVersionType] = useState<string>('');
  const [priority, setPriority] = useState<string>('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');

  const [sortField, setSortField] = useState<SortField>('versionName');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const { options: fieldOptions } = useFieldOptions();
  const statusOptions = fieldOptions['version_status'] || [];
  const versionTypeOptions = fieldOptions['version_type'] || [];
  const priorityOptions = fieldOptions['version_priority'] || [];

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MainVersion | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<MainVersion | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const versionSchema = z.object({
    versionName: z.string().min(1, '版本名称不能为空'),
    appStatus: z.string().optional(),
    priority: z.string().optional(),
    versionType: z.string().optional(),
    versionStartDate: z.string().optional(),
    packTime: z.string().optional(),
    expectedTestTime: z.string().optional(),
    versionCloseDate: z.string().optional(),
    actualGrayDate: z.string().optional(),
    actualReleaseDate: z.string().optional(),
    versionDoc: z.string().optional(),
    versionRisk: z.string().optional(),
  });
  type VersionFormData = z.infer<typeof versionSchema>;

  const form = useForm<VersionFormData>({
    resolver: zodResolver(versionSchema),
    defaultValues: {
      versionName: '',
      appStatus: '',
      priority: '',
      versionType: '',
      versionStartDate: '',
      packTime: '',
      expectedTestTime: '',
      versionCloseDate: '',
      actualGrayDate: '',
      actualReleaseDate: '',
      versionDoc: '',
      versionRisk: '',
    },
  });

  const handleCreate = async (data: VersionFormData) => {
    if (!data.versionName) {
      form.setError('versionName', { message: '版本名称不能为空' });
      return;
    }
    try {
      await createVersion({ ...data, versionName: data.versionName });
      toast.success('版本创建成功');
      setDialogOpen(false);
      form.reset();
      fetchList();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || '创建失败';
      toast.error(msg);
    }
  };

  const handleEdit = async (data: VersionFormData) => {
    if (!editingItem) return;
    const payload = Object.fromEntries(
      Object.entries(data).filter(([key, value]) => {
        const previousValue = editingItem[key as keyof VersionFormData];
        return JSON.stringify(value) !== JSON.stringify(previousValue);
      }),
    ) as unknown as UpdateVersionDto;
    if (Object.keys(payload).length === 0) {
      toast.info('未检测到修改');
      return;
    }
    try {
      await updateVersion(editingItem.id, payload);
      toast.success('版本更新成功');
      setDialogOpen(false);
      setEditingItem(null);
      form.reset();
      fetchList();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      const msg = data?.error?.message || data?.message || '更新失败';
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);
    try {
      const [requirements, summary] = await Promise.all([
        getVersionRequirements(deletingItem.id, 1, 1),
        getVersionSummary(deletingItem.id),
      ]);
      if (requirements.total > 0 || summary.testPlanCount > 0) {
        toast.error('版本仍有关联需求或测试计划，无法删除');
        return;
      }
      await deleteVersion(deletingItem.id);
      toast.success('版本已删除');
      setDeleteConfirmOpen(false);
      setDeletingItem(null);
      fetchList();
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })?.response?.data;
      const msg = data?.error?.message || data?.message || '删除失败';
      toast.error(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    form.reset({
      versionName: '',
      appStatus: '',
      priority: '',
      versionType: '',
      versionStartDate: '',
      packTime: '',
      expectedTestTime: '',
      versionCloseDate: '',
      actualGrayDate: '',
      actualReleaseDate: '',
      versionDoc: '',
      versionRisk: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (item: MainVersion) => {
    setEditingItem(item);
    form.reset({
      versionName: item.versionName,
      appStatus: item.appStatus || '',
      priority: item.priority || '',
      versionType: item.versionType || '',
      versionStartDate: toDateInputValue(item.versionStartDate),
      packTime: toDateInputValue(item.packTime),
      expectedTestTime: toDateInputValue(item.expectedTestTime),
      versionCloseDate: toDateInputValue(item.versionCloseDate),
      actualGrayDate: toDateInputValue(item.actualGrayDate),
      actualReleaseDate: toDateInputValue(item.actualReleaseDate),
      versionDoc: item.versionDoc || '',
      versionRisk: item.versionRisk || '',
    });
    setDialogOpen(true);
  };

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getVersionList({
        page,
        pageSize,
        status: status || undefined,
        versionType: versionType || undefined,
        priority: priority || undefined,
        keyword: keyword || undefined,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      logger.error('版本列表加载失败', err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, versionType, priority, keyword]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // 筛选条件变化时回到第一页
  useEffect(() => {
    setPage(1);
  }, [status, versionType, priority, keyword]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedItems = useMemo(() => {
    const arr = [...items];
    arr.sort((a, b) => {
      const av = a[sortField] || '';
      const bv = b[sortField] || '';
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortOrder === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [items, sortField, sortOrder]);

  const filterTags: Array<{ key: keyof FilterTags; label: string; value: string }> = [];
  if (status) filterTags.push({ key: 'status', label: '状态', value: status });
  if (versionType) filterTags.push({ key: 'versionType', label: '版本类型', value: versionType });
  if (priority) filterTags.push({ key: 'priority', label: '优先级', value: priority });
  if (keyword) filterTags.push({ key: 'status' as const, label: '关键词', value: keyword });

  const removeFilter = (key: keyof FilterTags, value: string) => {
    if (key === 'status' && value === keyword && keyword) {
      setKeyword('');
      setKeywordInput('');
      return;
    }
    switch (key) {
      case 'status':
        setStatus('');
        break;
      case 'versionType':
        setVersionType('');
        break;
      case 'priority':
        setPriority('');
        break;
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
  };

  const handleRowClick = (id: string) => {
    navigate(`/versions/${id}`);
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronUp className="size-3 opacity-20" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="size-3 text-primary" />
      : <ChevronDown className="size-3 text-primary" />;
  };

  return (
    <div className="flex flex-col gap-4">
      {/* 筛选栏 */}
      <div className="rounded-sm border border-border bg-card p-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">状态</span>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              {statusOptions.map((s: string) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">优先级</span>
          <Select value={priority} onValueChange={setPriority}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              {priorityOptions.map((s: string) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">版本类型</span>
          <Select value={versionType} onValueChange={setVersionType}>
            <SelectTrigger size="sm" className="w-[140px]">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              {versionTypeOptions.map((s: string) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button size="sm" variant="default" onClick={openCreateDialog}>
          新建版本
        </Button>

        <form onSubmit={handleSearch} className="flex items-center gap-2 ml-auto">
          <div className="relative w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              placeholder="搜索版本名称..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="default">
            搜索
          </Button>
        </form>
      </div>

      {/* 已选筛选标签 */}
      {filterTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="text-xs text-muted-foreground">已选：</span>
          {filterTags.map((t: { key: keyof FilterTags; label: string; value: string }, i: number) => (
            <Badge
              key={`${t.key}-${t.value}-${i}`}
              variant="secondary"
              className="gap-1.5 h-5 px-2 text-xs font-normal animate-grow-in"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              {t.label}：{t.value}
              <button
                type="button"
                onClick={() => removeFilter(t.key, t.value)}
                className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5 transition-colors"
                aria-label={`移除${t.label}`}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2"
            onClick={() => {
              setStatus('');
              setVersionType('');
              setPriority('');
              setKeyword('');
              setKeywordInput('');
            }}
          >
            清空
          </Button>
        </div>
      )}

      {/* 表格 */}
      <div className="rounded-sm border border-border bg-card overflow-x-clip overflow-y-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[220px] cursor-pointer select-none" onClick={() => handleSort('versionName')}>
                <span className="inline-flex items-center gap-1">
                  版本名称
                  <SortIcon field="versionName" />
                </span>
              </TableHead>
              <TableHead className="w-[100px] cursor-pointer select-none" onClick={() => handleSort('appStatus')}>
                <span className="inline-flex items-center gap-1">
                  状态
                  <SortIcon field="appStatus" />
                </span>
              </TableHead>
              <TableHead className="w-[70px] cursor-pointer select-none" onClick={() => handleSort('priority')}>
                <span className="inline-flex items-center gap-1">
                  优先级
                  <SortIcon field="priority" />
                </span>
              </TableHead>
              <TableHead className="w-[100px]">版本类型</TableHead>
              <TableHead className="w-[120px]">开始日期</TableHead>
              <TableHead className="w-[120px]">打包时间</TableHead>
              <TableHead className="w-[120px]">预计提测</TableHead>
              <TableHead className="w-[120px]">灰度日期</TableHead>
              <TableHead className="w-[120px]">实际发布</TableHead>
              <TableHead className="w-[120px]">关闭日期</TableHead>
              <TableHead className="min-w-[200px]">版本风险</TableHead>
              <TableHead className="w-[120px]">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && items.length === 0
              ? Array.from({ length: 8 }).map((_, i: number) => (
                <TableRow key={i}>
                  {Array.from({ length: 12 }).map((_, j: number) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
              : sortedItems.map((v: MainVersion, idx: number) => {
                const statusInfo = getStatusInfo(v.appStatus);
                const prio = getPriorityInfo(v.priority);
                const versionTypeInfo = getVersionTypeInfo(v.versionType);
                const highRisk = isHighRisk(v);
                const isEven = idx % 2 === 1;
                return (
                  <TableRow
                    key={v.id}
                    onClick={() => handleRowClick(v.id)}
                    className={[
                      'cursor-pointer group relative transition-all duration-200',
                      isEven ? 'bg-muted/10' : '',
                      'hover:bg-accent/70 hover:[&>td]:translate-x-[2px] [&>td]:transition-transform [&>td]:duration-200',
                    ].join(' ')}
                    style={{
                      animation: `fade-slide-in 0.3s ease-out both`,
                      animationDelay: `${idx * 50}ms`,
                    }}
                  >
                    <TableCell className="font-medium font-heading text-foreground pl-3">
                      <span className="relative">
                        <span
                          className="absolute -left-2 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          aria-hidden
                        />
                        {v.versionName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={[
                          'h-[22px] px-2 text-xs font-medium rounded-full',
                          statusInfo.className,
                        ].join(' ')}
                      >
                        <span className={`size-1.5 rounded-full mr-1.5 ${statusInfo.dot}`} />
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span
                        className={[
                          'inline-flex items-center h-[22px] px-2 rounded-full text-xs font-semibold border',
                          prio.bg,
                          prio.fg,
                          prio.border,
                        ].join(' ')}
                      >
                        {prio.label}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={[
                          'inline-flex items-center h-[22px] px-2 rounded-full text-xs font-semibold border',
                          versionTypeInfo.bg,
                          versionTypeInfo.fg,
                          versionTypeInfo.border,
                        ].join(' ')}
                      >
                        {versionTypeInfo.label}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {formatDate(v.versionStartDate)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {formatDate(v.packTime)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {formatDate(v.expectedTestTime)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {v.actualGrayDate ? formatDate(v.actualGrayDate) : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {v.actualReleaseDate ? formatDate(v.actualReleaseDate) : '-'}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground/80">
                      {formatDate(v.versionCloseDate)}
                    </TableCell>
                    <TableCell>
                      {highRisk ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-sm bg-destructive/10 text-destructive text-xs animate-pulse-soft">
                          <AlertTriangle className="size-3.5 shrink-0" />
                          <span className="truncate max-w-[160px]">
                            {v.versionRisk || '高风险'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">
                          {v.versionRisk || '无'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <RowActions
                        label={`版本：${v.versionName}`}
                        onEdit={() => openEditDialog(v)}
                        onDelete={() => {
                          setDeletingItem(v);
                          setDeleteConfirmOpen(true);
                        }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            {!loading && sortedItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                  {filterTags.length > 0 ? '无对应内容' : '暂无版本数据'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 分页 */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-card">
          <div className="text-xs text-muted-foreground">
            共 <span className="font-mono font-medium text-foreground">{total}</span> 条，第{' '}
            <span className="font-mono font-medium text-foreground">{page}</span> / {totalPages} 页
          </div>
          <Pagination className="w-auto justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page === 1 ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i: number) => {
                const pageNum = i + 1;
                // 仅显示当前页附近页码
                if (
                  totalPages > 7 &&
                  pageNum !== 1 &&
                  pageNum !== totalPages &&
                  Math.abs(pageNum - page) > 2
                ) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return (
                      <PaginationItem key={pageNum}>
                        <span className="text-muted-foreground px-2">...</span>
                      </PaginationItem>
                    );
                  }
                  return null;
                }
                return (
                  <PaginationItem key={pageNum}>
                    <PaginationLink
                      isActive={page === pageNum}
                      onClick={() => setPage(pageNum)}
                      className="cursor-pointer"
                    >
                      {pageNum}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={page === totalPages ? 'pointer-events-none opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) { setDialogOpen(false); setEditingItem(null); form.reset(); }
        else setDialogOpen(true);
      }}>
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑版本' : '新建版本'}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(editingItem ? handleEdit : handleCreate)} className="space-y-4">
              <FormField control={form.control} name="versionName" render={({ field }) => (
                <FormItem>
                  <FormLabel>版本名称 <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="请输入版本名称" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="appStatus" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>版本状态</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {statusOptions.map((s: string) => (
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
              <FormField control={form.control} name="versionType" render={({ field }) => (
                <FormItem>
                  <FormLabel>版本类型</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="请选择" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {versionTypeOptions.map((s: string) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="versionStartDate" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>开始日期</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="packTime" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>打包时间</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="expectedTestTime" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>预计提测时间</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="versionCloseDate" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>关闭日期</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="flex flex-wrap gap-4">
                <FormField control={form.control} name="actualGrayDate" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>灰度日期</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="actualReleaseDate" render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel>实际发布日期</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="versionDoc" render={({ field }) => (
                <FormItem>
                  <FormLabel>版本文档</FormLabel>
                  <FormControl><Textarea placeholder="版本相关文档链接或说明" className="resize-none" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="versionRisk" render={({ field }) => (
                <FormItem>
                  <FormLabel>版本风险</FormLabel>
                  <FormControl><Textarea placeholder="版本风险说明" className="resize-none" rows={2} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => { setDialogOpen(false); setEditingItem(null); form.reset(); }}>
                  取消
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
                  {form.formState.isSubmitting ? '提交中…' : editingItem ? '保存' : '创建'}
                </Button>
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
            确定要删除版本「{deletingItem?.versionName}」吗？此操作不可撤销。
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setDeletingItem(null); }}>
              取消
            </Button>
            <Button variant="default" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? '删除中…' : '确认删除'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        @keyframes fade-slide-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default VersionListPage;
