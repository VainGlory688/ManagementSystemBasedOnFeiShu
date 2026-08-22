import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
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
import { RowActions } from '@/components/RowActions';
import { UserDisplay } from '@/components/business-ui/user-display';
import { cn } from '@/lib/utils';
import type { SubRequirementItem } from '@shared/api.interface';

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case '已完成':
    case '已上线':
      return 'bg-success/15 text-success border-transparent';
    case '进行中':
    case '开发中':
      return 'bg-priority-p2-bg text-priority-p2 border-transparent';
    case '待开始':
      return 'bg-muted text-muted-foreground border-transparent';
    case '已阻塞':
    case '有风险':
      return 'bg-severity-fatal-bg text-severity-fatal border-transparent';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
};

const getPriorityBadgeClass = (priority: string): string => {
  switch (priority) {
    case 'P0':
      return 'bg-priority-p0-bg text-priority-p0 border-transparent';
    case 'P1':
      return 'bg-priority-p1-bg text-priority-p1 border-transparent';
    case 'P2':
      return 'bg-priority-p2-bg text-priority-p2 border-transparent';
    case '待定':
      return 'bg-transparent text-muted-foreground border-border';
    case '历史遗留':
      return 'bg-priority-p3-bg text-priority-p3 border-transparent';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
};

interface SubRequirementTableProps {
  items: SubRequirementItem[];
  loading?: boolean;
  onEdit?: (item: SubRequirementItem) => void;
  onDelete?: (item: SubRequirementItem) => void;
}

const SubRequirementTable = ({ items, loading, onEdit, onDelete }: SubRequirementTableProps) => {
  const sortedItems = useMemo(() => {
    // Overdue items first, then by priority
    return [...items].sort((a: SubRequirementItem, b: SubRequirementItem) => {
      const overdueDiff = Number(b.appOverdueDays > 0) - Number(a.appOverdueDays > 0);
      if (overdueDiff !== 0) return overdueDiff;
      const pOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
      return (pOrder[a.appPriority] ?? 99) - (pOrder[b.appPriority] ?? 99);
    });
  }, [items]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('zh-CN');
  };

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-[40px] px-0"></TableHead>
            <TableHead className="min-w-[220px]">子需求名称</TableHead>
            <TableHead className="w-[110px]">状态</TableHead>
            <TableHead className="w-[140px]">当前负责人</TableHead>
            <TableHead className="w-[140px]">预计开始</TableHead>
            <TableHead className="w-[140px]">预计结束</TableHead>
            <TableHead className="w-[120px]">逾期天数</TableHead>
            <TableHead className="w-[90px]">优先级</TableHead>
            {(onEdit || onDelete) && <TableHead className="w-[104px] text-right">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={onEdit || onDelete ? 9 : 8} className="text-center py-8 text-muted-foreground text-sm">
                加载中...
              </TableCell>
            </TableRow>
          )}
          {!loading && sortedItems.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={onEdit || onDelete ? 9 : 8} className="text-center py-8 text-muted-foreground text-sm">
                暂无子需求
              </TableCell>
            </TableRow>
          )}
          {!loading &&
            sortedItems.map((item: SubRequirementItem, idx: number) => {
              const isOverdue = item.appOverdueDays > 0;
              return (
                <TableRow
                  key={item.id}
                  className={cn(
                    'group relative transition-all duration-200',
                    'opacity-0 translate-y-1',
                    'animate-[fade-slide-up_0.3s_ease-out_forwards]',
                    isOverdue && 'bg-[hsl(4_60%_95%)/60] hover:bg-[hsl(4_60%_93%)]',
                  )}
                  style={{
                    animationDelay: `${(sortedItems.length - 1 - idx) * 30}ms`,
                  }}
                >
                  <TableCell className="p-0 w-[40px] relative">
                    <span
                      className={cn(
                        'absolute left-0 top-0 bottom-0 w-[2px] bg-primary',
                        'opacity-0 group-hover:opacity-100 transition-opacity duration-200',
                      )}
                    />
                    {isOverdue && (
                      <div className="absolute left-3 top-1/2 -translate-y-1/2">
                        <AlertTriangle
                          className={cn(
                            'size-4 text-destructive origin-bottom animate-warn-swing',
                          )}
                        />
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      to={`/sub-requirements/${item.id}`}
                      className="block truncate max-w-[300px] pl-2 text-foreground hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      title={`查看子需求详情：${item.appSubRequirementName}`}
                    >
                      {item.appSubRequirementName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-[22px] px-2 text-[11px] font-medium rounded-full',
                        getStatusBadgeClass(item.appStatus),
                      )}
                    >
                      {item.appStatus || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.appCurrentOwner && (
                      <UserDisplay value={[item.appCurrentOwner]} size="small" />
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(item.appExpectedStartDate)}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatDate(item.appExpectedEndDate)}
                  </TableCell>
                  <TableCell>
                    {isOverdue ? (
                      <Badge
                        variant="outline"
                        className="h-[22px] px-2 text-[11px] font-semibold rounded-full bg-severity-fatal-bg text-severity-fatal border-transparent"
                      >
                        逾期 {item.appOverdueDays} 天
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-[22px] px-2 text-[11px] font-semibold rounded-full',
                        getPriorityBadgeClass(item.appPriority),
                      )}
                    >
                      {item.appPriority || '-'}
                    </Badge>
                  </TableCell>
                  {(onEdit || onDelete) && (
                    <TableCell className="text-right">
                      <RowActions
                        label={`子需求：${item.appSubRequirementName}`}
                        onEdit={onEdit ? () => onEdit(item) : undefined}
                        onDelete={onDelete ? () => onDelete(item) : undefined}
                      />
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>

      <style>{`
        @keyframes fade-slide-up {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default SubRequirementTable;
