import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { UserDisplay } from '@/components/business-ui/user-display';
import { getPriorityInfo } from '@/utils/version-helpers';
import type { VersionRequirement } from '@shared/api.interface';

interface RequirementListProps {
  items: VersionRequirement[];
  loading: boolean;
}

const RequirementList = ({ items, loading }: RequirementListProps) => {
  if (loading && items.length === 0) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i: number) => (
          <div key={i} className="flex items-center gap-3 py-2 px-1">
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-14" />
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        暂无关联需求
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border -mx-2">
      {items.map((req: VersionRequirement, idx: number) => {
        const prio = getPriorityInfo(req.priority);
        return (
          <li
            key={req.id}
            className="px-2 py-2.5 transition-colors hover:bg-accent/40 rounded-sm"
            style={{
              animation: 'req-row-in 0.35s ease-out both',
              animationDelay: `${150 + idx * 60}ms`,
            }}
          >
            <div className="flex items-center gap-3">
              <Link
                to={`/requirements/${req.id}`}
                className="flex-1 min-w-0 text-sm font-medium text-foreground hover:text-primary transition-colors truncate"
              >
                {req.appReqName}
              </Link>

              <div className="shrink-0">
                <UserDisplay userId={req.currentOwner} size="small" showLabel={false} />
              </div>

              <span
                className={[
                  'shrink-0 inline-flex items-center h-[22px] px-2 rounded-full text-[11px] font-semibold border',
                  prio.bg,
                  prio.fg,
                  prio.border,
                ].join(' ')}
              >
                {prio.label}
              </span>

              <Badge variant="secondary" className="shrink-0 h-[22px] text-xs font-normal">
                {req.reqType || '-'}
              </Badge>
            </div>
          </li>
        );
      })}
      <style>{`
        @keyframes req-row-in {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </ul>
  );
};

export { RequirementList };
