import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, Loader2, FileText, Plus } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InlineEditableField } from '@/components/InlineEditableField';
import { DirectSelectField } from '@/components/DirectSelectField';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { UserDisplay } from '@/components/business-ui/user-display';
import { UserSelect } from '@/components/business-ui/user-select';
import { LabelBadge } from '@/components/LabelBadge';
import { cn } from '@/lib/utils';

import SubRequirementTable from './SubRequirementTable';
import SubRequirementDialogs from './SubRequirementDialogs';
import RequirementPipeline from './RequirementPipeline';
import {
  getRequirementDetail,
  getSubRequirementList,
  updateRequirement,
} from '@/api/requirement';
import { isOptimisticLockConflict } from '../../api/request-error';
import { getVersionList } from '@/api/version';
import type { VersionRequirement, SubRequirementItem, UpdateRequirementDto } from '@shared/api.interface';
import { toast } from 'sonner';

const getPriorityBadgeClass = (priority: string): string => {
  switch (priority) {
    case 'P0':
      return 'bg-priority-p0 text-priority-p0-foreground border-transparent';
    case 'P1':
      return 'bg-priority-p1 text-priority-p1-foreground border-transparent';
    case 'P2':
      return 'bg-priority-p2 text-priority-p2-foreground border-transparent';
    case 'P3':
      return 'bg-priority-p3-bg text-priority-p3 border-transparent';
    default:
      return 'bg-muted text-muted-foreground border-transparent';
  }
};

const toDateInputValue = (value?: string) => value ? value.slice(0, 10) : '';

interface InfoItemProps {
  label: string;
  children: React.ReactNode;
  delay?: number;
}

const InfoItem = ({ label, children, delay = 0 }: InfoItemProps) => (
  <div
    className="flex flex-col gap-1.5 p-3 bg-background/50 rounded-sm border border-border/60
               opacity-0 translate-y-1 animate-[fade-in-up_0.35s_ease-out_forwards]"
    style={{ animationDelay: `${delay}ms` }}
  >
    <span className="text-xs text-muted-foreground">{label}</span>
    <div className="text-sm text-foreground font-medium">{children}</div>
  </div>
);

