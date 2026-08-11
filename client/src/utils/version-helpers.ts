import type { MainVersion } from '@shared/api.interface';

/** 版本状态 → 语义标签 variant + 展示文本 */
export const STATUS_MAP: Record<string, { label: string; variant: string; dot: string; className: string }> = {
  未开始: { label: '未开始', variant: 'outline', dot: 'bg-muted-foreground', className: 'bg-muted text-muted-foreground border-border' },
  未启动: { label: '未启动', variant: 'outline', dot: 'bg-muted-foreground', className: 'bg-muted text-muted-foreground border-border' },
  进行中: { label: '进行中', variant: 'default', dot: 'bg-primary', className: 'bg-primary/10 text-primary border-primary/20' },
  开发中: { label: '开发中', variant: 'outline', dot: 'bg-[hsl(38_90%_50%)]', className: 'bg-[hsl(38_70%_93%)] text-[hsl(38_75%_30%)] border-[hsl(38_90%_50%)]' },
  已发布: { label: '已发布', variant: 'success', dot: 'bg-success', className: 'bg-success/10 text-success border-success/20' },
  已关闭: { label: '已关闭', variant: 'outline', dot: 'border border-muted-foreground', className: 'bg-muted text-muted-foreground border-border' },
  已结束: { label: '已结束', variant: 'outline', dot: 'bg-[hsl(160_55%_42%)]', className: 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]' },
};

export function getStatusInfo(status: string) {
  return STATUS_MAP[status] ?? { label: status || '未知', variant: 'outline', dot: 'bg-muted-foreground', className: 'bg-muted text-muted-foreground border-border' };
}

/** 优先级 → 颜色 token */
export const PRIORITY_MAP: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  P0: {
    label: 'P0',
    bg: 'bg-priority-p0',
    fg: 'text-priority-p0-foreground',
    border: 'border-transparent',
  },
  P1: {
    label: 'P1',
    bg: 'bg-priority-p1',
    fg: 'text-priority-p1-foreground',
    border: 'border-transparent',
  },
  P2: {
    label: 'P2',
    bg: 'bg-priority-p2',
    fg: 'text-[hsl(40_100%_12%)]',
    border: 'border-transparent',
  },
  待定: {
    label: '待定',
    bg: 'bg-transparent',
    fg: 'text-muted-foreground',
    border: 'border-border',
  },
  历史遗留: {
    label: '历史遗留',
    bg: 'bg-priority-p3-bg',
    fg: 'text-priority-p3',
    border: 'border-transparent',
  },
};

export function getPriorityInfo(priority: string) {
  const key = priority?.toUpperCase?.();
  return PRIORITY_MAP[key] ?? {
    label: priority || '-',
    bg: 'bg-muted',
    fg: 'text-muted-foreground',
    border: 'border-muted',
  };
}

export const VERSION_TYPE_MAP: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  主版本发布: {
    label: '主版本发布',
    bg: 'bg-[hsl(160_40%_94%)]',
    fg: 'text-[hsl(160_55%_32%)]',
    border: 'border-[hsl(160_55%_42%)]',
  },
  运营版本发布: {
    label: '运营版本发布',
    bg: 'bg-primary/10',
    fg: 'text-primary',
    border: 'border-primary',
  },
  Bug修复版本发布: {
    label: 'Bug修复版本发布',
    bg: 'bg-severity-fatal-bg',
    fg: 'text-severity-fatal',
    border: 'border-severity-fatal',
  },
};

export function getVersionTypeInfo(versionType: string) {
  return VERSION_TYPE_MAP[versionType] ?? {
    label: versionType || '-',
    bg: 'bg-muted',
    fg: 'text-muted-foreground',
    border: 'border-border',
  };
}

const PRIORITY_ROW_CLASS: Record<string, string> = {
  P0: 'bg-priority-p0-bg/55',
  P1: 'bg-priority-p1-bg/50',
  P2: 'bg-priority-p2-bg/45',
  历史遗留: 'bg-priority-p3-bg/45',
};

export function getPriorityRowClass(priority: string): string {
  return PRIORITY_ROW_CLASS[priority?.toUpperCase?.()] || '';
}

/** 风险等级判定 */
export function isHighRisk(version: MainVersion): boolean {
  const risk = (version.versionRisk || '').trim();
  if (!risk) return false;
  return (
    risk.includes('高') ||
    risk.includes('严重') ||
    risk.includes('P0') ||
    risk.includes('阻塞') ||
    risk.includes('紧急')
  );
}

/** 里程碑节点：顺序即时间线顺序 */
export interface MilestoneNode {
  key: string;
  label: string;
  date: string;
  actualDate?: string;
  status: 'done' | 'current' | 'pending';
}

export function buildMilestones(version: MainVersion): MilestoneNode[] {
  const rawNodes: Array<{ key: string; label: string; date: string }> = [
    { key: 'start', label: '版本开始', date: version.versionStartDate },
    { key: 'pack', label: '打包', date: version.packTime },
    { key: 'test', label: '提测', date: version.expectedTestTime },
    { key: 'gray', label: '灰度', date: version.actualGrayDate || '' },
    { key: 'release', label: '发布', date: version.actualReleaseDate || '' },
    { key: 'close', label: '关闭', date: version.versionCloseDate },
  ];

  const currentIndex = rawNodes.findIndex((node) => !node.date);
  return rawNodes.map((n, i) => {
    const s: MilestoneNode['status'] = n.date
      ? 'done'
      : i === currentIndex
        ? 'current'
        : 'pending';
    return { ...n, status: s };
  });
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
