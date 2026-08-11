import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';

import { UserDisplay } from '@/components/business-ui/user-display';
import type { UserInput } from '@/components/business-ui/types/user';
import { cn } from '@/lib/utils';
import type { SubRequirementItem, VersionRequirement } from '@shared/api.interface';

const DAY_WIDTH = 88;
const PERSON_WIDTH = 88;
const ROW_PADDING = 8;
const TASK_HEIGHT = 22;
const PARENT_HEIGHT = 38;
const ROW_GAP = 8;
const LANE_STRIDE = PARENT_HEIGHT + ROW_GAP;

export const GANTT_PRIORITIES = [
  {
    key: 'P0',
    label: 'P0',
    className: 'bg-priority-p0-bg border-priority-p0',
    taskClassName: 'bg-priority-p0-bg text-priority-p0 border-priority-p0',
    lineClassName: 'bg-priority-p0',
  },
  {
    key: 'P1',
    label: 'P1',
    className: 'bg-priority-p1-bg border-priority-p1',
    taskClassName: 'bg-priority-p1-bg text-priority-p1 border-priority-p1',
    lineClassName: 'bg-priority-p1',
  },
  {
    key: 'P2',
    label: 'P2',
    className: 'bg-priority-p2-bg border-priority-p2',
    taskClassName: 'bg-priority-p2-bg text-priority-p2 border-priority-p2',
    lineClassName: 'bg-priority-p2',
  },
  {
    key: '待定',
    label: '待定',
    className: 'bg-muted border-border',
    taskClassName: 'bg-muted text-muted-foreground border-border',
    lineClassName: 'bg-border',
  },
  {
    key: '历史遗留',
    label: '历史遗留',
    className: 'bg-priority-p3-bg text-priority-p3 border-priority-p3',
    taskClassName: 'bg-priority-p3-bg/50 text-priority-p3 border-priority-p3',
    lineClassName: 'bg-priority-p3',
  },
] as const;

export const GANTT_STATUSES = [
  { key: '已完成', label: '已完成', className: 'border-[hsl(160_55%_42%)] bg-[hsl(160_40%_94%)]' },
  { key: '进行中', label: '进行中', className: 'border-[hsl(38_90%_50%)] bg-[hsl(38_70%_93%)]' },
  { key: '未处理', label: '未处理', className: 'border-border bg-muted' },
] as const;

const priorityTopBorderClassMap = new Map<string, string>([
  ['P0', 'border-t-priority-p0'],
  ['P1', 'border-t-priority-p1'],
  ['P2', 'border-t-priority-p2'],
  ['待定', 'border-t-border'],
  ['历史遗留', 'border-t-priority-p3'],
]);

interface GanttTask {
  item: SubRequirementItem;
  startIndex: number;
  duration: number;
  lane: number;
}

interface GanttRow {
  ownerId: string;
  parentGroups: ParentGroup[];
}

interface ParentGroup {
  key: string;
  tasks: GanttTask[];
  laneCount: number;
}

interface PersonnelGanttChartProps {
  rangeStart: Dayjs;
  rangeEnd: Dayjs;
  items: SubRequirementItem[];
  personIds: string[];
  userProfiles: Record<string, UserInput>;
  requirements?: VersionRequirement[];
}

function getStatusTaskClass(status?: string): string {
  if (status === '已完成') {
    return 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)]';
  }
  if (status === '进行中' || status === '开发中') {
    return 'bg-[hsl(38_70%_93%)] text-[hsl(38_75%_30%)] border-[hsl(38_90%_50%)]';
  }
  return 'bg-muted text-muted-foreground border-border';
}

function getPriorityTopBorderClass(priority: string): string {
  return priorityTopBorderClassMap.get(priority) ?? 'border-t-border';
}

