import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { getSubRequirementDetail, updateSubRequirement } from '@/api/sub-requirement';
import { UserDisplay } from '@/components/business-ui/user-display';
import { UserSelect } from '@/components/business-ui/user-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineEditableField } from '@/components/InlineEditableField';
import { DirectSelectField } from '@/components/DirectSelectField';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { cn } from '@/lib/utils';
import type { SubRequirementItem, UpdateSubRequirementDto } from '@shared/api.interface';

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
  const { options } = useFieldOptions();

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

  const saveField = async <K extends keyof SubRequirementItem>(
    field: K,
    value: SubRequirementItem[K],
  ) => {
    const updated = await updateSubRequirement(
      detail.id,
      { [field]: value } as UpdateSubRequirementDto,
    );
    setDetail(updated);
  };

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
        <InlineEditableField
          value={detail.appSubRequirementName}
          onSave={(value) => saveField('appSubRequirementName', value)}
          renderEditor={(value, onChange) => <Input value={value} onChange={(event) => onChange(event.target.value)} />}
        >
          <h1 className="text-2xl font-heading font-semibold text-foreground tracking-tight">{detail.appSubRequirementName}</h1>
        </InlineEditableField>
        <DirectSelectField
          value={detail.appStatus}
          options={options.sub_req_status || []}
          onChange={(value) => saveField('appStatus', value)}
        >
          <Badge className={cn('h-[22px] px-2.5 text-[11px] font-medium rounded-full', getStatusBadgeClass(detail.appStatus))}>{detail.appStatus || '-'}</Badge>
        </DirectSelectField>
        <DirectSelectField
          value={detail.appPriority}
          options={options.sub_req_priority || []}
          onChange={(value) => saveField('appPriority', value)}
        >
          <Badge className={cn('h-[22px] px-2.5 text-[11px] font-semibold rounded-full', getPriorityBadgeClass(detail.appPriority))}>{detail.appPriority || '-'}</Badge>
        </DirectSelectField>
      </div>

      <Card className="rounded-sm shadow-none border border-border">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <InfoItem label="当前负责人">
              <InlineEditableField
                value={detail.appCurrentOwner || ''}
                onSave={(value) => saveField('appCurrentOwner', value)}
                renderEditor={(value, onChange) => <UserSelect value={value || null} onChange={(next) => onChange(next || '')} triggerType="search" placeholder="请选择负责人" />}
              >
                {detail.appCurrentOwner ? <UserDisplay value={[detail.appCurrentOwner]} size="small" /> : '-'}
              </InlineEditableField>
            </InfoItem>
            <InfoItem label="预计开始">
              <InlineEditableField
                value={detail.appExpectedStartDate}
                onSave={(value) => saveField('appExpectedStartDate', value)}
                renderEditor={(value, onChange) => <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />}
              >
                <span className="font-mono">{formatDate(detail.appExpectedStartDate)}</span>
              </InlineEditableField>
            </InfoItem>
            <InfoItem label="预计结束">
              <InlineEditableField
                value={detail.appExpectedEndDate}
                onSave={(value) => saveField('appExpectedEndDate', value)}
                renderEditor={(value, onChange) => <Input type="date" value={value} onChange={(event) => onChange(event.target.value)} />}
              >
                <span className="font-mono">{formatDate(detail.appExpectedEndDate)}</span>
              </InlineEditableField>
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
          <InlineEditableField
            value={detail.appDetails || ''}
            onSave={(value) => saveField('appDetails', value)}
            renderEditor={(value, onChange) => (
              <Textarea value={value} rows={5} onChange={(event) => onChange(event.target.value)} />
            )}
          >
            <div className="min-h-[120px] whitespace-pre-wrap rounded-sm border border-border/60 bg-background/60 p-4 text-sm leading-relaxed text-foreground/90">
              {detail.appDetails || '暂无详情描述'}
            </div>
          </InlineEditableField>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubRequirementDetailPage;
