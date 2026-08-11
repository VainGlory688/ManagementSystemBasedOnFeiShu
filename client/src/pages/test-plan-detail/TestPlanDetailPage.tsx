import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, Tag, Users, Layers, AlertTriangle } from 'lucide-react';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Button } from '@/components/ui/button';
import { getTestPlanDetail } from '@/api/test-plan';
import type { TestPlan } from '@shared/api.interface';

import { TestStatusProgress } from '../test-plan-list/TestStatusProgress';
import { ExecutorAvatarStack } from '../test-plan-list/ExecutorAvatarStack';
import { PriorityBadge } from '../test-plan-list/PriorityBadge';

const TestPlanDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [data, setData] = useState<TestPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await getTestPlanDetail(id);
        setData(result);
      } catch (err) {
        logger.error('获取测试计划详情失败', err);
        setError('加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center h-60 gap-4">
        <AlertTriangle className="size-8 text-destructive" />
        <p className="text-muted-foreground">{error || '测试计划不存在'}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/test-plans')}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-[1200px] mx-auto" data-ai-section-type="card-list">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/test-plans')}
          className="h-8"
        >
          <ArrowLeft className="size-4" />
          返回列表
        </Button>
      </div>

      {/* Title Card */}
      <div className="bg-card border border-border rounded-sm p-6">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-heading font-semibold text-foreground truncate">
                {data.planName}
              </h1>
              <PriorityBadge priority={data.priority} />
            </div>
            <div className="text-sm text-muted-foreground font-mono">
              ID: {data.baseRecordId || data.id}
            </div>
          </div>
          <div className="shrink-0 w-[260px]">
            <TestStatusProgress status={data.testStatus} />
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 基本信息 */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="size-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">基本信息</h2>
          </div>
          <div className="space-y-3">
            <InfoRow label="测试状态" value={data.testStatus || '-'} />
            <InfoRow label="优先级" value={data.priority || '-'} />
            <InfoRow label="计划类型" value={data.testPlanType || '-'} />
            <InfoRow label="业务线" value={data.businessLine || '-'} />
          </div>
        </div>

        {/* 执行团队 */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">执行团队</h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20 shrink-0">执行人</span>
              <ExecutorAvatarStack userIds={data.executor} max={5} size="medium" />
            </div>
            {data.executor.length > 0 && (
              <div className="text-xs text-muted-foreground pl-[88px]">
                共 {data.executor.length} 人
              </div>
            )}
          </div>
        </div>

        {/* 时间节点 */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="size-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">时间节点</h2>
          </div>
          <div className="space-y-3">
            <InfoRow label="预计开始" value={data.expectedStartDate || '-'} mono />
            <InfoRow label="预计结束" value={data.expectedEndDate || '-'} mono />
          </div>
        </div>

        {/* 关联版本 */}
        <div className="bg-card border border-border rounded-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Layers className="size-4 text-primary" />
            <h2 className="text-sm font-heading font-semibold text-foreground">关联版本</h2>
          </div>
          <div className="space-y-3">
            {data.relatedVersion ? (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-20 shrink-0">版本名称</span>
                <Link
                  to={`/versions/${data.relatedVersion}`}
                  className="text-sm text-primary hover:underline truncate"
                >
                  {data.relatedVersionName || data.relatedVersion}
                </Link>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无关联版本</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface InfoRowProps {
  label: string;
  value: string;
  mono?: boolean;
}

function InfoRow({ label, value, mono }: InfoRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span
        className={cn('text-sm text-foreground', mono && 'font-mono tabular-nums')}
      >
        {value}
      </span>
    </div>
  );
}

function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export default TestPlanDetailPage;
