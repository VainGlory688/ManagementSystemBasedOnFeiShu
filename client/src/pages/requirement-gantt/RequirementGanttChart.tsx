import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs, { type Dayjs } from 'dayjs';

import { UserDisplay } from '@/components/business-ui/user-display';
import { cn } from '@/lib/utils';
import type { SubRequirementItem, VersionRequirement } from '@shared/api.interface';

const DAY_WIDTH = 88;
const REQUIREMENT_WIDTH = 176;
const OWNER_WIDTH = 128;
const LEFT_WIDTH = REQUIREMENT_WIDTH + OWNER_WIDTH;
const TASK_HEIGHT = 22;
const ROW_HEIGHT = 46;

export const REQUIREMENT_GANTT_STATUSES = [
  {
    key: '已完成',
    label: '已完成',
    className: 'border-[hsl(160_55%_42%)] bg-[hsl(160_40%_94%)]',
  },
  {
    key: '进行中',
    label: '进行中',
    className: 'border-[hsl(38_90%_50%)] bg-[hsl(38_70%_93%)]',
  },
  {
    key: '未处理',
    label: '未处理',
    className: 'border-border bg-muted',
  },
] as const;

export const REQUIREMENT_GANTT_PRIORITIES = [
  { key: 'P0', label: 'P0', lineClassName: 'bg-priority-p0' },
  { key: 'P1', label: 'P1', lineClassName: 'bg-priority-p1' },
  { key: 'P2', label: 'P2', lineClassName: 'bg-priority-p2' },
  { key: '待定', label: '待定', lineClassName: 'bg-border' },
  { key: '历史遗留', label: '历史遗留', lineClassName: 'bg-priority-p3' },
] as const;

const priorityTopBorderClassMap = new Map<string, string>([
  ['P0', 'border-t-priority-p0'],
  ['P1', 'border-t-priority-p1'],
  ['P2', 'border-t-priority-p2'],
  ['待定', 'border-t-border'],
  ['历史遗留', 'border-t-priority-p3'],
]);

interface RequirementGroup {
  requirement: VersionRequirement;
  tasks: SubRequirementItem[];
  fallbackToRequirement: boolean;
}

interface RequirementGanttChartProps {
  rangeStart: Dayjs;
  rangeEnd: Dayjs;
  requirements: VersionRequirement[];
  subRequirements: SubRequirementItem[];
}

function getTaskClass(status?: string): string {
  if (status === '已完成') return 'border-[hsl(160_55%_42%)] bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)]';
  if (status === '进行中' || status === '开发中') return 'border-[hsl(38_90%_50%)] bg-[hsl(38_70%_93%)] text-[hsl(38_75%_30%)]';
  return 'bg-muted text-muted-foreground border-border';
}

function getPriorityTopBorderClass(priority?: string): string {
  return priorityTopBorderClassMap.get(priority || '') ?? 'border-t-border';
}

function isInRange(startDate: string | undefined, endDate: string | undefined, rangeStart: Dayjs, rangeEnd: Dayjs): boolean {
  if (!startDate) return false;
  const start = dayjs(startDate);
  const end = endDate ? dayjs(endDate) : start;
  return !end.isBefore(rangeStart, 'day') && !start.isAfter(rangeEnd, 'day');
}

function buildGroups(
  requirements: VersionRequirement[],
  subRequirements: SubRequirementItem[],
  rangeStart: Dayjs,
  rangeEnd: Dayjs,
): RequirementGroup[] {
  return requirements.flatMap<RequirementGroup>((requirement): RequirementGroup[] => {
    const children = subRequirements.filter((subRequirement) => (
      subRequirement.appParentWorkItemRecordId === requirement.baseRecordId
      || subRequirement.appParentWorkItemRecordId === requirement.id
    ));
    const visibleTasks = children.filter((task) => isInRange(
      task.appExpectedStartDate,
      task.appExpectedEndDate,
      rangeStart,
      rangeEnd,
    ));

    if (visibleTasks.length > 0) {
      return [{ requirement, tasks: visibleTasks, fallbackToRequirement: false }];
    }

    return isInRange(
      requirement.proposalTime,
      requirement.estimatedCompletionTime,
      rangeStart,
      rangeEnd,
    ) ? [{ requirement, tasks: [], fallbackToRequirement: true }] : [];
  });
}

