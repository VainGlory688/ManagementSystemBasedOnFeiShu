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
  致命: 'bg-[hsl(4_60%_95%)] text-[hsl(4_75%_42%)] border-[hsl(4_50%_82%)]',
  严重: 'bg-[hsl(28_70%_94%)] text-[hsl(28_80%_45%)] border-[hsl(28_60%_85%)]',
  一般: 'bg-[hsl(45_70%_95%)] text-[hsl(45_80%_42%)] border-[hsl(45_60%_85%)]',
  轻微: 'bg-[hsl(215_12%_92%)] text-[hsl(215_15%_45%)] border-[hsl(215_10%_85%)]',
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
                  ? 'border-[hsl(4_50%_75%)] bg-[hsl(4_60%_97%)] hover:border-[hsl(4_70%_60%)] hover:bg-[hsl(4_60%_95%)] focus:ring-[hsl(4_70%_55%)]/30'
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
