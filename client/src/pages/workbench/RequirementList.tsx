import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Layers } from 'lucide-react';
import type { MyRequirementItem } from '@shared/api.interface';
import { RequirementStatusBadge } from '@/pages/requirement-list/RequirementStatusBadge';

interface RequirementListProps {
  items: MyRequirementItem[];
  loading: boolean;
}

const priorityClassMap: Record<string, string> = {
  P0: 'bg-priority-p0-bg text-priority-p0 border-priority-p0/30',
  P1: 'bg-priority-p1-bg text-priority-p1 border-priority-p1/30',
  P2: 'bg-priority-p2-bg text-priority-p2 border-priority-p2/30',
  待定: 'bg-transparent text-muted-foreground border-border',
  历史遗留: 'bg-priority-p3-bg text-priority-p3 border-priority-p3/30',
};

const getPriorityClass = (priority: string): string => {
  return priorityClassMap[priority?.toUpperCase?.()] || priorityClassMap.待定;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.2 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const RequirementList = ({ items, loading }: RequirementListProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-sm border border-border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        暂无与我相关的需求
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-2"
    >
      {items.map((item: MyRequirementItem) => (
        <motion.button
          key={item.id}
          variants={itemVariants}
          type="button"
          onClick={() => navigate(`/requirements/${item.id}`)}
          className="w-full text-left rounded-sm border border-border bg-card p-4 transition-all duration-200 hover:border-primary/40 hover:bg-accent/40 hover:pl-[14px] focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 group relative overflow-hidden"
        >
          <div className="absolute left-0 top-0 bottom-0 w-0 bg-primary transition-all duration-200 group-hover:w-[2px]" />
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-medium text-sm text-foreground line-clamp-1 flex-1">
              {item.appReqName || '未命名需求'}
            </h3>
            <span
              className={`shrink-0 inline-flex items-center h-[22px] px-2 rounded-full text-xs font-medium border ${getPriorityClass(
                item.priority,
              )}`}
            >
              {item.priority || 'P3'}
            </span>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {item.planningVersionName && (
              <span className="inline-flex items-center gap-1">
                <Layers className="size-3" />
                <span className="truncate max-w-[120px]">{item.planningVersionName}</span>
              </span>
            )}
            {item.appStatus && (
              <RequirementStatusBadge status={item.appStatus} />
            )}
            {item.estimatedCompletionTime && (
              <span className="inline-flex items-center gap-1 font-mono ml-auto">
                <Calendar className="size-3" />
                {new Date(item.estimatedCompletionTime).toLocaleDateString('zh-CN', {
                  month: '2-digit',
                  day: '2-digit',
                })}
              </span>
            )}
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
};

export { RequirementList };
