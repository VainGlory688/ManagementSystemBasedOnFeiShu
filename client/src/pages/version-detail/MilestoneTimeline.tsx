import { MilestoneNode, formatDate } from '@/utils/version-helpers';

interface MilestoneTimelineProps {
  nodes: MilestoneNode[];
}

const MilestoneTimeline = ({ nodes }: MilestoneTimelineProps) => {
  const currentIndex = nodes.findIndex((n: MilestoneNode) => n.status === 'current');
  const doneCount = nodes.filter((n: MilestoneNode) => n.status === 'done').length;
  const progressRatio = currentIndex >= 0
    ? (currentIndex + 0.5) / nodes.length
    : doneCount / nodes.length;

  return (
    <div className="relative pl-1">
      {/* SVG 连接线 */}
      <svg
        className="absolute left-[11px] top-2 bottom-2 w-[2px]"
        style={{ height: 'calc(100% - 16px)' }}
        aria-hidden
      >
        {/* 背景线 */}
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="100%"
          stroke="hsl(215, 15%, 88%)"
          strokeWidth="2"
        />
        {/* 进度线 */}
        <line
          x1="1"
          y1="0"
          x2="1"
          y2={`${progressRatio * 100}%`}
          stroke="hsl(160, 55%, 42%)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>

      <ul className="space-y-6 relative">
        {nodes.map((node: MilestoneNode, i: number) => {
          const isDone = node.status === 'done';
          const isCurrent = node.status === 'current';
          return (
            <li
              key={node.key}
              className="relative flex items-start gap-4 min-h-[40px]"
              style={{
                animation: 'node-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both',
                animationDelay: `${0.2 + i * 100}ms`,
              }}
            >
              {/* 节点圆点 */}
              <div className="relative z-10 mt-1">
                {isCurrent ? (
                  <span className="relative flex size-[24px] items-center justify-center">
                    <span className="absolute inline-flex size-full rounded-full bg-success/30 animate-ping" />
                    <span className="relative inline-flex size-[14px] rounded-full bg-success border-2 border-white shadow-sm" />
                  </span>
                ) : isDone ? (
                  <span className="flex size-[18px] items-center justify-center rounded-full bg-success text-white">
                    <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M3 8l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                ) : (
                  <span className="block size-[14px] rounded-full border-2 border-muted-foreground/30 bg-white" />
                )}
              </div>

              {/* 节点内容 */}
              <div className="flex-1 pt-0.5">
                <div
                  className={[
                    'text-sm font-medium',
                    isDone || isCurrent ? 'text-foreground' : 'text-muted-foreground',
                  ].join(' ')}
                >
                  {node.label}
                </div>
                <div
                  className={[
                    'text-xs mt-0.5 font-mono',
                    isDone || isCurrent ? 'text-foreground/70' : 'text-muted-foreground/60',
                  ].join(' ')}
                >
                  {formatDate(node.date)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <style>{`
        @keyframes node-pop-in {
          0% {
            opacity: 0;
            transform: translateX(-8px) scale(0.9);
          }
          100% {
            opacity: 1;
            transform: translateX(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
};

export { MilestoneTimeline };
