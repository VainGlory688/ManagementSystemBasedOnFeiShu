import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Layers, Flag } from 'lucide-react';
import type { MyVersionItem } from '@shared/api.interface';

interface VersionListProps {
  items: MyVersionItem[];
  loading: boolean;
}

const statusClassMap: Record<string, string> = {
  开发中: 'bg-[hsl(215_30%_94%)] text-[hsl(215_60%_38%)]',
  提测阶段: 'bg-[hsl(38_70%_93%)] text-[hsl(38_80%_42%)]',
  灰度中: 'bg-[hsl(28_70%_94%)] text-[hsl(28_80%_45%)]',
  已发布: 'bg-[hsl(160_40%_94%)] text-[hsl(160_60%_35%)]',
  已关闭: 'bg-[hsl(215_12%_92%)] text-[hsl(215_12%_50%)]',
  未开始: 'bg-[hsl(215_12%_92%)] text-[hsl(215_12%_50%)]',
};

const getStatusClass = (status: string): string => {
  return statusClassMap[status] || 'bg-[hsl(215_12%_92%)] text-[hsl(215_12%_50%)]';
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.35 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const VersionList = ({ items, loading }: VersionListProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 rounded-sm border border-border bg-card animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        暂无参与的版本
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      data-ai-section-type="card-menu"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
    >
      {items.map((item: MyVersionItem) => (
        <motion.button
          key={item.id}
          variants={itemVariants}
          type="button"
          onClick={() => navigate(`/versions/${item.id}`)}
          className="text-left rounded-sm border border-border bg-card p-4 transition-all duration-200 hover:scale-[1.02] hover:shadow-md hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 group"
        >
          <div className="flex items-center gap-2 text-primary">
            <Layers className="size-4" strokeWidth={1.75} />
            <span className="text-xs text-muted-foreground font-mono">VERSION</span>
          </div>
          <h3 className="mt-3 font-heading font-semibold text-base text-foreground line-clamp-1 group-hover:text-primary transition-colors">
            {item.versionName || '未命名版本'}
          </h3>
          <div className="mt-4 flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center h-[22px] px-2 rounded-full text-xs font-medium ${getStatusClass(
                item.appStatus,
              )}`}
            >
              {item.appStatus || '未开始'}
            </span>
            {item.currentMilestone && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Flag className="size-3" />
                <span className="truncate max-w-[80px]">{item.currentMilestone}</span>
              </span>
            )}
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
};

export { VersionList };
