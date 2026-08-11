import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PriorityBadgeProps {
  priority: string;
  className?: string;
}

const PRIORITY_CONFIG: Record<string, { className: string }> = {
  P0: { className: 'bg-priority-p0 text-priority-p0-foreground border-transparent' },
  P1: { className: 'bg-priority-p1 text-priority-p1-foreground border-transparent' },
  P2: { className: 'bg-priority-p2 text-[hsl(40_100%_12%)] border-transparent' },
  待定: { className: 'bg-transparent text-muted-foreground border-border' },
  历史遗留: { className: 'bg-priority-p3-bg text-priority-p3 border-transparent' },
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] ?? {
    className: 'bg-muted text-muted-foreground border-transparent',
  };

  return (
    <Badge
      className={cn(
        'h-[22px] px-2 rounded-full font-medium text-[11px] tracking-wide',
        config.className,
        className,
      )}
    >
      {priority || '-'}
    </Badge>
  );
}
