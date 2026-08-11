import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  User,
  Layers,
  Monitor,
  Beaker,
  Calendar,
  FileText,
  GitBranch,
  ClipboardList,
} from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineEditableField } from '@/components/InlineEditableField';
import { DirectSelectField } from '@/components/DirectSelectField';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { UserDisplay } from '@/components/business-ui/user-display';
import { UserSelect } from '@/components/business-ui/user-select';
import { LabelBadge } from '@/components/LabelBadge';

import { getDefectDetail, updateDefect } from '@/api/defect';
import type { DefectItem, UpdateDefectDto } from '@shared/api.interface';
import { UniversalLink } from '@lark-apaas/client-toolkit/components/UniversalLink';
import { PillBadge } from '../defect-list/badge-helpers';

// ---------- Info row ----------

interface InfoRowProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
  delay: number;
}

function InfoRow({ icon: Icon, label, children, delay }: InfoRowProps) {
  return (
    <div
      className="flex items-start gap-3 py-3 opacity-0 translate-y-2"
      style={{
        animation: `fade-row-in 0.35s ease-out ${delay}ms forwards`,
      }}
    >
      <div className="mt-0.5 size-8 rounded-sm bg-accent flex items-center justify-center shrink-0">
        <Icon className="size-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

// ---------- Link with underline grow ----------

interface GrowLinkProps {
  to: string;
  children: React.ReactNode;
  external?: boolean;
}

function GrowLink({ to, children, external }: GrowLinkProps) {
  const content = (
    <span className="inline-flex items-center gap-1 relative group">
      <span className="relative after:content-[''] after:absolute after:left-0 after:-bottom-0.5 after:h-[1px] after:bg-primary after:w-0 after:transition-all after:duration-200 group-hover:after:w-full">
        {children}
      </span>
      {external && <ExternalLink className="size-3 opacity-60" />}
    </span>
  );

  if (external) {
    return (
      <UniversalLink
        to={to}
        target="_blank"
        rel="noreferrer"
        className="text-primary hover:text-primary/80 text-sm"
      >
        {content}
      </UniversalLink>
    );
  }
  return (
    <Link to={to} className="text-primary hover:text-primary/80 text-sm">
      {content}
    </Link>
  );
}

// ---------- DefectDetailPage ----------

const DefectDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const [defect, setDefect] = useState<DefectItem | null>(null);
  const [loading, setLoading] = useState(true);
  const { options } = useFieldOptions();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    getDefectDetail(id)
      .then((res) => {
        if (cancelled) return;
        setDefect(res);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logger.error('缺陷详情加载失败', err);
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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!defect) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        缺陷不存在
      </div>
    );
  }

  const isHighRisk = defect.severity === '致命' || defect.severity === '严重';
  const createdDate = defect.createdAt
    ? new Date(defect.createdAt).toLocaleString('zh-CN')
    : '-';
  const saveField = async <K extends keyof DefectItem>(field: K, value: DefectItem[K]) => {
    const updated = await updateDefect(defect.id, { [field]: value } as UpdateDefectDto);
    setDefect(updated);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/defects">缺陷管理</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator>
            <ChevronRight className="size-3.5" />
          </BreadcrumbSeparator>
          <BreadcrumbItem className="text-foreground font-medium">
            缺陷详情
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4 flex-1 min-h-0">
        {/* Left column: basic info */}
        <Card className="h-fit">
          <CardContent className="p-6">
            {/* Title row */}
            <div
              className="opacity-0 -translate-x-4"
              style={{ animation: 'slide-left-in 0.5s ease-out 50ms forwards' }}
            >
              <div className="text-xs font-mono text-muted-foreground mb-2">
                #{defect.baseRecordId?.slice(0, 8)}
              </div>
              <InlineEditableField
                value={defect.defectName}
                onSave={(value) => saveField('defectName', value)}
                renderEditor={(value, onChange) => <Input value={value} onChange={(event) => onChange(event.target.value)} />}
              >
                <h1 className="font-heading text-2xl font-semibold text-foreground leading-snug tracking-tight">{defect.defectName}</h1>
              </InlineEditableField>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              <DirectSelectField value={defect.status} options={options.defect_status || []} onChange={(value) => saveField('status', value)}>
                <PillBadge text={defect.status} variant="status" />
              </DirectSelectField>
              <DirectSelectField value={defect.severity} options={options.defect_severity || []} onChange={(value) => saveField('severity', value)}>
                <PillBadge text={defect.severity} variant="severity" className={isHighRisk ? 'animate-grow-in' : undefined} />
              </DirectSelectField>
              <DirectSelectField value={defect.priority} options={options.defect_priority || []} onChange={(value) => saveField('priority', value)}>
                <PillBadge text={defect.priority} variant="priority" mono />
              </DirectSelectField>
            </div>

            <div className="border-t mt-6" />

            {/* Info list */}
            <div className="divide-y divide-border/70 -my-3">
              <InfoRow icon={User} label="当前负责人" delay={300}>
                <InlineEditableField
                  value={defect.currentOwner}
                  onSave={(value) => saveField('currentOwner', value)}
                  renderEditor={(value, onChange) => <UserSelect multiple value={value} onChange={(next) => onChange(next || [])} triggerType="search" placeholder="请选择负责人" />}
                >
                  <UserDisplay value={defect.currentOwner} size="small" />
                </InlineEditableField>
              </InfoRow>
              <InfoRow icon={Layers} label="业务线" delay={380}>
                <DirectSelectField value={defect.businessLine} options={options.defect_business_line || []} onChange={(value) => saveField('businessLine', value)}>
                  <LabelBadge type="businessLine" value={defect.businessLine} />
                </DirectSelectField>
              </InfoRow>
              <InfoRow icon={Monitor} label="发现环境" delay={460}>
                <DirectSelectField value={defect.discoveryEnvironment} options={options.defect_discovery_environment || []} onChange={(value) => saveField('discoveryEnvironment', value)}>
                  <LabelBadge type="environment" value={defect.discoveryEnvironment} />
                </DirectSelectField>
              </InfoRow>
              <InfoRow icon={Beaker} label="测试阶段" delay={540}>
                <DirectSelectField value={defect.testingStage} options={options.defect_testing_stage || []} onChange={(value) => saveField('testingStage', value)}>
                  <LabelBadge type="testingStage" value={defect.testingStage} />
                </DirectSelectField>
              </InfoRow>
              <InfoRow icon={User} label="创建人" delay={620}>
                <UserDisplay value={defect.creator} size="small" />
              </InfoRow>
              <InfoRow icon={Calendar} label="创建时间" delay={700}>
                <span className="font-mono text-xs">{createdDate}</span>
              </InfoRow>
            </div>
          </CardContent>
        </Card>

        {/* Right column: detail + related */}
        <div className="flex flex-col gap-4 overflow-y-auto min-h-0">
          {/* Rejection reason card */}
          {defect.rejectionReason && (
            <Card
              className="bg-severity-fatal-bg border-severity-fatal/30 border-l-[3px] border-l-severity-fatal animate-shake opacity-0"
              style={{ animation: 'shake 0.4s ease-in 0.15s, fade-in 0.3s ease-out 0.1s forwards' }}
            >
              <CardContent className="p-5 flex gap-3">
                <div className="shrink-0 size-9 rounded-sm bg-severity-fatal/10 flex items-center justify-center">
                  <AlertTriangle className="size-5 text-severity-fatal" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-severity-fatal text-sm mb-1">
                    驳回原因
                  </div>
                  <div className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                    {defect.rejectionReason}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Parent order link */}
          {defect.appParentOrderName && (
            <Card
              className="opacity-0 translate-y-2"
              style={{ animation: 'fade-up-in 0.4s ease-out 200ms forwards' }}
            >
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-8 rounded-sm bg-accent flex items-center justify-center shrink-0">
                  <GitBranch className="size-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-muted-foreground mb-0.5">
                    关联父单
                  </div>
                  <GrowLink to={`/requirements/${defect.appParentOrderRecordId || ''}`}>
                    {defect.appParentOrderName}
                  </GrowLink>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Related links: test plan + version */}
          {(defect.relatedTestPlanName || defect.relatedVersionName) && (
            <Card
              className="opacity-0 translate-y-2"
              style={{ animation: 'fade-up-in 0.4s ease-out 300ms forwards' }}
            >
              <CardContent className="p-4 flex flex-col gap-3">
                {defect.relatedTestPlanName && (
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-sm bg-accent flex items-center justify-center shrink-0">
                      <ClipboardList className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        所属测试计划
                      </div>
                      <GrowLink to={`/test-plans`}>
                        {defect.relatedTestPlanName}
                      </GrowLink>
                    </div>
                  </div>
                )}
                {defect.relatedVersionName && (
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-sm bg-accent flex items-center justify-center shrink-0">
                      <Layers className="size-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        所属版本
                      </div>
                      <GrowLink to={`/versions`}>
                        {defect.relatedVersionName}
                      </GrowLink>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Detail description */}
          <Card
            className="flex-1 opacity-0 translate-y-2 min-h-0"
            style={{ animation: 'fade-up-in 0.5s ease-out 150ms forwards' }}
          >
            <CardContent className="p-6 h-full flex flex-col">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="size-4 text-primary" />
                <h2 className="font-heading text-base font-semibold text-foreground">
                  缺陷详情
                </h2>
              </div>
              <InlineEditableField
                value={defect.detail || ''}
                className="flex-1 min-h-0"
                onSave={(value) => saveField('detail', value)}
                renderEditor={(value, onChange) => <Textarea value={value} rows={8} onChange={(event) => onChange(event.target.value)} />}
              >
                {defect.detail ? (
                  <div className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{defect.detail}</div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无详情描述</div>
                )}
              </InlineEditableField>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DefectDetailPage;