function buildRows(
  items: SubRequirementItem[],
  rangeStart: Dayjs,
  rangeEnd: Dayjs,
  personIds: string[],
  _requirements: VersionRequirement[] = [],
): GanttRow[] {
  const grouped = new Map(personIds.map((personId) => [personId, []] as [string, SubRequirementItem[]]));
  for (const item of items) {
    if (!item.appExpectedStartDate) continue;
    const ownerId = item.appCurrentOwner || 'unassigned';
    grouped.set(ownerId, [...(grouped.get(ownerId) ?? []), item]);
  }

  return Array.from(grouped.entries()).map(([ownerId, ownerItems]) => {
    const laneEnds: number[] = [];
    const tasks = ownerItems
      .map((item) => {
        const start = dayjs(item.appExpectedStartDate).startOf('day');
        const end = dayjs(item.appExpectedEndDate || item.appExpectedStartDate).startOf('day');
        const visibleStart = start.isBefore(rangeStart) ? rangeStart : start;
        const visibleEnd = end.isAfter(rangeEnd) ? rangeEnd : end;

        return {
          item,
          startIndex: visibleStart.diff(rangeStart, 'day'),
          duration: Math.max(1, visibleEnd.diff(visibleStart, 'day') + 1),
          start: visibleStart.valueOf(),
        };
      })
      .sort((a, b) => a.start - b.start)
      .map(({ start, ...task }) => {
        const lane = laneEnds.findIndex((laneEnd) => laneEnd < task.startIndex);
        const assignedLane = lane === -1 ? laneEnds.length : lane;
        laneEnds[assignedLane] = task.startIndex + task.duration - 1;
        return { ...task, lane: assignedLane };
      });

    return {
      ownerId,
      parentGroups: [{
        key: ownerId,
        tasks,
        laneCount: Math.max(1, laneEnds.length),
      }],
    };
  });
}

