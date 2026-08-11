import { ChevronDown, ChevronUp } from 'lucide-react';

import { TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type SortKey =
  | 'status'
  | 'severity'
  | 'priority'
  | 'businessLine'
  | 'discoveryEnvironment'
  | 'testingStage';
export type SortDir = 'asc' | 'desc';

export interface SortHeaderProps {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey | null;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}

export function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: SortHeaderProps) {
  return (
    <TableHead
      className={cn('cursor-pointer select-none', className)}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {currentKey !== sortKey ? (
          <ChevronUp className="size-3 opacity-20" />
        ) : currentDir === 'asc' ? (
          <ChevronUp className="size-3 text-primary" />
        ) : (
          <ChevronDown className="size-3 text-primary" />
        )}
      </span>
    </TableHead>
  );
}

export default SortHeader;
