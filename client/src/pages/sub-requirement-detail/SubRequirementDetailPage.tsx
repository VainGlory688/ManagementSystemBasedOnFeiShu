import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, FileText, Loader2 } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import {
  getSubRequirementDetail,
  getSubRequirementList,
  updateSubRequirement,
} from '@/api/sub-requirement';
import { getRequirementDetail } from '@/api/requirement';
import { isOptimisticLockConflict } from '../../api/request-error';
import { UserDisplay } from '@/components/business-ui/user-display';
import { UserSelect } from '@/components/business-ui/user-select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineEditableField } from '@/components/InlineEditableField';
import { DirectSelectField } from '@/components/DirectSelectField';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { cn } from '@/lib/utils';
import type { SubRequirementItem, UpdateSubRequirementDto } from '@shared/api.interface';
import { getIncompletePipelinePredecessorIds } from '../../../../shared/requirement-business-rules';
import { toast } from 'sonner';

function getStatusBadgeClass(status: string): string {
  if (['已完成', '已上线'].includes(status)) {
    return 'bg-success/15 text-success border-transparent';
  }
  if (['进行中', '开发中'].includes(status)) {
    return 'bg-priority-p2-bg text-priority-p2 border-transparent';
  }
  if (['已阻塞', '有风险'].includes(status)) {
    return 'bg-severity-fatal-bg text-severity-fatal border-transparent';
  }
  return 'bg-muted text-muted-foreground border-transparent';
}

function getPriorityBadgeClass(priority: string): string {
  const classes: Record<string, string> = {
    P0: 'bg-priority-p0-bg text-priority-p0 border-transparent',
    P1: 'bg-priority-p1-bg text-priority-p1 border-transparent',
    P2: 'bg-priority-p2-bg text-priority-p2 border-transparent',
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

function toDateInputValue(value?: string): string {
  return value ? value.slice(0, 10) : '';
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
  const saveQueueRef = useRef(Promise.resolve());
  const updatedAtRef = useRef<string | undefined>(undefined);
  const [completionBlockers, setCompletionBlockers] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    updatedAtRef.current = undefined;

    getSubRequirementDetail(id)
      .then((data) => {
        if (!cancelled) {
          updatedAtRef.current = data.updatedAt;
          setDetail(data);
        }
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
    const subRequirementId = detail.id;
    const save = saveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        const updated = await updateSubRequirement(
          subRequirementId,
          {
            [field]: value,
            expectedUpdatedAt: updatedAtRef.current,
          } as unknown as UpdateSubRequirementDto,
        );
        updatedAtRef.current = updated.updatedAt;
        setDetail(updated);
      } catch (err) {
        logger.error('更新子需求字段失败', err);
        toast.error(
          isOptimisticLockConflict(err)
            ? '子需求已被其他人修改，请刷新页面后再编辑'
            : '保存子需求字段失败，请稍后重试',
        );
        throw err;
      }
    });
    saveQueueRef.current = save;
    return save;
  };

  const handleStatusChange = async (status: string) => {
    if (
      ['已完成', '已上线'].includes(status)
      && !['已完成', '已上线'].includes(detail.appStatus)
      && detail.appParentWorkItemRecordId
    ) {
      try {
        const [requirement, subRequirements] = await Promise.all([
          getRequirementDetail(detail.appParentWorkItemRecordId),
          getSubRequirementList({ page: 1, pageSize: 1000 }),
        ]);
        const siblings = subRequirements.items.filter((item) =>
          item.appParentWorkItemRecordId === detail.appParentWorkItemRecordId
          || item.appParentWorkItemRecordId === requirement.baseRecordId
          || item.appParentWorkItemRecordId === requirement.id,
        );
        const blockerIds = getIncompletePipelinePredecessorIds(
          detail.baseRecordId || detail.id,
          siblings.map((item) => ({ id: item.baseRecordId || item.id, status: item.appStatus })),
          requirement.pipeline?.edges || [],
        );
        if (blockerIds.length > 0) {
          const nameById = new Map(siblings.map((item) => [
            item.baseRecordId || item.id,
            item.appSubRequirementName,
          ]));
          setCompletionBlockers(blockerIds.map((blockerId) =>
            nameById.get(blockerId) || '未命名前置子需求'));
          return;
        }
      } catch {
        toast.error('无法校验前置子需求状态，请稍后重试');
        return;
      }
    }
    await saveField('appStatus', status);
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
          onChange={handleStatusChange}
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
                renderEditor={(value, onChange) => <Input type="date" value={toDateInputValue(value)} onChange={(event) => onChange(event.target.value)} />}
              >
                <span className="font-mono">{formatDate(detail.appExpectedStartDate)}</span>
              </InlineEditableField>
            </InfoItem>
            <InfoItem label="预计结束">
              <InlineEditableField
                value={detail.appExpectedEndDate}
                onSave={(value) => saveField('appExpectedEndDate', value)}
                renderEditor={(value, onChange) => <Input type="date" value={toDateInputValue(value)} onChange={(event) => onChange(event.target.value)} />}
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
      <Dialog open={completionBlockers.length > 0} onOpenChange={(open) => !open && setCompletionBlockers([])}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>无法完成子需求</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">请先完成以下前置子需求，再将当前节点标记为已完成：</p>
          <ul className="space-y-1 rounded-sm border border-severity-fatal/30 bg-severity-fatal-bg p-3 text-sm text-severity-fatal">
            {completionBlockers.map((name) => <li key={name}>• {name}</li>)}
          </ul>
          <div className="flex justify-end">
            <Button type="button" onClick={() => setCompletionBlockers([])}>我知道了</Button>
          </div>
        </DialogContent>
      </Dialog>

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
