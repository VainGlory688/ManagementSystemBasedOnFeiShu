import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { getSubRequirementDetail } from '@/api/sub-requirement';
import { UserDisplay } from '@/components/business-ui/user-display';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { SubRequirementItem } from '@shared/api.interface';

function getStatusBadgeClass(status: string): string {
  if (['已完成', '已上线'].includes(status)) {
    return 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_42%)] border-transparent';
  }
  if (['进行中', '开发中'].includes(status)) {
    return 'bg-priority-p2-bg text-priority-p2 border-transparent';
  }
  if (['已阻塞', '有风险'].includes(status)) {
    return 'bg-priority-p0-bg text-priority-p0 border-transparent';
  }
  return 'bg-muted text-muted-foreground border-transparent';
}

function getPriorityBadgeClass(priority: string): string {
  const classes: Record<string, string> = {
    P0: 'bg-priority-p0 text-priority-p0-foreground border-transparent',
    P1: 'bg-priority-p1 text-priority-p1-foreground border-transparent',
    P2: 'bg-priority-p2 text-[hsl(40_100%_12%)] border-transparent',
    待定: 'bg-transparent text-muted-foreground border-border',
    历史遗留: 'bg-priority-p3-bg text-priority-p3 border-transparent',
  };
  return classes[priority] || 'bg-muted text-muted-foreground border-transparent';
}

function formatDate(value: string): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-CN');
}

interface InfoItemProps {
  label: string;
  children: React.ReactNode;
}

function InfoItem({ label, children }: InfoItemProps) {
  return (
    <div className="flex flex-col gap-1.5 p-3 bg-background/50 rounded-sm border border-border/60">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-sm text-foreground font-medium">{children}</div>
    </div>
  );
}

const SubRequirementDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<SubRequirementItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);

    getSubRequirementDetail(id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((error: unknown) => {
        if (!cancelled) logger.error('加载子需求详情失败', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return <div className="py-20 text-center text-muted-foreground">子需求不存在或已删除</div>;
  }

  const parentLink = detail.appParentWorkItemRecordId
    ? `/requirements/${detail.appParentWorkItemRecordId}`
    : '/requirements';

  return (
    <div className="space-y-4 pb-8 max-w-[1200px]">
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-label="breadcrumb">
        <Link to="/requirements" className="hover:text-primary hover:underline transition-colors">
          需求管理
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to={parentLink} className="hover:text-primary hover:underline transition-colors">
          {detail.appParentWorkItemName || '所属需求'}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">子需求详情</span>
      </nav>

      <div className="flex items-start gap-3 flex-wrap">
        <h1 className="text-2xl font-heading font-semibold text-foreground tracking-tight">
          {detail.appSubRequirementName}
        </h1>
        <Badge className={cn('h-[22px] px-2.5 text-[11px] font-medium rounded-full mt-1.5', getStatusBadgeClass(detail.appStatus))}>
          {detail.appStatus || '-'}
        </Badge>
        <Badge className={cn('h-[22px] px-2.5 text-[11px] font-semibold rounded-full mt-1.5', getPriorityBadgeClass(detail.appPriority))}>
          {detail.appPriority || '-'}
        </Badge>
      </div>

      <Card className="rounded-sm shadow-none border border-border">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoItem label="当前负责人">
              {detail.appCurrentOwner ? <UserDisplay value={[detail.appCurrentOwner]} size="small" /> : '-'}
            </InfoItem>
            <InfoItem label="预计开始">
              <span className="font-mono">{formatDate(detail.appExpectedStartDate)}</span>
            </InfoItem>
            <InfoItem label="预计结束">
              <span className="font-mono">{formatDate(detail.appExpectedEndDate)}</span>
            </InfoItem>
            <InfoItem label="逾期天数">
              {detail.appOverdueDays > 0 ? (
                <span className="text-destructive font-mono">逾期 {detail.appOverdueDays} 天</span>
              ) : (
                '-'
              )}
            </InfoItem>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-sm shadow-none border border-border">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">子需求详情</h2>
          </div>
          <div className="min-h-[120px] whitespace-pre-wrap rounded-sm border border-border/60 bg-background/60 p-4 text-sm leading-relaxed text-foreground/90">
            {detail.appDetails || '暂无详情描述'}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubRequirementDetailPage;
