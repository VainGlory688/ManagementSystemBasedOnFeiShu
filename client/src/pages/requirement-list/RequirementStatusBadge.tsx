import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RequirementCurrentStatus } from '@shared/api.interface';

interface RequirementStatusBadgeProps {
  status: RequirementCurrentStatus;
}

const STATUS_CLASS: Record<RequirementCurrentStatus, string> = {
  待拆分: 'bg-muted text-muted-foreground border-transparent',
  进行中: 'bg-warning/15 text-warning border-transparent',
  已完成: 'bg-success/15 text-success border-transparent',
  已逾期: 'bg-severity-fatal-bg text-severity-fatal border-transparent',
};

export function RequirementStatusBadge({ status }: RequirementStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-[22px] rounded-full px-2 text-xs font-medium',
        STATUS_CLASS[status],
      )}
    >
      {status}
    </Badge>
  );
}