const RequirementDetailPage = () => {
  const { id = '' } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<VersionRequirement | null>(null);
  const [subItems, setSubItems] = useState<SubRequirementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(true);
  const [subEditorOpen, setSubEditorOpen] = useState(false);
  const [editingSubItem, setEditingSubItem] = useState<SubRequirementItem | null>(null);
  const [deletingSubItem, setDeletingSubItem] = useState<SubRequirementItem | null>(null);
  const [versionOptions, setVersionOptions] = useState<Array<{ value: string; label: string }>>([]);
  const { options } = useFieldOptions();
  const saveQueueRef = useRef(Promise.resolve());
  const updatedAtRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    getVersionList({ pageSize: 200 })
      .then((response) => setVersionOptions(response.items.map((version) => ({
        value: version.baseRecordId || version.id,
        label: version.versionName,
      }))))
      .catch(() => setVersionOptions([]));
  }, []);

  const loadSubItems = useCallback(() => {
    if (!id) return;
    setSubLoading(true);
    getSubRequirementList(id, 1, 50)
      .then((res) => setSubItems(res.items))
      .catch((err: unknown) => logger.error('加载子需求失败', err))
      .finally(() => setSubLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    updatedAtRef.current = undefined;
    getRequirementDetail(id)
      .then((data: VersionRequirement) => {
        if (cancelled) return;
        updatedAtRef.current = data.updatedAt;
        setDetail(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('加载需求详情失败', err);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    loadSubItems();

    return () => {
      cancelled = true;
    };
  }, [id, loadSubItems]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('zh-CN');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        需求不存在或已删除
      </div>
    );
  }

  const saveField = async <K extends keyof VersionRequirement>(
    field: K,
    value: VersionRequirement[K],
  ) => {
    const requirementId = detail.id;
    const save = saveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        const updated = await updateRequirement(
          requirementId,
          {
            [field]: value,
            expectedUpdatedAt: updatedAtRef.current,
          } as unknown as UpdateRequirementDto,
        );
        updatedAtRef.current = updated.updatedAt;
        setDetail(updated);
      } catch (err) {
        logger.error('更新需求字段失败', err);
        toast.error(
          isOptimisticLockConflict(err)
            ? '需求已被其他人修改，请刷新页面后再编辑'
            : '保存需求字段失败，请稍后重试',
        );
        throw err;
      }
    });
    saveQueueRef.current = save;
    return save;
  };

  return (
    <div className="space-y-4 pb-8">
      {/* Breadcrumb */}
      <nav
        className="flex items-center gap-1.5 pl-2 text-sm text-muted-foreground"
        aria-label="breadcrumb"
      >
        <Link
          to={`/versions/${detail.planningVersionId || ''}`}
          className="hover:text-primary hover:underline transition-colors"
        >
          版本管理
        </Link>
        <ChevronRight className="size-3.5" />
        <Link
          to={`/versions/${detail.planningVersionId || ''}`}
          className="hover:text-primary hover:underline transition-colors"
        >
          {detail.planningVersionName || '-'}
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">需求详情</span>
      </nav>

      {/* Title */}
      <div
        className="flex flex-wrap items-start gap-3 pl-2"
      >
        <InlineEditableField
          value={detail.appReqName}
          onSave={(value) => saveField('appReqName', value)}
          renderEditor={(value, onChange) => <Input value={value} onChange={(event) => onChange(event.target.value)} />}
        >
          <h1 className="text-2xl font-heading font-semibold text-foreground tracking-tight">{detail.appReqName}</h1>
        </InlineEditableField>
        <DirectSelectField
          value={detail.priority}
          options={options.req_priority || []}
          onChange={(value) => saveField('priority', value)}
        >
          <Badge variant="default" className={cn('h-[22px] px-2.5 text-[11px] font-semibold rounded-full mt-1.5', getPriorityBadgeClass(detail.priority), detail.priority === 'P0' && 'animate-pulse-soft')}>{detail.priority || '-'}</Badge>
        </DirectSelectField>
      </div>

      {/* Basic info card */}
      <Card className="rounded-sm shadow-none border border-border">
        <CardContent className="p-5">
          <div className="grid grid-cols-2 gap-3">
            <InfoItem label="负责人" delay={150}>
              <InlineEditableField
                value={detail.currentOwner || ''}
                onSave={(value) => saveField('currentOwner', value)}
                renderEditor={(value, onChange) => <UserSelect value={value || null} onChange={(next) => onChange(next || '')} triggerType="search" placeholder="请选择负责人" />}
              >
                {detail.currentOwner ? <UserDisplay value={[detail.currentOwner]} size="small" /> : '-'}
              </InlineEditableField>
            </InfoItem>
            <InfoItem label="需求类型" delay={200}>
              <DirectSelectField
                value={detail.reqType}
                options={options.req_type || []}
                onChange={(value) => saveField('reqType', value)}
              ><LabelBadge type="requirementType" value={detail.reqType} /></DirectSelectField>
            </InfoItem>
            <InfoItem label="业务线" delay={250}>
              <DirectSelectField
                value={detail.businessLine}
                options={options.req_business_line || []}
                onChange={(value) => saveField('businessLine', value)}
              ><LabelBadge type="businessLine" value={detail.businessLine} /></DirectSelectField>
            </InfoItem>
            <InfoItem label="计划版本" delay={300}>
              <InlineEditableField
                value={detail.planningVersion}
                onSave={(value) => saveField('planningVersion', value)}
                renderEditor={(value, onChange) => (
                  <Select value={value || undefined} onValueChange={onChange}>
                    <SelectTrigger><SelectValue placeholder="请选择计划版本" /></SelectTrigger>
                    <SelectContent>{versionOptions.map((version) => <SelectItem key={version.value} value={version.value}>{version.label}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              >
                {detail.planningVersionName || '-'}
              </InlineEditableField>
            </InfoItem>
            <InfoItem label="提出时间" delay={350}>
              <span className="font-mono">{formatDate(detail.proposalTime)}</span>
            </InfoItem>
            <InfoItem label="预计完成时间" delay={400}>
              {detail.estimatedCompletionTimeSource === 'subRequirements' ? (
                <div>
                  <span className="font-mono">{formatDate(detail.estimatedCompletionTime)}</span>
                  <p className="mt-1 text-xs text-muted-foreground">由子需求最晚预计结束时间自动汇总</p>
                </div>
              ) : (
                <InlineEditableField
                  value={detail.estimatedCompletionTime}
                  onSave={(value) => saveField('estimatedCompletionTime', value)}
                  renderEditor={(value, onChange) => <Input type="date" value={toDateInputValue(value)} onChange={(event) => onChange(event.target.value)} />}
                >
                  <span className="font-mono">{formatDate(detail.estimatedCompletionTime)}</span>
                </InlineEditableField>
              )}
            </InfoItem>
            <InfoItem label="创建人" delay={450}>
              {detail.creator ? (
                <UserDisplay value={[detail.creator]} size="small" />
              ) : (
                '-'
              )}
            </InfoItem>
          </div>
        </CardContent>
      </Card>

      {/* Description */}
      <Card
        className="rounded-sm shadow-none border border-border
                   opacity-0 translate-y-2 animate-[fade-in-up_0.4s_ease-out_forwards]"
        style={{ animationDelay: '500ms' }}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">需求描述</h2>
          </div>
          <InlineEditableField
            value={detail.description || ''}
            onSave={(value) => saveField('description', value)}
            renderEditor={(value, onChange) => <Textarea value={value} rows={5} onChange={(event) => onChange(event.target.value)} />}
          >
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap bg-background/60 rounded-sm p-4 border border-border/60 min-h-[100px]">
              {detail.description || '暂无需求描述'}
            </div>
          </InlineEditableField>
        </CardContent>
      </Card>

      {/* Pipeline */}
      <div
        className="opacity-0 translate-y-2 animate-[fade-in-up_0.4s_ease-out_forwards]"
        style={{ animationDelay: '550ms' }}
      >
        <RequirementPipeline
          requirementId={detail.id}
          expectedUpdatedAt={detail.updatedAt}
          items={subItems}
          pipeline={detail.pipeline}
          onSaved={(pipeline) => {
            if (pipeline.updatedAt) updatedAtRef.current = pipeline.updatedAt;
            setDetail((current) => current
              ? { ...current, pipeline, updatedAt: pipeline.updatedAt || current.updatedAt }
              : current);
          }}
        />
      </div>

      {/* Sub-requirements */}
      <div
        className="opacity-0 translate-y-2 animate-[fade-in-up_0.4s_ease-out_forwards]"
        style={{ animationDelay: '600ms' }}
      >
        <div className="flex items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <div className="size-1 rounded-full bg-primary" />
            <h2 className="text-sm font-semibold text-foreground">子需求拆解</h2>
            <span className="text-xs text-muted-foreground font-mono">
              {subItems.length} 项
            </span>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditingSubItem(null);
              setSubEditorOpen(true);
            }}
          >
            <Plus className="size-4" />
            新建子需求
          </Button>
        </div>
        <SubRequirementTable
          items={subItems}
          loading={subLoading}
          onEdit={(item) => {
            setEditingSubItem(item);
            setSubEditorOpen(true);
          }}
          onDelete={setDeletingSubItem}
        />
      </div>
      <SubRequirementDialogs
        parentRequirementId={detail.baseRecordId || detail.id}
        editorOpen={subEditorOpen}
        editingItem={editingSubItem}
        deletingItem={deletingSubItem}
        onCloseEditor={() => {
          setSubEditorOpen(false);
          setEditingSubItem(null);
        }}
        onCloseDelete={() => setDeletingSubItem(null)}
        onSaved={() => {
          loadSubItems();
          getRequirementDetail(id)
            .then((updated) => {
              updatedAtRef.current = updated.updatedAt;
              setDetail(updated);
            })
            .catch((error: unknown) => logger.error('刷新需求详情失败', error));
        }}
      />

      <style>{`
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default RequirementDetailPage;
