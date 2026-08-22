import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bug, ClipboardList, Layers, ListTodo, Loader2, Search } from 'lucide-react';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getVersionList } from '@/api/version';
import { getRequirementList } from '@/api/requirement';
import { getTestPlanList } from '@/api/test-plan';
import { getDefectList } from '@/api/defect';
import { getSubRequirementList } from '@/api/sub-requirement';

type SearchResult = {
  id: string;
  title: string;
  type: '版本' | '需求' | '子需求' | '测试计划' | '缺陷';
  path: string;
};

const typeIcons = {
  版本: Layers,
  需求: ListTodo,
  子需求: ListTodo,
  测试计划: ClipboardList,
  缺陷: Bug,
};

export function GlobalSearch() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    const keyword = query.trim();
    if (!keyword) {
      setResults([]);
      setLoading(false);
      setError(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(false);
      Promise.all([
        getVersionList({ page: 1, pageSize: 5, keyword }),
        getRequirementList({ page: 1, pageSize: 5, keyword }),
        getSubRequirementList({ page: 1, pageSize: 5, keyword }),
        getTestPlanList({ page: 1, pageSize: 5, keyword }),
        getDefectList({ page: 1, pageSize: 5, keyword }),
      ])
        .then(([versions, requirements, subRequirements, testPlans, defects]) => {
          if (cancelled) return;
          setResults([
            ...versions.items.map((item) => ({ id: item.id, title: item.versionName, type: '版本' as const, path: `/versions/${item.id}` })),
            ...requirements.items.map((item) => ({ id: item.id, title: item.appReqName, type: '需求' as const, path: `/requirements/${item.id}` })),
            ...subRequirements.items.map((item) => ({ id: item.id, title: item.appSubRequirementName, type: '子需求' as const, path: `/sub-requirements/${item.id}` })),
            ...testPlans.items.map((item) => ({ id: item.id, title: item.planName, type: '测试计划' as const, path: `/test-plans/${item.id}` })),
            ...defects.items.map((item) => ({ id: item.id, title: item.defectName, type: '缺陷' as const, path: `/defects/${item.id}` })),
          ]);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setError(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  const selectResult = (result: SearchResult) => {
    navigate(result.path);
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <Button variant="outline" size="sm" className="ml-auto hidden h-8 gap-2 text-xs md:flex" onClick={() => setOpen(true)}>
        <Search className="size-3.5" />
        搜索
        <kbd className="rounded-sm border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">Ctrl K</kbd>
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[620px]">
          <DialogHeader className="border-b border-border px-5 py-4">
            <DialogTitle>全局搜索</DialogTitle>
          </DialogHeader>
          <div className="relative border-b border-border px-5 py-3">
            <Search className="absolute left-8 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索版本、需求、子需求、测试计划或缺陷…" className="h-9 pl-8" />
          </div>
          <div className="max-h-[420px] overflow-y-auto p-2">
            {loading && <Loader2 className="mx-auto my-8 size-5 animate-spin text-muted-foreground" />}
            {!loading && query.trim() && results.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {error ? '搜索服务暂不可用，请稍后重试' : '未找到匹配事项'}
              </p>
            )}
            {!loading && results.map((result) => {
              const Icon = typeIcons[result.type];
              return (
                <button
                  key={`${result.type}-${result.id}`}
                  type="button"
                  onClick={() => selectResult(result)}
                  className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left hover:bg-accent"
                >
                  <Icon className="size-4 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{result.title}</span>
                  <span className="text-xs text-muted-foreground">{result.type}</span>
                </button>
              );
            })}
            {!query.trim() && (
              <p className="py-8 text-center text-sm text-muted-foreground">输入关键词开始搜索</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