export function PersonnelGanttChart({
  rangeStart,
  rangeEnd,
  items,
  personIds,
  userProfiles,
  requirements,
}: PersonnelGanttChartProps) {
  const days = Array.from(
    { length: rangeEnd.diff(rangeStart, 'day') + 1 },
    (_, index) => rangeStart.add(index, 'day'),
  );
  const rows = buildRows(
    Array.isArray(items) ? items : [],
    rangeStart,
    rangeEnd,
    Array.isArray(personIds) ? personIds : [],
    requirements,
  );
  const timelineWidth = days.length * DAY_WIDTH;
  const today = dayjs().startOf('day');
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const rowLayouts = rows.map((row) => {
    const contentHeight = row.parentGroups.reduce(
      (height, group) => height + group.laneCount * PARENT_HEIGHT + (group.laneCount - 1) * ROW_GAP,
      0,
    );
    return {
      ...row,
      rowHeight: Math.max(PARENT_HEIGHT + ROW_PADDING * 2, contentHeight + ROW_PADDING * 2),
    };
  });

  useEffect(() => {
    const todayIndex = today.diff(rangeStart, 'day');
    const nextScrollLeft = todayIndex >= 0 && todayIndex < days.length ? todayIndex * DAY_WIDTH : 0;
    setTimelineScrollLeft(nextScrollLeft);
    if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = nextScrollLeft;
  }, [rangeEnd.valueOf(), rangeStart.valueOf()]);

  if (rows.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
        当前视图没有可展示的人员
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-240px)] overflow-y-auto border border-border">
      <div className="sticky top-0 z-20 flex h-14 border-b border-border bg-card">
          <div
            className="flex shrink-0 items-center justify-center border-r border-border bg-card px-2 text-center text-xs font-semibold text-foreground"
            style={{ width: PERSON_WIDTH }}
          >
            人员
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <div className="grid" style={{ width: timelineWidth, transform: `translateX(-${timelineScrollLeft}px)`, gridTemplateColumns: `repeat(${days.length}, ${DAY_WIDTH}px)` }}>
            {days.map((day) => {
              const isWeekend = day.day() === 0 || day.day() === 6;
              const isToday = day.isSame(today, 'day');
              return (
                <div
                  key={day.format('YYYY-MM-DD')}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-border text-[10px] font-mono',
                    isWeekend && 'bg-muted/90',
                    isToday && 'bg-primary text-primary-foreground',
                  )}
                >
                  <span className="text-xs font-bold">{day.format('MM/DD')}</span>
                  <span className="mt-0.5 text-[10px] font-semibold opacity-80">周{['日', '一', '二', '三', '四', '五', '六'][day.day()]}</span>
                </div>
              );
            })}
            </div>
          </div>
      </div>
      <div className="flex">
        <div className="shrink-0" style={{ width: PERSON_WIDTH }}>
          {rowLayouts.map((row) => (
            <div key={row.ownerId} className="mb-2 flex items-center justify-center border-t border-r border-border bg-card px-2 text-center last:mb-0" style={{ height: row.rowHeight }}>
              {row.ownerId === 'unassigned' ? (
                <span className="text-sm text-muted-foreground">未分配</span>
              ) : (
                <UserDisplay value={userProfiles[row.ownerId] ?? row.ownerId} size="small" className="max-w-full" />
              )}
            </div>
          ))}
        </div>
        <div ref={timelineScrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden" onScroll={(event) => setTimelineScrollLeft(event.currentTarget.scrollLeft)}>
          <div style={{ width: timelineWidth }}>
        {rowLayouts.map((row) => {
          const visibleGroups = row.parentGroups;
          return (
            <div key={row.ownerId} className="mb-2 border-t border-border last:mb-0" style={{ height: row.rowHeight }}>
              <div
                className="relative grid"
                style={{
                  width: timelineWidth,
                  height: row.rowHeight,
                  gridTemplateColumns: `repeat(${days.length}, ${DAY_WIDTH}px)`,
                  gridAutoRows: `${row.rowHeight}px`,
                }}
              >
                {days.map((day, index) => (
                  <div
                    key={day.format('YYYY-MM-DD')}
                    className={cn(
                      'pointer-events-none absolute z-[1] border-r border-dashed border-border/80',
                      (day.day() === 0 || day.day() === 6) && 'bg-muted/90',
                      day.isSame(today, 'day') && 'bg-primary/30',
                    )}
                    style={{ left: index * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: row.rowHeight }}
                  />
                ))}
                {visibleGroups.flatMap((group, groupIndex) => {
                  const top = visibleGroups.slice(0, groupIndex).reduce(
                    (offset, previous) => offset + previous.laneCount * PARENT_HEIGHT + (previous.laneCount - 1) * ROW_GAP,
                    ROW_PADDING,
                  );
                  return Array.from({ length: group.laneCount }, (_, lane) => (
                    <div
                      key={`${group.key}:lane-grid:${lane}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute z-0 border-b border-dashed border-border/80"
                      style={{ left: 0, top: top + lane * LANE_STRIDE, width: timelineWidth, height: PARENT_HEIGHT }}
                    />
                  ));
                })}
                {visibleGroups.map((group, groupIndex) => {
                  const top = visibleGroups.slice(0, groupIndex).reduce(
                    (offset, previous) => offset + previous.laneCount * PARENT_HEIGHT + (previous.laneCount - 1) * ROW_GAP,
                    ROW_PADDING,
                  );
                  return (
                    <div key={group.key}>
                      {group.tasks.map(({ item, startIndex, duration, lane }) => (
                        <Link key={item.id} to={`/sub-requirements/${item.id}`} title={item.appSubRequirementName} className={cn('absolute z-[2] flex items-center overflow-hidden rounded-sm border border-t-[3px] px-2 text-xs font-medium transition-opacity hover:opacity-80', getStatusTaskClass(item.appStatus), getPriorityTopBorderClass(item.appPriority || '待定'))} style={{ left: startIndex * DAY_WIDTH + 6, top: top + lane * LANE_STRIDE + (PARENT_HEIGHT - TASK_HEIGHT) / 2, width: item.appExpectedEndDate ? Math.max(duration * DAY_WIDTH - 12, DAY_WIDTH - 12) : 18, height: TASK_HEIGHT }}>
                          <span className="truncate">↳ {item.appSubRequirementName}</span>
                        </Link>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
        </div>
      </div>
    </div>
  );
}