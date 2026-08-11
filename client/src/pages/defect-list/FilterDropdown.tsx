import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterDropdownProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (vals: string[]) => void;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}

export function FilterDropdown({
  label,
  options,
  selected,
  onChange,
  open,
  onToggle,
  onClose,
}: FilterDropdownProps) {
  const displayText = selected.length > 0
    ? `${label} (${selected.length})`
    : label;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        onBlur={() => setTimeout(onClose, 150)}
        className={cn(
          'h-9 min-w-[110px] justify-between gap-2 font-normal',
          selected.length > 0 && 'text-foreground border-primary/40'
        )}
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown className="size-3.5 opacity-60" />
      </Button>
      <div
        className={cn(
          'absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-sm border bg-popover text-popover-foreground shadow-md transition-all duration-200 origin-top',
          open
            ? 'max-h-72 opacity-100 scale-y-100'
            : 'max-h-0 opacity-0 scale-y-95 pointer-events-none'
        )}
      >
        <div className="p-1 max-h-72 overflow-y-auto">
          {options.map((opt: string) => {
            const checked = selected.includes(opt);
            return (
              <div
                key={opt}
                onClick={() => {
                  if (checked) {
                    onChange(selected.filter((v: string) => v !== opt));
                  } else {
                    onChange([...selected, opt]);
                  }
                }}
                onMouseDown={(e) => e.preventDefault()}
                className={cn(
                  'flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm cursor-pointer',
                  checked
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent/60'
                )}
              >
                <div
                  className={cn(
                    'flex size-3.5 items-center justify-center rounded-[2px] border',
                    checked
                      ? 'bg-primary border-primary'
                      : 'border-input'
                  )}
                >
                  {checked && (
                    <svg viewBox="0 0 12 12" className="size-3 text-primary-foreground">
                      <path
                        d="M2 6.5l2.5 2.5L10 3.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>
                <span>{opt}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default FilterDropdown;
