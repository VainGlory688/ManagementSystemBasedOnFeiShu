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
    版本上线发布: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]',
    其他流程: 'bg-[hsl(270_45%_94%)] text-[hsl(270_45%_38%)] border-[hsl(270_45%_55%)]',
  },
  businessLine: {
    系统: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]',
    玩法: 'bg-[hsl(38_70%_93%)] text-[hsl(38_75%_30%)] border-[hsl(38_90%_50%)]',
    活动: 'bg-primary/10 text-primary border-primary',
    其他: 'bg-[hsl(270_45%_94%)] text-[hsl(270_45%_38%)] border-[hsl(270_45%_55%)]',
  },
  testPlanType: {
    需求测试: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]',
    测试用例: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal',
  },
  environment: {
    线上环境: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal',
    正式环境: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]',
    定向环境: 'bg-primary/10 text-primary border-primary',
    测试环境: 'bg-[hsl(270_45%_94%)] text-[hsl(270_45%_38%)] border-[hsl(270_45%_55%)]',
  },
  testingStage: {
    生产测试: 'bg-primary/10 text-primary border-primary',
    验收测试: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]',
    系统测试: 'bg-[hsl(38_70%_93%)] text-[hsl(38_75%_30%)] border-[hsl(38_90%_50%)]',
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
