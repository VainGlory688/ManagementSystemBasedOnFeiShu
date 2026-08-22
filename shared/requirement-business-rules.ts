export type RequirementAggregatedStatus = '待拆分' | '进行中' | '已完成' | '已逾期';

export interface RequirementStatusItem {
  appStatus: string | null | undefined;
  appExpectedEndDate: Date | string | null | undefined;
}

export interface PipelineStatusItem {
  id: string;
  status: string | null | undefined;
}

export interface PipelineEdge {
  source: string;
  target: string;
}

export interface GanttDateRange {
  startDate: string;
  endDate: string;
}

const DAY_IN_MILLISECONDS = 86_400_000;

function toDateKey(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const dateKey = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(dateKey) ? dateKey : null;
}

function dateKeyToUtcMilliseconds(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcMillisecondsToDateKey(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function isCompletedPipelineStatus(status: string | null | undefined): boolean {
  return status === '已完成' || status === '已上线';
}

export function getOverdueDays(
  expectedEndDate: Date | string | null | undefined,
  status: string | null | undefined,
  today = new Date(),
): number {
  if (!expectedEndDate || status === '已完成') return 0;
  const dueDateKey = toDateKey(expectedEndDate);
  if (!dueDateKey) return 0;
  const todayKey = toDateKey(today);
  if (!todayKey) return 0;
  return Math.max(0, Math.floor(
    (dateKeyToUtcMilliseconds(todayKey) - dateKeyToUtcMilliseconds(dueDateKey)) / DAY_IN_MILLISECONDS,
  ));
}

export function aggregateRequirementStatus(
  items: RequirementStatusItem[],
  today = new Date(),
): RequirementAggregatedStatus {
  if (items.length === 0) return '待拆分';
  if (items.every((item) => item.appStatus === '已完成')) return '已完成';
  if (items.some((item) => getOverdueDays(item.appExpectedEndDate, item.appStatus, today) > 0)) {
    return '已逾期';
  }
  return '进行中';
}

export function getBlockedPipelineNodeIds(
  items: PipelineStatusItem[],
  edges: PipelineEdge[],
): Set<string> {
  const statusById = new Map(items.map((item) => [item.id, item.status]));
  const itemIds = new Set(statusById.keys());
  return new Set(
    edges
      .filter((edge) =>
        itemIds.has(edge.source)
        && itemIds.has(edge.target)
        && !isCompletedPipelineStatus(statusById.get(edge.source)),
      )
      .map((edge) => edge.target),
  );
}

export function getIncompletePipelinePredecessorIds(
  itemId: string,
  items: PipelineStatusItem[],
  edges: PipelineEdge[],
): string[] {
  const statusById = new Map(items.map((item) => [item.id, item.status]));
  return edges
    .filter((edge) =>
      edge.target === itemId
      && statusById.has(edge.source)
      && !isCompletedPipelineStatus(statusById.get(edge.source)),
    )
    .map((edge) => edge.source);
}

export function shiftGanttDates(
  startDate: string,
  endDate: string,
  dayDelta: number,
): GanttDateRange {
  const start = dateKeyToUtcMilliseconds(startDate);
  const end = dateKeyToUtcMilliseconds(endDate);
  return {
    startDate: utcMillisecondsToDateKey(start + dayDelta * DAY_IN_MILLISECONDS),
    endDate: utcMillisecondsToDateKey(end + dayDelta * DAY_IN_MILLISECONDS),
  };
}

export function resizeGanttEndDate(
  startDate: string,
  originalEndDate: string,
  dayDelta: number,
): GanttDateRange | null {
  const proposedEnd = dateKeyToUtcMilliseconds(originalEndDate) + dayDelta * DAY_IN_MILLISECONDS;
  const nextEnd = Math.max(proposedEnd, dateKeyToUtcMilliseconds(startDate));
  const nextEndDate = utcMillisecondsToDateKey(nextEnd);
  if (nextEndDate === originalEndDate) return null;
  return { startDate, endDate: nextEndDate };
}

export function resizeGanttStartDate(
  originalStartDate: string,
  endDate: string,
  dayDelta: number,
): GanttDateRange | null {
  const proposedStart = dateKeyToUtcMilliseconds(originalStartDate) + dayDelta * DAY_IN_MILLISECONDS;
  const nextStart = Math.min(proposedStart, dateKeyToUtcMilliseconds(endDate));
  const nextStartDate = utcMillisecondsToDateKey(nextStart);
  if (nextStartDate === originalStartDate) return null;
  return { startDate: nextStartDate, endDate };
}
