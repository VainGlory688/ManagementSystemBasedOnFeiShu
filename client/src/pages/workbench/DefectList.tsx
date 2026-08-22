import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import type { MyDefectItem } from '@shared/api.interface';
import { PillBadge } from '@/pages/defect-list/badge-helpers';

interface DefectListProps {
  items: MyDefectItem[];
  loading: boolean;
}

const severityClassMap: Record<string, string> = {
  致命: 'bg-severity-fatal-bg text-severity-fatal border-severity-fatal/30',
  严重: 'bg-severity-major-bg text-severity-major border-severity-major/30',
  一般: 'bg-severity-normal-bg text-severity-normal border-severity-normal/30',
  轻微: 'bg-severity-minor-bg text-severity-minor border-severity-minor/30',
};

const getSeverityClass = (severity: string): string => {
  return severityClassMap[severity] || severityClassMap.轻微;
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.28 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const DefectList = ({ items, loading }: DefectListProps) => {
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
        暂无与我相关的缺陷
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
      {items.map((item: MyDefectItem) => {
        const isHighRisk = ['致命', '紧急', '严重'].includes(item.severity);
        return (
          <>
            <motion.button
              key={item.id}
              variants={itemVariants}
              type="button"
              onClick={() => navigate(`/defects/${item.id}`)}
              className={`w-full text-left rounded-sm border p-4 transition-all duration-200 hover:pl-[14px] focus:outline-none focus:ring-2 focus:ring-offset-1 group relative overflow-hidden ${
                isHighRisk
                  ? 'border-severity-fatal/40 bg-severity-fatal-bg hover:border-severity-fatal/70 hover:bg-severity-fatal-bg/80 focus:ring-severity-fatal/30'
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent/40 focus:ring-primary/30'
              }`}
            >
              <div className={`absolute left-0 top-0 bottom-0 w-0 transition-all duration-200 group-hover:w-[2px] ${isHighRisk ? 'bg-severity-fatal' : 'bg-primary'}`} />
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 flex-1 min-w-0">
                <h3 className="font-medium text-sm line-clamp-1 flex-1 text-foreground">
                  {item.defectName || '未命名缺陷'}
                </h3>
              </div>
              <span
                className={`shrink-0 inline-flex items-center h-[22px] px-2 rounded-full text-xs font-medium border ${getSeverityClass(
                  item.severity,
                )}`}
              >
                {item.severity || '一般'}
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              {item.relatedVersionName && (
                <span className="inline-flex items-center gap-1">
                  <Layers className="size-3" />
                  <span className="truncate max-w-[120px]">{item.relatedVersionName}</span>
                </span>
              )}
              {item.status && (
              <PillBadge text={item.status} variant="status" />
              )}
            </div>
            </motion.button>
          </>
        );
      })}
    </motion.div>
  );
};

export { DefectList };
