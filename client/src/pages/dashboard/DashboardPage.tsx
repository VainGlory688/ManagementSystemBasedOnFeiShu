import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import CountUp from 'react-countup';
import {
  Layers,
  ListTodo,
  Bug,
  ClipboardList,
  Clock,
  ArrowRight,
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { logger } from '@lark-apaas/client-toolkit/logger';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserDisplay } from '@/components/business-ui/user-display';
import { PillBadge } from '@/pages/defect-list/badge-helpers';
import { PriorityBadge } from '@/pages/test-plan-list/PriorityBadge';
import { getStatusInfo } from '@/utils/version-helpers';

import {
  getDashboardKpis,
  getDefectSeverity,
  getBusinessLineStats,
  getVersionStatus,
  getRecentActivities,
} from '@/api/dashboard';
import type {
  DashboardKpis,
  DefectSeverityResponse,
  BusinessLineStatsResponse,
  VersionStatusResponse,
  RecentActivitiesResponse,
  RecentActivity,
  ActivityType,
} from '@shared/api.interface';

/* ---------- KPI 配置 ---------- */

interface KpiConfig {
  key: keyof DashboardKpis;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  accent: string;
}

const KPI_CONFIG: KpiConfig[] = [
  {
    key: 'activeVersions',
    label: '进行中版本',
    icon: Layers,
    href: '/versions',
    accent: 'from-[hsl(215_60%_28%)] to-[hsl(215_50%_38%)]',
  },
  {
    key: 'pendingRequirements',
    label: 'P0 待处理需求',
    icon: ListTodo,
    href: '/requirements?priority=P0',
    accent: 'from-[hsl(28_85%_52%)] to-[hsl(38_90%_60%)]',
  },
  {
    key: 'activeDefects',
    label: '活跃缺陷数',
    icon: Bug,
    href: '/defects',
    accent: 'from-[hsl(4_75%_52%)] to-[hsl(28_85%_52%)]',
  },
  {
    key: 'activeTestPlans',
    label: '进行中测试计划',
    icon: ClipboardList,
    href: '/test-plans',
    accent: 'from-[hsl(160_55%_42%)] to-[hsl(215_60%_48%)]',
  },
];

/* ---------- 工具函数 ---------- */

function getActivityHref(type: ActivityType, targetId: string): string {
  switch (type) {
    case 'version':
      return `/versions/${targetId}`;
    case 'requirement':
      return `/requirements/${targetId}`;
    case 'defect':
      return `/defects/${targetId}`;
    default:
      return '#';
  }
}

function getActivityTypeLabel(type: ActivityType): string {
  switch (type) {
    case 'version':
      return '版本';
    case 'requirement':
      return '需求';
    case 'defect':
      return '缺陷';
    default:
      return '';
  }
}

function getDefectSeverityChartColor(severity: string): string {
  switch (severity) {
    case '紧急':
    case '致命':
      return 'hsl(4, 75%, 52%)';
    case '严重':
      return 'hsl(38, 90%, 50%)';
    case '一般':
      return 'hsl(160, 55%, 42%)';
    case '优化':
    case '提示':
      return 'hsl(270, 45%, 55%)';
    default:
      return 'hsl(215, 12%, 58%)';
  }
}

function getVersionStatusChartColor(status: string): string {
  switch (status) {
    case '进行中':
      return 'hsl(215, 60%, 28%)';
    case '开发中':
      return 'hsl(38, 90%, 50%)';
    case '已发布':
    case '已结束':
      return 'hsl(160, 55%, 42%)';
    case '未开始':
    case '未启动':
    case '已关闭':
    default:
      return 'hsl(215, 12%, 50%)';
  }
}

function ActivityStatusBadge({ item }: { item: RecentActivity }) {
  if (item.type === 'defect') {
    return <PillBadge text={item.status} variant="severity" />;
  }

  if (item.type === 'requirement') {
    return <PriorityBadge priority={item.status} />;
  }

  const statusInfo = getStatusInfo(item.status);
  return (
    <Badge
      variant="outline"
      className={`h-[22px] px-2 text-xs font-medium rounded-full ${statusInfo.className}`}
    >
      <span className={`size-1.5 rounded-full mr-1.5 ${statusInfo.dot}`} />
      {statusInfo.label}
    </Badge>
  );
}

/* ---------- 主组件 ---------- */

