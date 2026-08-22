import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Bug, ChevronRight, CircleAlert, CircleCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { VersionSummary, DefectSeverityStat } from '@shared/api.interface';

interface SummaryCardsProps {
  summary: VersionSummary | null;
  versionId: string;
}

const SEVERITY_ORDER = ['致命', '严重', '一般', '轻微', '未知'];
const SEVERITY_COLORS: Record<string, { bar: string; text: string; bg: string }> = {
  致命: { bar: 'bg-severity-fatal', text: 'text-severity-fatal', bg: 'bg-severity-fatal-bg' },
  严重: { bar: 'bg-severity-major', text: 'text-severity-major', bg: 'bg-severity-major-bg' },
  一般: { bar: 'bg-severity-normal', text: 'text-severity-normal', bg: 'bg-severity-normal-bg' },
  轻微: { bar: 'bg-severity-minor', text: 'text-severity-minor', bg: 'bg-severity-minor-bg' },
  未知: { bar: 'bg-muted-foreground/30', text: 'text-muted-foreground', bg: 'bg-muted' },
};

const SummaryCards = ({ summary, versionId }: SummaryCardsProps) => {
  const [animateProgress, setAnimateProgress] = useState(false);

  useEffect(() => {
    if (summary) {
      const t = setTimeout(() => setAnimateProgress(true), 200);
      return () => clearTimeout(t);
    }
  }, [summary]);

  const sortedSeverities: DefectSeverityStat[] = summary
    ? [...summary.defectBySeverity].sort(
        (a: DefectSeverityStat, b: DefectSeverityStat) =>
          SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
      )
    : [];

  const totalDefects = summary?.defectCount ?? 0;

  return (
    <div className="flex flex-col gap-3">
      <Card className={`border rounded-sm ${summary?.canClose ? 'border-success/40 bg-success/5' : 'border-warning/40 bg-warning/5'}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-2.5">
            {summary?.canClose ? (
              <CircleCheck className="mt-0.5 size-4 text-success" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 text-warning" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground">关版就绪</div>
              {!summary ? (
                <div className="mt-1 text-xs text-muted-foreground">正在检查关联事项…</div>
              ) : summary.canClose ? (
                <div className="mt-1 text-xs text-success">所有关联需求、缺陷和测试计划均已完成，可关闭版本。</div>
              ) : (
                <>
                  <div className="mt-1 text-xs text-warning">关闭版本前请处理以下事项：</div>
                  <ul className="mt-1.5 space-y-1 text-xs text-foreground/80">
                    {summary.closureBlockers.map((blocker) => (
                      <li key={blocker}>• {blocker}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 测试计划数量卡 */}
      <Link
        to={`/test-plans?planningVersion=${encodeURIComponent(versionId)}`}
        className="block group"
      >
        <Card className="border border-border rounded-sm transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5 hover:border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-sm bg-info/10 text-info">
                  <FileText className="size-4.5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">测试计划</div>
                  <div className="mt-0.5 font-mono text-2xl font-semibold text-foreground tabular-nums">
                    {summary ? summary.testPlanCount : '--'}
                  </div>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* 缺陷总数卡 */}
      <Link
        to={`/defects?planningVersion=${encodeURIComponent(versionId)}`}
        className="block group"
      >
        <Card className="border border-border rounded-sm transition-all duration-300 hover:shadow-sm hover:-translate-y-0.5 hover:border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-sm bg-destructive/10 text-destructive">
                  <Bug className="size-4.5" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">缺陷总数</div>
                  <div className="mt-0.5 font-mono text-2xl font-semibold text-foreground tabular-nums">
                    {summary ? totalDefects : '--'}
                  </div>
                </div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-destructive" />
            </div>

            {/* 严重程度分色进度条 */}
            {sortedSeverities.length > 0 && (
              <div className="space-y-2 mt-3">
                {sortedSeverities.map((s: DefectSeverityStat) => {
                  const color = SEVERITY_COLORS[s.severity] ?? SEVERITY_COLORS.未知;
                  const percent = totalDefects > 0 ? (s.count / totalDefects) * 100 : 0;
                  return (
                    <div key={s.severity}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className={color.text}>{s.severity}</span>
                        <span className="font-mono text-muted-foreground">{s.count}</span>
                      </div>
                      <div className={`h-1.5 rounded-sm ${color.bg} overflow-hidden`}>
                        <div
                          className={`h-full ${color.bar} rounded-sm transition-all ease-out`}
                          style={{
                            width: animateProgress ? `${percent}%` : '0%',
                            transitionDuration: '900ms',
                            transitionDelay: '100ms',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {summary && sortedSeverities.length === 0 && (
              <div className="text-xs text-muted-foreground pt-1">暂无缺陷数据</div>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
};

export { SummaryCards };
