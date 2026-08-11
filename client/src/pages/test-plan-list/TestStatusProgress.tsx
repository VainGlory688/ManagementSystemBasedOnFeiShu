import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TestStatusProgressProps {
  status: string;
  className?: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  '未开始': {
    label: '未开始',
    className: 'bg-muted text-muted-foreground border-transparent',
  },
  '待排期': {
    label: '待排期',
    className: 'bg-primary/10 text-primary border-transparent',
  },
  '测试中': {
    label: '测试中',
    className: 'bg-[hsl(38_70%_93%)] text-[hsl(38_90%_42%)] border-transparent',
  },
  '进行中': {
    label: '进行中',
    className: 'bg-[hsl(38_70%_93%)] text-[hsl(38_90%_42%)] border-transparent',
  },
  '已完成': {
    label: '已完成',
    className: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-transparent',
  },
  '已阻塞': {
    label: '已阻塞',
    className: 'bg-severity-fatal-bg text-severity-fatal border-transparent',
  },
  '暂停': {
    label: '暂停',
    className: 'bg-severity-fatal-bg text-severity-fatal border-transparent',
  },
};

export function TestStatusProgress({ status, className }: TestStatusProgressProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: status || '未知',
    className: 'bg-muted text-muted-foreground border-transparent',
  };

  return (
    <Badge variant="outline" className={cn('h-[22px] px-2 text-xs font-medium rounded-full', config.className, className)}>
      {config.label}
    </Badge>
  );
}