const DashboardPage = () => {
  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [defectSeverity, setDefectSeverity] =
    useState<DefectSeverityResponse | null>(null);
  const [businessLineStats, setBusinessLineStats] =
    useState<BusinessLineStatsResponse | null>(null);
  const [versionStatus, setVersionStatus] =
    useState<VersionStatusResponse | null>(null);
  const [recentActivities, setRecentActivities] =
    useState<RecentActivitiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadAll = async (): Promise<void> => {
      try {
        const [k, d, b, v, r] = await Promise.all([
          getDashboardKpis(),
          getDefectSeverity(),
          getBusinessLineStats(),
          getVersionStatus(),
          getRecentActivities(10),
        ]);
        if (cancelled) return;
        setKpis(k);
        setDefectSeverity(d);
        setBusinessLineStats(b);
        setVersionStatus(v);
        setRecentActivities(r);
      } catch (err) {
        if (cancelled) return;
        logger.error('仪表盘数据加载失败', err);
        setError('数据加载失败，请稍后重试');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---------- 图表配置 ---------- */

  const defectSeverityOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'hsl(215, 25%, 12%)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: 'hsl(215, 12%, 50%)',
        fontSize: 12,
      },
    },
    series: [
      {
        name: '缺陷严重程度',
        type: 'pie',
        radius: ['55%', '75%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 2,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: false },
        },
        animationType: 'scale',
        animationDuration: 800,
        animationEasing: 'cubicOut',
        data: (defectSeverity?.items ?? []).map(
          (item: { severity: string; count: number }) => ({
            name: item.severity,
            value: item.count,
            itemStyle: {
              color: getDefectSeverityChartColor(item.severity),
            },
          }),
        ),
      },
    ],
  };

  const businessLineOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'hsl(215, 25%, 12%)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      axisPointer: {
        type: 'shadow',
      },
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: 'hsl(215, 12%, 50%)',
        fontSize: 12,
      },
      data: ['需求数', '缺陷数'],
    },
    grid: {
      top: 24,
      left: 40,
      right: 16,
      bottom: 40,
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: businessLineStats?.items.map(
        (item: { businessLine: string }) => item.businessLine,
      ) ?? [],
      axisLine: {
        lineStyle: { color: 'hsl(215, 15%, 88%)' },
      },
      axisTick: { show: false },
      axisLabel: {
        color: 'hsl(215, 12%, 50%)',
        fontSize: 11,
        interval: 0,
        rotate: businessLineStats && businessLineStats.items.length > 4 ? 30 : 0,
      },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: {
        lineStyle: {
          color: 'hsl(215, 15%, 88%)',
          type: 'dashed',
        },
      },
      axisLabel: {
        color: 'hsl(215, 12%, 50%)',
        fontSize: 11,
      },
    },
    series: [
      {
        name: '需求数',
        type: 'bar',
        barWidth: '30%',
        itemStyle: {
          color: 'hsl(215, 60%, 28%)',
          borderRadius: [2, 2, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: 'hsl(215, 60%, 35%)',
          },
        },
        animationDuration: 800,
        animationEasing: 'cubicOut',
        data: businessLineStats?.items.map(
          (item: { requirementCount: number }) =>
            item.requirementCount,
        ) ?? [],
      },
      {
        name: '缺陷数',
        type: 'bar',
        barWidth: '30%',
        itemStyle: {
          color: 'hsl(4, 75%, 52%)',
          borderRadius: [2, 2, 0, 0],
        },
        emphasis: {
          itemStyle: {
            color: 'hsl(4, 75%, 60%)',
          },
        },
        animationDuration: 800,
        animationEasing: 'cubicOut',
        data: businessLineStats?.items.map(
          (item: { defectCount: number }) => item.defectCount,
        ) ?? [],
      },
    ],
  };

  const versionStatusOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      backgroundColor: 'hsl(215, 25%, 12%)',
      borderColor: 'transparent',
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: '{b}: {c} ({d}%)',
    },
    legend: {
      bottom: 0,
      left: 'center',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: {
        color: 'hsl(215, 12%, 50%)',
        fontSize: 12,
      },
    },
    series: [
      {
        name: '版本状态',
        type: 'pie',
        radius: '70%',
        center: ['50%', '42%'],
        itemStyle: {
          borderRadius: 2,
          borderColor: '#fff',
          borderWidth: 2,
        },
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: false },
        },
        animationDuration: 800,
        animationEasing: 'cubicOut',
        data: (versionStatus?.items ?? []).map(
          (item: { status: string; count: number }) => ({
            name: item.status,
            value: item.count,
            itemStyle: {
              color: getVersionStatusChartColor(item.status),
            },
          }),
        ),
      },
    ],
  };

  /* ---------- 渲染 ---------- */

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        {error}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-4 max-w-full"
    >
      {/* KPI 卡片行 */}
      <div
        data-ai-section-type="card-stat"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {KPI_CONFIG.map((cfg: KpiConfig, idx: number) => {
          const Icon = cfg.icon;
          const value = kpis?.[cfg.key] ?? 0;
          return (
            <motion.div
              key={cfg.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: 0.1 * idx,
                ease: 'easeOut',
              }}
              whileHover={{ y: -2 }}
            >
              <Link to={cfg.href}>
                <Card className="relative overflow-hidden border border-border rounded-sm h-full cursor-pointer transition-shadow duration-200 hover:shadow-md">
                  <div
                  className={`absolute inset-0 bg-gradient-to-br ${cfg.accent} opacity-10 pointer-events-none`}
                  />
                  <CardContent className="relative p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-2">
                        <span className="text-sm text-muted-foreground font-medium">
                          {cfg.label}
                        </span>
                        <span className="font-mono text-3xl font-semibold text-foreground tabular-nums">
                          {loading ? (
                            <span className="inline-block w-16 h-8 bg-muted rounded-sm animate-pulse" />
                          ) : (
                            <CountUp
                              end={value}
                              duration={0.6}
                              separator=","
                            />
                          )}
                        </span>
                      </div>
                      <div className="p-2 rounded-sm bg-background/80 backdrop-blur-sm">
                        <Icon className="size-5 text-primary" />
                      </div>
                    </div>
                    <div className="mt-4 flex items-center text-xs text-muted-foreground">
                      <span>查看详情</span>
                      <ArrowRight className="ml-1 size-3" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* 图表区 */}
      <div
        data-ai-section-type="card-list"
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4, ease: 'easeOut' }}
        >
          <Card className="rounded-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-heading text-base">
                缺陷严重程度分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {!loading && defectSeverity ? (
                  <ReactECharts
                    option={defectSeverityOption}
                    style={{ height: '100%', width: '100%' }}
                    notMerge
                    lazyUpdate
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                  加载中...
                </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5, ease: 'easeOut' }}
        >
          <Card className="rounded-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-heading text-base">
                各业务线需求/缺陷对比
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {!loading && businessLineStats ? (
                  <ReactECharts
                    option={businessLineOption}
                    style={{ height: '100%', width: '100%' }}
                    notMerge
                    lazyUpdate
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                    加载中...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6, ease: 'easeOut' }}
        >
          <Card className="rounded-sm border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold font-heading text-base">
                版本状态分布
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                {!loading && versionStatus ? (
                  <ReactECharts
                    option={versionStatusOption}
                    style={{ height: '100%', width: '100%' }}
                    notMerge
                    lazyUpdate
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                    加载中...
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 最近动态 */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.7, ease: 'easeOut' }}
      >
        <Card className="rounded-sm border-border">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold font-heading text-base flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              最近动态
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {loading || !recentActivities ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                加载中...
              </div>
            ) : recentActivities.items.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                暂无动态
              </div>
            ) : (
              <ul className="divide-y divide-border -mx-6">
                {recentActivities.items.map(
                  (item: RecentActivity, idx: number) => {
                    return (
                      <motion.li
                        key={item.id}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: 0.8 + idx * 0.05,
                          ease: 'easeOut',
                        }}
                        whileHover={{ x: 4 }}
                        className="group"
                      >
                        <Link
                          to={getActivityHref(item.type, item.targetId)}
                          className="block px-6 py-3 hover:bg-accent/50 transition-colors duration-150 flex items-center gap-4"
                        >
                          <Badge
                            variant="outline"
                            className="shrink-0 h-5.5 px-2 text-[11px] font-medium"
                            style={{ height: 22 }}
                          >
                            {getActivityTypeLabel(item.type)}
                          </Badge>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm text-foreground font-medium">
                                {item.title}
                              </span>
                              <ActivityStatusBadge item={item} />
                            </div>
                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="font-mono">
                                {new Date(item.updatedAt).toLocaleString(
                                  'zh-CN',
                                  {
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  },
                                )}
                              </span>
                              {item.ownerId && (
                                <div className="flex min-w-0 items-center gap-1">
                                  负责人：
                                  <UserDisplay
                                    value={item.ownerId}
                                    size="small"
                                    showLabel
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          <ArrowRight className="size-4 text-muted-foreground/50 group-hover:text-primary transition-colors duration-200" />
                        </Link>
                      </motion.li>
                    );
                  },
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default DashboardPage;
