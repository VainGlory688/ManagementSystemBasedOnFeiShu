import { useMemo } from 'react';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { TestPlanListParams } from '@/api/test-plan';
import { useFieldOptions } from '@/hooks/useFieldOptions';

export interface FilterState {
  testStatus: string;
  priority: string;
  testPlanType: string;
  businessLine: string;
  planningVersion: string;
}

interface FilterToolbarProps {
  filters: FilterState;
  keywordInput: string;
  onKeywordInputChange: (v: string) => void;
  onKeywordSearch: () => void;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onClearFilter: (key: keyof TestPlanListParams) => void;
  onClearAll: () => void;
  onCreate: () => void;
  versionOptions: Array<{ value: string; label: string }>;
}

const FILTER_LABELS: Record<keyof FilterState, string> = {
  testStatus: '测试状态',
  priority: '优先级',
  testPlanType: '计划类型',
  businessLine: '业务线',
  planningVersion: '计划版本',
};

export function FilterToolbar({
  filters,
  keywordInput,
  onKeywordInputChange,
  onKeywordSearch,
  onFilterChange,
  onClearFilter,
  onClearAll,
  onCreate,
  versionOptions,
}: FilterToolbarProps) {
  const { options: fieldOptions } = useFieldOptions();
  const testStatusOptions = fieldOptions['test_plan_status'] || [];
  const priorityOptions = fieldOptions['test_plan_priority'] || [];
  const testPlanTypeOptions = fieldOptions['test_plan_type'] || [];
  const businessLineOptions = fieldOptions['test_plan_business_line'] || [];

  const filterConfigs = useMemo(() => [
    { key: 'testStatus' as const, label: '测试状态', options: testStatusOptions },
    { key: 'priority' as const, label: '优先级', options: priorityOptions },
    { key: 'testPlanType' as const, label: '计划类型', options: testPlanTypeOptions },
    { key: 'businessLine' as const, label: '业务线', options: businessLineOptions },
  ], [testStatusOptions, priorityOptions, testPlanTypeOptions, businessLineOptions]);

  const activeFilters = (
    Object.entries(filters) as [keyof FilterState, string][]
  ).filter(([, value]) => value);

  return (
    <div className="bg-card border border-border rounded-sm p-4 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        {filterConfigs.map((config) => (
          <div key={config.key} className="flex items-center gap-2">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{config.label}</span>
            <Select value={filters[config.key]} onValueChange={(value: string) => onFilterChange(config.key, value)}>
              <SelectTrigger size="sm" className="w-[160px] h-8">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {config.options.map((option: string) => (
                  <SelectItem key={option} value={option}>{option}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-xs text-muted-foreground">计划版本</span>
          <Select value={filters.planningVersion} onValueChange={(value: string) => onFilterChange('planningVersion', value)}>
            <SelectTrigger size="sm" className="w-[160px] h-8">
              <SelectValue placeholder="全部" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">全部</SelectItem>
              {versionOptions.map((version) => (
                <SelectItem key={version.value} value={version.value}>{version.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="default" onClick={onCreate}>
          新建测试计划
        </Button>
        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onKeywordSearch();
          }}
        >
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onKeywordInputChange(e.target.value)
              }
              placeholder="搜索计划名称..."
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="default">搜索</Button>
        </form>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground">已选条件：</span>
          {activeFilters.map(([key, value], index) => (
            <Badge
              key={key}
              variant="secondary"
              className={cn('h-[22px] px-2 gap-1 cursor-pointer group animate-grow-in')}
              style={{ animationDelay: `${index * 30}ms` }}
              onClick={() => onClearFilter(key as keyof TestPlanListParams)}
            >
              <span className="text-[11px] text-muted-foreground">{FILTER_LABELS[key]}:</span>
              <span className="text-[11px] font-medium">
                {key === 'planningVersion'
                  ? versionOptions.find((version) => version.value === value)?.label || value
                  : value}
              </span>
              <X className="size-3 text-muted-foreground group-hover:text-destructive transition-colors" />
            </Badge>
          ))}
          <button className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={onClearAll}>
            清空全部
          </button>
        </div>
      )}
    </div>
  );
}