export function RequirementGanttChart({
  rangeStart,
  rangeEnd,
  requirements,
  subRequirements,
}: RequirementGanttChartProps) {
  const [timelineScrollLeft, setTimelineScrollLeft] = useState(0);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const days = Array.from(
    { length: rangeEnd.diff(rangeStart, 'day') + 1 },
    (_, index) => rangeStart.add(index, 'day'),
  );
  const groups = buildGroups(requirements, subRequirements, rangeStart, rangeEnd);
  const timelineWidth = days.length * DAY_WIDTH;
  const today = dayjs().startOf('day');

  useEffect(() => {
    const todayIndex = today.diff(rangeStart, 'day');
    const nextScrollLeft = todayIndex >= 0 && todayIndex < days.length ? todayIndex * DAY_WIDTH : 0;
    setTimelineScrollLeft(nextScrollLeft);
    if (timelineScrollRef.current) timelineScrollRef.current.scrollLeft = nextScrollLeft;
  }, [rangeEnd.valueOf(), rangeStart.valueOf()]);

  if (groups.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
        当前视图没有可展示的需求排期
      </div>
    );
  }

  return (
    <div className="max-h-[calc(100vh-240px)] overflow-y-auto border border-border">
      <div className="sticky top-0 z-20 flex h-14 border-b border-border bg-card">
        <div
          className="flex shrink-0 items-center justify-center border-r border-border bg-card px-3 text-center text-xs font-semibold text-foreground"
          style={{ width: REQUIREMENT_WIDTH }}
        >
          需求 / 子需求
        </div>
        <div
          className="flex shrink-0 items-center justify-center border-r border-border bg-card px-3 text-xs font-semibold text-foreground"
          style={{ width: OWNER_WIDTH }}
        >
          负责人
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div
            className="grid"
            style={{
              width: timelineWidth,
              transform: `translateX(-${timelineScrollLeft}px)`,
              gridTemplateColumns: `repeat(${days.length}, ${DAY_WIDTH}px)`,
            }}
          >
            {days.map((day) => {
              const isWeekend = day.day() === 0 || day.day() === 6;
              const isToday = day.isSame(today, 'day');
              return (
                <div
                  key={day.format('YYYY-MM-DD')}
                  className={cn(
                    'flex flex-col items-center justify-center border-r border-border text-[10px] font-mono',
                    isWeekend && 'bg-muted/50',
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
        <div className="shrink-0" style={{ width: LEFT_WIDTH }}>
          {groups.map((group) => (
            <div key={group.requirement.id} className="mb-2 border-t border-r border-border bg-card last:mb-0">
              <div className="flex h-8 border-b border-border">
                <Link
                  to={`/requirements/${group.requirement.id}`}
                  className="flex items-center px-3 text-xs font-semibold text-foreground hover:bg-accent"
                  style={{ width: REQUIREMENT_WIDTH }}
                  title={group.requirement.appReqName}
                >
                  <span className="truncate">{group.requirement.appReqName}</span>
                </Link>
                <div className="border-l border-border" style={{ width: OWNER_WIDTH }} />
              </div>
              {group.fallbackToRequirement ? (
                <div className="flex h-[46px]">
                  <div className="flex items-center px-3 text-xs text-muted-foreground" style={{ width: REQUIREMENT_WIDTH }}>暂无子需求</div>
                  <div className="flex items-center border-l border-border px-3" style={{ width: OWNER_WIDTH }}>
                    <UserDisplay value={group.requirement.currentOwner} size="small" className="max-w-full" />
                  </div>
                </div>
              ) : group.tasks.map((task) => (
                <div key={task.id} className="flex h-[46px] border-b border-border">
                  <Link
                    to={`/sub-requirements/${task.id}`}
                    className="flex items-center px-3 text-xs text-muted-foreground hover:bg-accent"
                    style={{ width: REQUIREMENT_WIDTH }}
                    title={task.appSubRequirementName}
                  >
                    <span className="truncate">↳ {task.appSubRequirementName}</span>
                  </Link>
                  <div className="flex items-center border-l border-border px-3" style={{ width: OWNER_WIDTH }}>
                    <UserDisplay value={task.appCurrentOwner} size="small" className="max-w-full" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div ref={timelineScrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden" onScroll={(event) => setTimelineScrollLeft(event.currentTarget.scrollLeft)}>
          <div style={{ width: timelineWidth }}>
            {groups.map((group) => {
              const rows = group.fallbackToRequirement ? [group.requirement] : group.tasks;
              return (
                <div key={group.requirement.id} className="mb-2 border-t border-border last:mb-0">
                  <div className="h-8 border-b border-border bg-accent/40" />
                  {rows.map((item) => {
                    const isRequirement = group.fallbackToRequirement;
                    const task = isRequirement ? undefined : item as SubRequirementItem;
                    const startDate = isRequirement ? group.requirement.proposalTime : task?.appExpectedStartDate;
                    const endDate = isRequirement ? group.requirement.estimatedCompletionTime : task?.appExpectedEndDate;
                    const start = dayjs(startDate ?? rangeStart).startOf('day');
                    const end = dayjs(endDate || startDate || rangeStart).startOf('day');
                    const visibleStart = start.isBefore(rangeStart) ? rangeStart : start;
                    const visibleEnd = end.isAfter(rangeEnd) ? rangeEnd : end;
                    const left = visibleStart.diff(rangeStart, 'day') * DAY_WIDTH + 6;
                    const width = endDate
                      ? Math.max((visibleEnd.diff(visibleStart, 'day') + 1) * DAY_WIDTH - 12, DAY_WIDTH - 12)
                      : 18;
                    const label = isRequirement ? group.requirement.appReqName : task?.appSubRequirementName ?? '';
                    const status = isRequirement ? group.requirement.appStatus : task?.appStatus;
                    const priority = isRequirement ? group.requirement.priority : task?.appPriority;
                    const target = isRequirement ? `/requirements/${group.requirement.id}` : `/sub-requirements/${item.id}`;

                    return (
                      <div key={item.id} className="relative" style={{ height: ROW_HEIGHT }}>
                        {days.map((day, index) => (
                          <div
                            key={day.format('YYYY-MM-DD')}
                            className={cn(
                              'pointer-events-none absolute z-[1] border-r border-dashed border-border/80',
                              (day.day() === 0 || day.day() === 6) && 'bg-muted/55',
                              day.isSame(today, 'day') && 'bg-primary/30',
                            )}
                            style={{ left: index * DAY_WIDTH, top: 0, width: DAY_WIDTH, height: ROW_HEIGHT }}
                          />
                        ))}
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute z-0 w-full border-b border-dashed border-border/80"
                          style={{ height: ROW_HEIGHT }}
                        />
                        <Link
                          to={target}
                          title={label}
                          className={cn('absolute z-[2] flex items-center overflow-hidden rounded-sm border border-t-[3px] px-2 text-xs font-medium transition-opacity hover:opacity-80', getTaskClass(status), getPriorityTopBorderClass(priority))}
                          style={{ left, top: (ROW_HEIGHT - TASK_HEIGHT) / 2, width, height: TASK_HEIGHT }}
                        >
                          <span className="truncate">{isRequirement ? label : `↳ ${label}`}</span>
                        </Link>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
