import { useRef, useState } from 'react';
import { UserDisplay } from '@/components/business-ui/user-display';
import { cn } from '@/lib/utils';

interface ExecutorAvatarStackProps {
  userIds: string[];
  max?: number;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export function ExecutorAvatarStack({
  userIds,
  max = 3,
  size = 'small',
  className,
}: ExecutorAvatarStackProps) {
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!userIds || userIds.length === 0) {
    return <span className="text-xs text-muted-foreground">未分配</span>;
  }

  const visible = userIds.slice(0, max);
  const restCount = userIds.length - max;

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  return (
    <div
      ref={containerRef}
      className={cn('flex items-center', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="flex items-center">
        {visible.map((userId: string, index: number) => (
          <div
            key={userId}
            className="relative transition-all duration-300 ease-out"
            style={{
              marginLeft: index === 0 ? 0 : isHovered ? '8px' : '-8px',
              zIndex: index + 1,
            }}
          >
            <div
              className="rounded-full ring-2 ring-card"
              style={{ zIndex: index + 1 }}
            >
              <UserDisplay value={[userId]} size={size} showLabel={false} />
            </div>
          </div>
        ))}
        {restCount > 0 && (
          <div
            className="relative transition-all duration-300 ease-out"
            style={{
              marginLeft: isHovered ? '8px' : '-8px',
              zIndex: visible.length + 1,
            }}
          >
            <div
              className={cn(
                'rounded-full ring-2 ring-card bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground',
                size === 'small' ? 'w-6 h-6' : size === 'medium' ? 'w-8 h-8' : 'w-10 h-10',
              )}
            >
              +{restCount}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
