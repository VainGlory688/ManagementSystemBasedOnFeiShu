import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { InlineEditableField } from '@/components/InlineEditableField';
import { DirectSelectField } from '@/components/DirectSelectField';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  getVersionDetail,
  getVersionRequirements,
  getVersionSummary,
  updateVersion,
} from '@/api/version';
import type { MainVersion, UpdateVersionDto, VersionRequirement, VersionSummary } from '@shared/api.interface';
import {
  buildMilestones,
  getPriorityInfo,
  getStatusInfo,
  isHighRisk,
} from '@/utils/version-helpers';
import { MilestoneTimeline } from './MilestoneTimeline';
import { RequirementList } from './RequirementList';
import { SummaryCards } from './SummaryCards';
import { toast } from 'sonner';

const VersionDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [version, setVersion] = useState<MainVersion | null>(null);
  const [reqList, setReqList] = useState<VersionRequirement[]>([]);
  const [summary, setSummary] = useState<VersionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [reqLoading, setReqLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { options } = useFieldOptions();
  const saveQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadAll = async () => {
      setLoading(true);
      setError(null);
      try {
        const [v, reqRes, sum] = await Promise.all([
          getVersionDetail(id),
          getVersionRequirements(id, 1, 1000),
          getVersionSummary(id),
        ]);
        if (cancelled) return;
        setVersion(v);
        setReqList(reqRes.items);
        setSummary(sum);
      } catch (err) {
        if (!cancelled) {
          setError('加载版本详情失败');
          logger.error('加载版本详情失败', err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReqLoading(false);
        }
      }
    };

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const milestones = version ? buildMilestones(version) : [];
  const statusInfo = version ? getStatusInfo(version.appStatus) : null;
  const prioInfo = version ? getPriorityInfo(version.priority) : null;
  const highRisk = version ? isHighRisk(version) : false;
  const saveField = async <K extends keyof MainVersion>(field: K, value: MainVersion[K]) => {
    if (!version) return;
    const versionId = version.id;
    const save = saveQueueRef.current.catch(() => undefined).then(async () => {
      try {
        const updated = await updateVersion(versionId, { [field]: value } as unknown as UpdateVersionDto);
        setVersion(updated);
      } catch (err) {
        logger.error('更新版本字段失败', err);
        toast.error('保存版本字段失败，请稍后重试');
        throw err;
      }
    });
    saveQueueRef.current = save;
    return save;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          <span>返回</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* 顶部标题区 */}
      <div
        className="rounded-sm border border-border bg-card p-5"
        style={{
          animation: 'title-slide-in 0.4s ease-out both',
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {loading ? (
            <>
              <Skeleton className="h-8 w-[300px]" />
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-12 rounded-full" />
            </>
          ) : (
            <>
              {version && (
                <InlineEditableField
                  value={version.versionName}
                  onSave={(value) => saveField('versionName', value)}
                  renderEditor={(value, onChange) => <Input value={value} onChange={(event) => onChange(event.target.value)} />}
                >
                  <h2 className="text-2xl font-heading font-semibold text-foreground tracking-tight">{version.versionName}</h2>
                </InlineEditableField>
              )}

              {version && statusInfo && (
                <DirectSelectField value={version.appStatus} options={options.version_status || []} onChange={(value) => saveField('appStatus', value)}>
                  <Badge variant="outline" className={`h-6 px-3 text-sm font-medium rounded-full ${statusInfo.className}`}>
                    <span className={`mr-1.5 size-1.5 rounded-full ${statusInfo.dot}`} />
                    {statusInfo.label}
                  </Badge>
                </DirectSelectField>
              )}

              {version && prioInfo && (
                <DirectSelectField value={version.priority} options={options.version_priority || []} onChange={(value) => saveField('priority', value)}>
                  <span className={`inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-semibold ${prioInfo.bg} ${prioInfo.fg} ${prioInfo.border}`}>{prioInfo.label}</span>
                </DirectSelectField>
              )}

              {highRisk && (
                <span className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-sm bg-destructive/10 text-destructive text-xs animate-pulse-soft">
                  <AlertTriangle className="size-3.5" />
                  高风险
                </span>
              )}
            </>
          )}
        </div>

        {version && (
          <InlineEditableField
            value={version.versionRisk || ''}
            className="mt-3 max-w-3xl"
            onSave={(value) => saveField('versionRisk', value)}
            renderEditor={(value, onChange) => <Textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} />}
          >
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">风险摘要：</span>
              {version.versionRisk || '暂无风险摘要'}
            </p>
          </InlineEditableField>
        )}
      </div>

      {/* 三栏式布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* 左栏：里程碑时间线 */}
        <Card className="lg:col-span-3 border border-border rounded-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-heading font-semibold text-foreground">
              里程碑时间线
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            {loading ? (
              <div className="space-y-5 pl-4">
                {Array.from({ length: 6 }).map((_, i: number) => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : (
              <MilestoneTimeline nodes={milestones} />
            )}
          </CardContent>
        </Card>

        {/* 中栏：关联需求 */}
        <Card className="lg:col-span-6 border border-border rounded-sm">
          <CardHeader className="pb-3 pt-4 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-heading font-semibold text-foreground">
              关联需求
              <span className="ml-2 font-mono text-xs text-muted-foreground font-normal">
                {reqList.length > 0 ? reqList.length : 0} 条
              </span>
            </CardTitle>
            {version && (
              <Link
                to={`/requirements?planningVersion=${encodeURIComponent(version.baseRecordId || version.id)}`}
                className="text-xs text-primary hover:underline"
              >
                查看全部
              </Link>
            )}
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            <RequirementList items={reqList} loading={reqLoading} />
          </CardContent>
        </Card>

        {/* 右栏：数据概览卡片 */}
        <Card className="lg:col-span-3 border border-border rounded-sm">
          <CardHeader className="pb-3 pt-4 px-4">
            <CardTitle className="text-sm font-heading font-semibold text-foreground">
              数据概览
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-4 pb-4">
            {id && version && (
              <SummaryCards
                summary={loading ? null : summary}
                versionId={id}
                versionName={version.versionName}
              />
            )}
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-24 w-full rounded-sm" />
                <Skeleton className="h-40 w-full rounded-sm" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style>{`
        @keyframes title-slide-in {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
};

export default VersionDetailPage;
