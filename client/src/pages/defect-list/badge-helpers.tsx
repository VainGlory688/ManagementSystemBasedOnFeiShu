import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Severity level → badge class (order-based, works with any string)
export function severityBadgeClass(severity: string): string {
  switch (severity) {
    case '紧急':
    case '致命':
      return 'bg-severity-fatal-bg text-severity-fatal border-transparent';
    case '严重':
      return 'bg-severity-major-bg text-severity-major border-transparent';
    case '一般':
      return 'bg-severity-normal-bg text-severity-normal border-transparent';
    case '优化':
    case '提示':
      return 'bg-label-violet-bg text-label-violet border-transparent';
    default:
      return 'bg-secondary text-secondary-foreground border-transparent';
  }
}

// Priority → badge class
export function priorityBadgeClass(priority: string): string {
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
      return 'bg-secondary text-secondary-foreground border-transparent';
  }
}

// Status → badge class (keyword-based, works with any string)
export function statusBadgeClass(status: string): string {
  if (status === '新问题') {
    return 'bg-muted text-muted-foreground border-transparent';
  }
  if (status === '提交测试') {
    return 'bg-warning/15 text-warning border-transparent';
  }
  if (status === '测试未通过') {
    return 'bg-severity-fatal-bg text-severity-fatal border-transparent';
  }
  if (status === '已关闭') {
    return 'bg-success/15 text-success border-transparent';
  }
  if (status === '重新打开') {
    return 'bg-label-violet-bg text-label-violet border-transparent';
  }
  // Completed / resolved states
  if (/已修复|验证通过|已关闭|已完成|已解决/.test(status)) {
    return 'bg-success/15 text-success border-transparent';
  }
  // Rejected / blocked states
  if (/已驳回|已拒绝|已阻塞/.test(status)) {
    return 'bg-severity-fatal-bg text-severity-fatal border-transparent';
  }
  // New / in-progress states
  if (/新建|处理中|进行中|新问题|待处理|未开始/.test(status)) {
    return 'bg-warning/15 text-warning border-transparent';
  }
  return 'bg-secondary text-secondary-foreground border-transparent';
}

export const SEVERITY_ORDER: Record<string, number> = {
  致命: 0,
  紧急: 0,
  严重: 1,
  一般: 2,
  提示: 3,
  优化: 3,
};

// Pill badge wrapper
interface PillBadgeProps {
  text: string;
  variant: 'severity' | 'priority' | 'status';
  mono?: boolean;
  className?: string;
}

export function PillBadge({ text, variant, mono, className }: PillBadgeProps) {
  let cls = '';
  if (variant === 'severity') cls = severityBadgeClass(text);
  else if (variant === 'priority') cls = priorityBadgeClass(text);
  else cls = statusBadgeClass(text);

  return (
    <Badge
      variant="outline"
      className={cn(
        'h-[22px] px-2 text-[11px] font-medium rounded-full',
        mono && 'font-mono',
        cls,
        className
      )}
    >
      {text}
    </Badge>
  );
}

export default PillBadge;
