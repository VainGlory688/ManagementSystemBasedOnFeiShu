import { cn } from '@/lib/utils';

type LabelBadgeType =
  | 'requirementType'
  | 'businessLine'
  | 'testPlanType'
  | 'environment'
  | 'testingStage';

const CLASS_MAP: Record<LabelBadgeType, Record<string, string>> = {
  requirementType: {
    需求开发迭代: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal',
    版本上线发布: 'bg-success/15 text-success border-success',
    其他流程: 'bg-label-violet-bg text-label-violet border-label-violet',
  },
  businessLine: {
    系统: 'bg-success/15 text-success border-success',
    玩法: 'bg-warning/15 text-warning border-warning',
    活动: 'bg-primary/10 text-primary border-primary',
    其他: 'bg-label-violet-bg text-label-violet border-label-violet',
  },
  testPlanType: {
    需求测试: 'bg-success/15 text-success border-success',
    测试用例: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal',
  },
  environment: {
    线上环境: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal',
    正式环境: 'bg-success/15 text-success border-success',
    定向环境: 'bg-primary/10 text-primary border-primary',
    测试环境: 'bg-label-violet-bg text-label-violet border-label-violet',
  },
  testingStage: {
    生产测试: 'bg-primary/10 text-primary border-primary',
    验收测试: 'bg-success/15 text-success border-success',
    系统测试: 'bg-warning/15 text-warning border-warning',
    压力测试: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal',
  },
};

interface LabelBadgeProps {
  type: LabelBadgeType;
  value?: string;
  className?: string;
}

export function LabelBadge({ type, value, className }: LabelBadgeProps) {
  const label = value || '-';
  const colorClass = CLASS_MAP[type][label] ?? 'bg-muted text-muted-foreground border-border';

  return (
    <span className={cn('inline-flex h-[22px] max-w-full items-center rounded-full border px-2 text-xs font-medium', colorClass, className)}>
      <span className="truncate">{label}</span>
    </span>
  );
}
