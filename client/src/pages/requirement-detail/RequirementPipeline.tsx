import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { updateRequirementPipeline } from '@/api/requirement';
import type {
  RequirementPipelineConfig,
  RequirementPipelineEdge,
  SubRequirementItem,
} from '@shared/api.interface';

interface Point {
  x: number;
  y: number;
}

interface RequirementPipelineProps {
  requirementId: string;
  items: SubRequirementItem[];
  pipeline?: RequirementPipelineConfig;
  onSaved: (pipeline: RequirementPipelineConfig) => void;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 44;
const COLUMN_WIDTH = 200;
const ROW_HEIGHT = 82;

function getNodeId(item: SubRequirementItem): string {
  return item.baseRecordId || item.id;
}

function getStatusClass(status: string): string {
  if (status === '已完成' || status === '已上线') {
    return 'bg-[hsl(160_40%_94%)] text-[hsl(160_55%_32%)] border-[hsl(160_55%_42%)/70]';
  }
  if (status === '进行中' || status === '开发中') {
    return 'bg-[hsl(38_70%_93%)] text-[hsl(38_80%_35%)] border-[hsl(38_90%_50%)/70]';
  }
  return 'bg-muted text-muted-foreground border-muted-foreground/50';
}

function hasCycle(edges: RequirementPipelineEdge[]): boolean {
  const next = new Map<string, string[]>();
  edges.forEach(({ source, target }) => {
    next.set(source, [...(next.get(source) || []), target]);
  });
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (node: string): boolean => {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    if ((next.get(node) || []).some(visit)) return true;
    visiting.delete(node);
    visited.add(node);
    return false;
  };
  return [...next.keys()].some(visit);
}

function getValidEdges(
  pipeline: RequirementPipelineConfig | undefined,
  items: SubRequirementItem[],
): RequirementPipelineEdge[] {
  const ids = new Set(items.map(getNodeId));
  const seen = new Set<string>();
  return (pipeline?.edges || []).filter((edge) => {
    const key = `${edge.source}:${edge.target}`;
    if (!ids.has(edge.source) || !ids.has(edge.target) || edge.source === edge.target || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildPositions(items: SubRequirementItem[], edges: RequirementPipelineEdge[]): Record<string, Point> {
  const ids = items.map(getNodeId);
  const incoming = new Map(ids.map((id) => [id, 0]));
  const outgoing = new Map(ids.map((id) => [id, [] as string[]]));
  edges.forEach(({ source, target }) => {
    if (incoming.has(target) && outgoing.has(source)) {
      incoming.set(target, (incoming.get(target) || 0) + 1);
      outgoing.get(source)?.push(target);
    }
  });

  const level = new Map(ids.map((id) => [id, 0]));
  const queue = ids.filter((id) => incoming.get(id) === 0);
  for (let index = 0; index < queue.length; index += 1) {
    const source = queue[index];
    for (const target of outgoing.get(source) || []) {
      level.set(target, Math.max(level.get(target) || 0, (level.get(source) || 0) + 1));
      incoming.set(target, (incoming.get(target) || 1) - 1);
      if (incoming.get(target) === 0) queue.push(target);
    }
  }

  const rootIds = ids.filter((id) => !edges.some((edge) => edge.target === id));
  const terminalIds = ids.filter((id) => !edges.some((edge) => edge.source === id));
  const spanCache = new Map<string, number>();
  const getBranchSpan = (id: string, visiting = new Set<string>()): number => {
    if (spanCache.has(id)) return spanCache.get(id)!;
    if (visiting.has(id)) return 1;
    const targets = outgoing.get(id) || [];
    if (targets.length === 0) {
      spanCache.set(id, 1);
      return 1;
    }
    const nextVisiting = new Set(visiting).add(id);
    const span = targets.reduce((sum, target) => sum + getBranchSpan(target, nextVisiting), 0);
    spanCache.set(id, span);
    return span;
  };

  const yUnits = new Map<string, number>();
  const assignBranches = (id: string, startUnit: number) => {
    const span = getBranchSpan(id);
    yUnits.set(id, startUnit + (span - 1) / 2);
    let nextUnit = startUnit;
    for (const target of outgoing.get(id) || []) {
      assignBranches(target, nextUnit);
      nextUnit += getBranchSpan(target);
    }
  };

  let rootStartUnit = 0;
  (rootIds.length > 0 ? rootIds : ids).forEach((id) => {
    assignBranches(id, rootStartUnit);
    rootStartUnit += getBranchSpan(id);
  });

  const mainRoot = rootIds[0] || ids[0];
  const mainAxisUnit = yUnits.get(mainRoot) || 0;
  if (terminalIds.length === 1) {
    yUnits.set(terminalIds[0], mainAxisUnit);
  }

  const minUnit = Math.min(...[...yUnits.values()]);
  const axisTop = Math.max(158, (mainAxisUnit - minUnit) * ROW_HEIGHT + 28);
  const verticalOffset = axisTop - mainAxisUnit * ROW_HEIGHT;
  return Object.fromEntries(
    items.map((item) => {
      const id = getNodeId(item);
      return [
        id,
        {
          x: (level.get(id) || 0) * COLUMN_WIDTH + 32,
          y: (yUnits.get(id) || 0) * ROW_HEIGHT + verticalOffset,
        },
      ];
    }),
  );
}

function getEdgePath(
  source: Point,
  target: Point,
  sourceOffset: number,
  targetOffset: number,
  routeY?: number,
  useStraightApproach = false,
): string {
  const startX = source.x + NODE_WIDTH;
  const startY = source.y + NODE_HEIGHT / 2 + sourceOffset;
  const endX = target.x;
  const endY = target.y + NODE_HEIGHT / 2 + targetOffset;
  if (useStraightApproach) {
    const curveStartX = endX - 54;
    return `M ${startX} ${startY} L ${curveStartX} ${startY} C ${endX - 20} ${startY}, ${endX - 20} ${endY}, ${endX} ${endY}`;
  }
  if (routeY !== undefined) {
    return `M ${startX} ${startY} C ${startX + 36} ${startY}, ${startX + 36} ${routeY}, ${startX + 72} ${routeY} L ${endX - 72} ${routeY} C ${endX - 36} ${routeY}, ${endX - 36} ${endY}, ${endX} ${endY}`;
  }
  const midX = startX + (endX - startX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

const RequirementPipeline = ({ requirementId, items, pipeline, onSaved }: RequirementPipelineProps) => {
  const initialEdges = useMemo(() => getValidEdges(pipeline, items), [items, pipeline]);
  const [edges, setEdges] = useState<RequirementPipelineEdge[]>(initialEdges);
  const [savedEdges, setSavedEdges] = useState<RequirementPipelineEdge[]>(initialEdges);
  const [positions, setPositions] = useState<Record<string, Point>>(() => buildPositions(items, initialEdges));
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const nextEdges = getValidEdges(pipeline, items);
    setEdges(nextEdges);
    setSavedEdges(nextEdges);
    setPositions(buildPositions(items, nextEdges));
    setSelectedSource(null);
    setSelectedEdge(null);
  }, [items, pipeline]);

  const connectNodes = useCallback((source: string, target: string) => {
    if (source === target) {
      toast.error('子需求不能依赖自身');
      return;
    }
    if (edges.some((edge) => edge.source === source && edge.target === target)) {
      toast.error('该流程连线已存在');
      return;
    }
    const nextEdges = [...edges, { source, target }];
    if (hasCycle(nextEdges)) {
      toast.error('流水线不能产生循环依赖');
      return;
    }
    setEdges(nextEdges);
    setSelectedSource(null);
  }, [edges]);

  const onNodeClick = useCallback((id: string) => {
    if (selectedSource && selectedSource !== id) {
      connectNodes(selectedSource, id);
      return;
    }
    setSelectedSource((current) => current === id ? null : id);
    setSelectedEdge(null);
  }, [connectNodes, selectedSource]);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPositions((current) => ({
      ...current,
      [drag.id]: {
        x: Math.max(12, event.clientX - rect.left - drag.offsetX),
        y: Math.max(12, event.clientY - rect.top - drag.offsetY),
      },
    }));
  }, []);

  const autoLayout = useCallback(() => setPositions(buildPositions(items, edges)), [edges, items]);
  const resetChanges = useCallback(() => {
    setEdges(savedEdges);
    setPositions(buildPositions(items, savedEdges));
    setSelectedSource(null);
    setSelectedEdge(null);
  }, [items, savedEdges]);

  const removeSelectedEdge = useCallback(() => {
    if (!selectedEdge) return;
    setEdges((current) => current.filter((edge) => `${edge.source}:${edge.target}` !== selectedEdge));
    setSelectedEdge(null);
  }, [selectedEdge]);

  const clearEdges = useCallback(() => {
    setEdges([]);
    setSelectedEdge(null);
    setSelectedSource(null);
    toast.success('已清除全部连线，保存后生效');
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const nextPipeline = await updateRequirementPipeline(requirementId, { edges });
      const nextEdges = getValidEdges(nextPipeline, items);
      setEdges(nextEdges);
      setSavedEdges(nextEdges);
      onSaved(nextPipeline);
      toast.success('流水线配置已保存');
    } catch {
      toast.error('流水线保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  }, [edges, items, onSaved, requirementId]);

  const serializeEdges = (itemsToSerialize: RequirementPipelineEdge[]) =>
    JSON.stringify([...itemsToSerialize].sort((a, b) =>
      `${a.source}:${a.target}`.localeCompare(`${b.source}:${b.target}`),
    ));
  const changed = serializeEdges(edges) !== serializeEdges(savedEdges);
  const longEdgeCount = edges.filter((edge) => {
    const source = positions[edge.source];
    const target = positions[edge.target];
    return source && target && target.x - source.x > COLUMN_WIDTH;
  }).length;
  const canvasWidth = Math.max(
    620,
    ...Object.values(positions).map((position) => position.x + NODE_WIDTH + 32),
  );
  const canvasHeight = Math.max(
    360,
    ...Object.values(positions).map((position) => position.y + NODE_HEIGHT + longEdgeCount * 16 + 72),
  );

  return (
    <section className="border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-muted/20 px-5 py-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-primary" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">子需求流水线</h2>
            <p className="text-xs text-muted-foreground">
              先选择前置节点，再点击后置节点完成连线；可拖动节点调整视图。
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={autoLayout}>
            <Sparkles className="size-3.5" />
            自动整理
          </Button>
          <Button variant="ghost" size="sm" disabled={!changed} onClick={resetChanges}>
            <RotateCcw className="size-3.5" />
            撤销
          </Button>
          <Button variant="outline" size="sm" disabled={!selectedEdge} onClick={removeSelectedEdge}>
            <Trash2 className="size-3.5" />
            删除连线
          </Button>
          <Button variant="outline" size="sm" disabled={edges.length === 0} onClick={clearEdges}>
            <Trash2 className="size-3.5" />
            清除全部
          </Button>
          <Button size="sm" disabled={!changed || saving} onClick={save}>
            <Save className="size-3.5" />
            {saving ? '保存中…' : '保存流程'}
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 text-center">
          <GitBranch className="size-7 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">暂无可配置的子需求</p>
          <p className="text-xs text-muted-foreground">创建子需求后，可在这里配置它们的执行顺序。</p>
        </div>
      ) : (
        <div className="max-h-[520px] overflow-auto bg-[hsl(215_20%_13%)]">
          <div
            className="relative select-none bg-[linear-gradient(hsl(215_15%_35%/.5)_1px,transparent_1px),linear-gradient(90deg,hsl(215_15%_35%/.5)_1px,transparent_1px)] bg-[size:20px_20px]"
            style={{ width: canvasWidth, height: canvasHeight }}
            onPointerMove={onPointerMove}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerLeave={() => { dragRef.current = null; }}
          >
            <svg className="pointer-events-none absolute inset-0 size-full overflow-visible">
              <defs>
                <marker id="pipeline-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" className="fill-white" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const source = positions[edge.source];
                const target = positions[edge.target];
                if (!source || !target) return null;
                const edgeId = `${edge.source}:${edge.target}`;
                const outgoing = edges
                  .filter((candidate) => candidate.source === edge.source)
                  .sort((a, b) => (positions[a.target]?.y || 0) - (positions[b.target]?.y || 0));
                const incoming = edges
                  .filter((candidate) => candidate.target === edge.target)
                  .sort((a, b) => (positions[a.source]?.y || 0) - (positions[b.source]?.y || 0));
                const sourceOffset = (outgoing.findIndex((candidate) => candidate === edge) - (outgoing.length - 1) / 2) * 8;
                const targetOffset = (incoming.findIndex((candidate) => candidate === edge) - (incoming.length - 1) / 2) * 8;
                const longEdges = edges.filter((candidate) => {
                  const candidateSource = positions[candidate.source];
                  const candidateTarget = positions[candidate.target];
                  return candidateSource && candidateTarget && candidateTarget.x - candidateSource.x > COLUMN_WIDTH;
                });
                const longEdgeIndex = longEdges.findIndex((candidate) => candidate === edge);
                const startY = source.y + NODE_HEIGHT / 2 + sourceOffset;
                const hasStraightObstacle = Object.entries(positions).some(([id, position]) =>
                  id !== edge.source &&
                  id !== edge.target &&
                  position.x > source.x &&
                  position.x < target.x &&
                  startY >= position.y - 8 &&
                  startY <= position.y + NODE_HEIGHT + 8,
                );
                const useStraightApproach = longEdgeIndex >= 0 && !hasStraightObstacle;
                const routeY = longEdgeIndex < 0
                  ? undefined
                  : Math.max(...Object.values(positions).map((position) => position.y + NODE_HEIGHT)) + 24 + longEdgeIndex * 16;
                return (
                  <path
                    key={edgeId}
                    d={getEdgePath(source, target, sourceOffset, targetOffset, routeY, useStraightApproach)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={selectedEdge === edgeId ? 3 : 1.5}
                    strokeLinejoin="round"
                    markerEnd="url(#pipeline-arrow)"
                    className={cn(
                      'pointer-events-auto cursor-pointer text-white transition-all',
                      selectedEdge !== edgeId && 'opacity-70 hover:opacity-100',
                    )}
                    onClick={() => {
                      setSelectedEdge(edgeId);
                      setSelectedSource(null);
                    }}
                  />
                );
              })}
            </svg>

            {items.map((item) => {
              const id = getNodeId(item);
              const position = positions[id];
              if (!position) return null;
              return (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    'absolute flex w-[140px] cursor-grab items-center gap-1.5 rounded-sm border px-2 text-left text-xs shadow-none transition-[border-color,box-shadow] active:cursor-grabbing',
                    getStatusClass(item.appStatus),
                    selectedSource === id ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/60',
                  )}
                  style={{ transform: `translate(${position.x}px, ${position.y}px)`, height: NODE_HEIGHT }}
                  onPointerDown={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    dragRef.current = {
                      id,
                      offsetX: event.clientX - rect.left,
                      offsetY: event.clientY - rect.top,
                    };
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onClick={() => onNodeClick(id)}
                >
                  <span className="size-1.5 shrink-0 rounded-full bg-current" />
                  <span className="truncate font-medium">
                    {item.appSubRequirementName || '未命名子需求'}
                  </span>
                  <span className="ml-auto shrink-0 text-[10px] opacity-75">
                    {item.appStatus || '未处理'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

export default RequirementPipeline;
