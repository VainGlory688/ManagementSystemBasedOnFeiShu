import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface DirectSelectFieldProps {
  value: string;
  options: string[];
  placeholder?: string;
  onChange: (value: string) => Promise<void>;
  className?: string;
  children?: React.ReactNode;
}

export function DirectSelectField({
  value,
  options,
  placeholder = '未设置',
  onChange,
  className,
  children,
}: DirectSelectFieldProps) {
  return (
    <Select value={value || undefined} onValueChange={(nextValue) => void onChange(nextValue)}>
      <div className="relative inline-flex">
        {children || (
          <span className={cn('cursor-pointer transition-opacity hover:opacity-80', className)}>
            {value || placeholder}
          </span>
        )}
        <SelectTrigger
          aria-label={`设置为${value || placeholder}`}
          className="absolute inset-0 h-full w-full cursor-pointer border-0 bg-transparent p-0 opacity-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <SelectValue />
        </SelectTrigger>
      </div>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>{option}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
