import { useState, useMemo, useEffect } from 'react';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { UserSelect } from '@/components/business-ui/user-select';
import { useUsersByIds } from '@/components/business-ui/api/users/queries';
import { getI18nText } from '@/components/business-ui/utils/user';
import type { RequirementListParams } from '@/api/requirement';
import { useFieldOptions } from '@/hooks/useFieldOptions';
import { getVersionList } from '@/api/version';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterConfig {
  key: keyof RequirementListParams;
  label: string;
  options: FilterOption[];
}

function toFilterOptions(values: string[]): FilterOption[] {
  return values.map((v: string) => ({ value: v, label: v }));
}

interface RequirementFilterBarProps {
  params: RequirementListParams;
  onChange: (params: RequirementListParams) => void;
  onCreate: () => void;
}

const RequirementFilterBar = ({ params, onChange, onCreate }: RequirementFilterBarProps) => {
  const [keywordInput, setKeywordInput] = useState(params.keyword || '');
  const ownerValue: string | null = params.currentOwner || null;
  const isCurrentUserFilter = ownerValue === 'me';
  const { data: ownerUsers } = useUsersByIds(
    ownerValue && !isCurrentUserFilter ? [ownerValue] : [],
  );
  const ownerName = ownerValue
    ? getI18nText(ownerUsers?.data?.userInfoMap?.[ownerValue]?.name)
    : '';

  const { options: fieldOptions } = useFieldOptions();
  const [planningVersionOptions, setPlanningVersionOptions] = useState<
    FilterOption[]
  >([]);

  useEffect(() => {
    getVersionList({ pageSize: 200 })
      .then((res) => {
        setPlanningVersionOptions(
          res.items.map((v) => ({
            value: v.baseRecordId || v.id,
            label: v.versionName,
          })),
        );
      })
      .catch(() => {
        setPlanningVersionOptions([]);
      });
  }, []);

  const FILTER_CONFIGS: FilterConfig[] = [
    {
      key: 'businessLine',
      label: '业务线',
      options: toFilterOptions(fieldOptions['req_business_line'] || []),
    },
    {
      key: 'priority',
      label: '优先级',
      options: toFilterOptions(fieldOptions['req_priority'] || []),
    },
    {
      key: 'reqType',
      label: '需求类型',
      options: toFilterOptions(fieldOptions['req_type'] || []),
    },
    {
      key: 'planningVersion',
      label: '计划版本',
      options: planningVersionOptions,
    },
    { key: 'currentOwner', label: '负责人', options: [] },
  ];

  const handleFilterChange = (key: keyof RequirementListParams, value: string) => {
    const next: RequirementListParams = { ...params, page: 1 };
    if (value) {
      (next as Record<string, string>)[key] = value;
    } else {
      delete (next as Record<string, string>)[key];
    }
    onChange(next);
  };

  const handleOwnerChange = (val: string | null) => {
    const next: RequirementListParams = { ...params, page: 1 };
    if (val) {
      next.currentOwner = val;
    } else {
      delete next.currentOwner;
    }
    onChange(next);
  };

  const handleRemoveFilter = (key: keyof RequirementListParams) => {
    const next: RequirementListParams = { ...params, page: 1 };
    delete (next as Record<string, string>)[key];
    if (key === 'keyword') setKeywordInput('');
    onChange(next);
  };

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    const next: RequirementListParams = { ...params, page: 1 };
    if (keywordInput.trim()) {
      next.keyword = keywordInput.trim();
    } else {
      delete next.keyword;
    }
    onChange(next);
  };

  const activeFilters = useMemo(() => {
    const list: { key: keyof RequirementListParams; label: string; value: string }[] = [];
    for (const cfg of FILTER_CONFIGS) {
      const val = params[cfg.key];
      if (val) {
        const opt = cfg.options.find((o: FilterOption) => o.value === val);
        list.push({
          key: cfg.key,
          label: cfg.label,
          value:
            val === 'me'
              ? '我'
              : cfg.key === 'currentOwner'
                ? ownerName || String(val)
                : opt?.label || String(val),
        });
      }
    }
    if (params.keyword) {
      list.push({ key: 'keyword', label: '关键词', value: params.keyword });
    }
    return list;
  }, [params, fieldOptions, planningVersionOptions, ownerName]);

  return (
    <div className="bg-card border border-border rounded-sm p-4 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        {FILTER_CONFIGS.filter((c: FilterConfig) => c.key !== 'currentOwner').map((cfg: FilterConfig) => (
          <div key={cfg.key} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">{cfg.label}</span>
            <Select
              value={(params[cfg.key] as string) || ''}
              onValueChange={(v: string) => handleFilterChange(cfg.key, v)}
            >
              <SelectTrigger className="w-[160px] h-8" size="sm">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">全部</SelectItem>
                {cfg.options.map((opt: FilterOption) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-14 shrink-0">负责人</span>
          <div className="w-[160px]">
            {isCurrentUserFilter ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-between font-normal"
                onClick={() => handleOwnerChange(null)}
              >
                我
                <X className="size-3 text-muted-foreground" />
              </Button>
            ) : (
              <UserSelect
                value={ownerValue}
                onChange={handleOwnerChange}
                triggerType="search"
                placeholder="全部"
              />
            )}
          </div>
        </div>
        <Button size="sm" variant="default" onClick={onCreate}>
          新建需求
        </Button>
        <form onSubmit={handleSearch} className="ml-auto flex items-center gap-2">
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeywordInput(e.target.value)}
              placeholder="搜索需求名称..."
              className="h-8 pl-8 text-sm"
            />
          </div>
          <Button type="submit" size="sm" variant="default">搜索</Button>
        </form>
      </div>

      {activeFilters.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mt-3 pt-3 border-t border-border/60">
          <span className="text-xs text-muted-foreground">已选条件：</span>
          {activeFilters.map((f, idx: number) => (
            <Badge
              key={`${f.key}-${idx}`}
              variant="secondary"
              className={cn(
                'h-[22px] px-2 gap-1 cursor-pointer group',
                'animate-grow-in',
              )}
              style={{ animationDelay: `${idx * 30}ms` }}
              onClick={() => handleRemoveFilter(f.key)}
            >
              <span className="text-[11px] text-muted-foreground">{f.label}:</span>
              <span className="text-[11px] font-medium">{f.value}</span>
              <X className="size-3 text-muted-foreground group-hover:text-destructive transition-colors" />
            </Badge>
          ))}
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-1"
            onClick={() => {
              setKeywordInput('');
              onChange({ page: 1, pageSize: params.pageSize });
            }}
          >
            清空全部
          </button>
        </div>
      )}
    </div>
  );
};

export default RequirementFilterBar;
