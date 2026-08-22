import { useNavigate } from 'react-router-dom';
import { Calendar, ClipboardList, Layers } from 'lucide-react';

import { PillBadge } from '@/pages/defect-list/badge-helpers';
import type { MyTestPlanItem } from '@shared/api.interface';

export function TestPlanList({
  items,
  loading,
}: {
  items: MyTestPlanItem[];
  loading: boolean;
}) {
  const navigate = useNavigate();

  if (loading) {
    return <div className="h-40 animate-pulse rounded-sm border border-border bg-muted/30" />;
  }
  if (items.length === 0) {
    return <div className="py-10 text-center text-sm text-muted-foreground">暂无我参与的测试计划</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => navigate(`/test-plans/${item.id}`)}
          className="group relative w-full overflow-hidden rounded-sm border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:bg-accent/40 hover:pl-[14px]"
        >
          <span className="absolute inset-y-0 left-0 w-0 bg-primary transition-all group-hover:w-0.5" />
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <ClipboardList className="size-4 shrink-0 text-primary" />
              <span className="truncate text-sm font-medium text-foreground">{item.planName || '未命名测试计划'}</span>
            </div>
            <PillBadge text={item.priority || '待定'} variant="priority" mono />
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
            {item.relatedVersionName && (
              <span className="inline-flex max-w-[180px] items-center gap-1 truncate">
                <Layers className="size-3 shrink-0" />{item.relatedVersionName}
              </span>
            )}
            {item.testStatus && <PillBadge text={item.testStatus} variant="status" />}
            {item.expectedEndDate && (
              <span className="ml-auto inline-flex items-center gap-1 font-mono">
                <Calendar className="size-3" />
                {new Date(item.expectedEndDate).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
