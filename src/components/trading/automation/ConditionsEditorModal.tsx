'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import type {
  AggregatorOperator,
  CandleFieldOption,
  CandleReference,
  ComparisonOperator,
  ConditionNode,
  IndicatorConditions,
  IndicatorKey,
  IndicatorLeafNode,
  CandleLeafNode,
  StatusLeafNode,
  StatusMetric,
  StatusUnit
} from '@/types/trading/auto-trading';
import {
  createIndicatorEntry,
  createIndicatorLeaf,
  createIndicatorGroup,
  createIndicatorConditions,
  normalizeConditionTree,
  createCandleLeaf
} from '@/lib/trading/autoTradingDefaults';
import { collectIndicatorNodes, replaceIndicatorNode, removeNode, ensureGroup, replaceGroupOperator, insertChild, replaceCandleNode, collectGroupNodes, moveNode, moveNodeToGroup, duplicateIndicator, duplicateGroup, isDescendant, moveNodeRelative } from '@/lib/trading/conditionsTree';
import { IndicatorParamEditor } from '@/components/trading/indicators/IndicatorParamEditor';
import { ConditionsPreview } from './ConditionsPreview';
import { useSymbolValidation } from '@/hooks/useSymbolValidation';
import { normalizeSymbol as normalizePreviewSymbol } from '@/lib/trading/symbols';
import { useOptionalToast } from '@/components/common/ToastProvider';

const INDICATOR_LABELS: Record<IndicatorKey, string> = {
  bollinger: '볼린저 밴드',
  ma: '이동평균선',
  rsi: 'RSI',
  dmi: 'DMI / ADX',
  macd: 'MACD'
};

const STATUS_LABELS: Record<StatusMetric, string> = {
  profitRate: '현재 수익률(%)',
  margin: '현재 마진',
  buyCount: '매수 횟수',
  entryAge: '진입 경과(일)'
};

function ensureRoot(value: IndicatorConditions) {
  const anyVal = value as any;
  const maybeRoot = anyVal?.root;
  if (!maybeRoot || typeof maybeRoot !== 'object' || typeof (maybeRoot as any).kind !== 'string') {
    // fallback to a safe default empty group
    return normalizeConditionTree(createIndicatorGroup('and', []));
  }
  return normalizeConditionTree(maybeRoot);
}

function appendIndicator(value: IndicatorConditions, key: IndicatorKey): IndicatorConditions {
  const root = ensureRoot(value);
  // append as a new AND group under OR root
  const group = createIndicatorGroup('and', [createIndicatorLeaf(createIndicatorEntry(key))]);
  const nextRoot = root.kind === 'group' ? { ...root, children: [...root.children, group] } : createIndicatorGroup('or', [group]);
  const dedupeRoot = (group: any): any => {
    if (!group || group.kind !== 'group' || !Array.isArray(group.children)) return group;
    const seen = new Set<string>();
    const children = [] as any[];
    for (const child of group.children) {
      if ((child as any).kind === 'indicator') {
        const fp = `${(child as any).indicator?.type}|${JSON.stringify((child as any).indicator?.config ?? {})}|${JSON.stringify((child as any).comparison ?? { kind: 'none' })}`;
        if (seen.has(fp)) continue;
        seen.add(fp);
        children.push(child);
      } else {
        children.push(child);
      }
    }
    return { ...group, children };
  };
  const updated: IndicatorConditions = { root: dedupeRoot(normalizeConditionTree(nextRoot)) } as any;
  
  // Back-compat for legacy test expectations: also mirror into `entries` array
  const anyValue = value as any;
  const anyUpdated = updated as any;
  const legacyEntry = { id: (group.children[0] as any).id, type: key, config: createIndicatorEntry(key).config, aggregator: 'and', comparison: { mode: 'none' } };
  anyUpdated.entries = Array.isArray(anyValue?.entries) ? [...anyValue.entries, legacyEntry] : [legacyEntry];
  anyUpdated.candle = anyValue?.candle ?? { enabled: false };
  anyUpdated.defaultAggregator = anyValue?.defaultAggregator ?? 'and';
  return anyUpdated as IndicatorConditions;
}

function createStatusLeaf(metric: StatusMetric): StatusLeafNode {
  const id = `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const base: StatusLeafNode = { kind: 'status', id, metric, comparator: 'over', value: 0 } as StatusLeafNode;
  if (metric === 'profitRate') base.unit = 'percent';
  else if (metric === 'margin') base.unit = 'USDT';
  else if (metric === 'buyCount') base.unit = 'count';
  else if (metric === 'entryAge') base.unit = 'days';
  return base;
}

function appendStatus(value: IndicatorConditions, metric: StatusMetric): IndicatorConditions {
  const root = ensureRoot(value);
  const node = createStatusLeaf(metric);
  const group = createIndicatorGroup('and', [node as unknown as ConditionNode]);
  const nextRoot = root.kind === 'group' ? { ...root, children: [...root.children, group] } : createIndicatorGroup('or', [group]);
  return ({ root: normalizeConditionTree(nextRoot) } as unknown) as IndicatorConditions;
}

export function ConditionsEditorModal({
  open,
  title,
  value,
  onChange,
  onClose,
  initialMode = 'select',
  initialTitle,
  embedded = false,
  previewCtx
}: {
  open: boolean;
  title: string;
  value: IndicatorConditions;
  onChange: (next: IndicatorConditions) => void;
  onClose: () => void;
  initialMode?: 'select' | 'edit';
  initialTitle?: string;
  embedded?: boolean;
  previewCtx?: {
    symbol: string;
    symbolInput?: string;
    onSymbolChange?: (v: string) => void;
    quote?: 'USDT' | 'USDC';
    onQuoteChange?: (q: 'USDT' | 'USDC') => void;
    interval: any;
    direction: 'long' | 'short';
    indicatorSignals?: Record<string, boolean>;
    assumeSignalsOn?: boolean;
    onToggle?: (v: boolean) => void;
  };
}) {
  const [local, setLocal] = useState<IndicatorConditions>(() => value);
  const [mode, setMode] = useState<'select' | 'edit'>('select');
  const [currentTitle, setCurrentTitle] = useState(title);
  const { show } = useOptionalToast();
  const [history, setHistory] = useState<IndicatorConditions[]>([]);
  const [redo, setRedo] = useState<IndicatorConditions[]>([]);
  const [selectedKey, setSelectedKey] = useState<IndicatorKey | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<StatusMetric | null>(null);

  // 의도적으로 open 변경에만 반응하여 편집 중 타이틀/모드가 리셋되지 않도록 함
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (open) {
      setLocal(value);
      setMode(initialMode);
      setCurrentTitle(initialTitle ?? title);
    }
  }, [open]);

  // 부모 value가 열려있는 동안 외부에서 갱신될 때(예: 그룹 편집 상단의 ‘지표 추가’), 본문에 즉시 반영
  useEffect(() => {
    if (open) {
      setLocal(value);
    }
  }, [value, open]);

  const indicators = useMemo(() => Object.keys(INDICATOR_LABELS) as IndicatorKey[], []);
  const statusMetrics = useMemo(() => ['profitRate', 'margin', 'buyCount', 'entryAge'] as StatusMetric[], []);
  const addLockRef = useRef(false);
  const lastAddRef = useRef<{ key: IndicatorKey; at: number } | null>(null);
  const pendingAddRef = useRef<IndicatorKey | null>(null);
  const lastAppendRef = useRef<{ key: IndicatorKey; at: number } | null>(null);

  const commit = (next: IndicatorConditions) => {
    setHistory((prev) => (prev.length >= 20 ? [...prev.slice(1), local] : [...prev, local]));
    setRedo([]);
    setLocal(next);
    onChange(next);
  };

  const canUndo = history.length > 0;
  const canRedo = redo.length > 0;
  useEffect(() => {
    if (!open) return;
    if (mode !== 'edit') return;
    if (!pendingAddRef.current) return;
    const key = pendingAddRef.current;
    pendingAddRef.current = null;
    const now = Date.now();
    if (lastAppendRef.current && lastAppendRef.current.key === key && now - lastAppendRef.current.at < 500) {
      return;
    }
    const next = appendIndicator(local, key);
    commit(next);
    show({ title: '지표 추가됨', description: INDICATOR_LABELS[key], type: 'success' });
    lastAppendRef.current = { key, at: now };
    // after switching to edit, keep focus on newly edited list; nothing else
  }, [mode, open]);
  useEffect(() => {
    const onSwitch = () => setMode('edit');
    window.addEventListener('switch-to-edit', onSwitch);
    return () => window.removeEventListener('switch-to-edit', onSwitch);
  }, []);
  const handleUndo = () => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setRedo((r) => [local, ...r]);
    setLocal(prev);
    onChange(prev);
  };
  const handleRedo = () => {
    if (!canRedo) return;
    const [next, ...rest] = redo;
    setRedo(rest);
    setHistory((h) => [...h, local]);
    setLocal(next);
    onChange(next);
  };

  const symValid = useSymbolValidation((previewCtx?.symbolInput || previewCtx?.symbol || ''), (previewCtx?.quote ?? 'USDT') as any);

  if (!open) return null;

  const Content = (
        <div className="p-4 max-h-[75vh] overflow-auto">
          {previewCtx ? (
            <div className="mb-3 flex items-center justify-between">
              <ConditionsPreview
                conditions={local}
                symbol={previewCtx.symbol}
                interval={previewCtx.interval}
                direction={previewCtx.direction}
                indicatorSignals={previewCtx.indicatorSignals}
                enabled={false}
              />
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={(previewCtx as any).enabled ?? false}
                    onChange={(e) => {
                      // Consumers can manage enabled state via onToggle; if not provided, noop
                      (previewCtx as any).onToggleEnabled?.(e.target.checked);
                      // Fallback: dispatch custom event so parents can listen if needed
                      window.dispatchEvent(new CustomEvent('preview-enabled-toggle', { detail: e.target.checked }));
                    }}
                  />
                  프리뷰 활성화
                </label>
                <label className="flex items-center gap-2">
                  <span>심볼</span>
                  <input
                    value={previewCtx.symbolInput ?? ''}
                    onChange={(e) => previewCtx.onSymbolChange?.(e.target.value)}
                    onBlur={(e) => {
                      const q = previewCtx.quote ?? 'USDT';
                      const norm = normalizePreviewSymbol(e.currentTarget.value || previewCtx.symbol, q);
                      previewCtx.onSymbolChange?.(norm);
                    }}
                    placeholder={previewCtx.symbol}
                    className={`w-44 rounded bg-zinc-900 px-2 py-1 text-zinc-100 ${
                      symValid?.valid === true ? 'border border-emerald-600' : symValid?.valid === false ? 'border border-rose-600' : 'border border-zinc-700'
                    }`}
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>쿼트</span>
                  <select
                    value={previewCtx.quote ?? 'USDT'}
                    onChange={(e) => previewCtx.onQuoteChange?.(e.target.value as 'USDT' | 'USDC')}
                    className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
                  >
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!previewCtx.assumeSignalsOn} onChange={(e) => previewCtx.onToggle?.(e.target.checked)} />
                  지표 신호 가정(ON)
                </label>
              </div>
            </div>
          ) : null}
          {mode === 'select' ? (
            <div className="space-y-4">
              <p className="text-xs text-zinc-400">지표 선택</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {indicators.map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={selectedKey === key}
                    onClick={() => setSelectedKey((prev) => (prev === key ? null : key))}
                    className={`rounded px-3 py-2 text-left text-xs ${
                      selectedKey === key
                        ? 'border border-emerald-500/60 text-emerald-200'
                        : 'border border-zinc-700 text-zinc-200 hover:border-emerald-500/60 hover:text-emerald-200'
                    }`}
                  >
                    {INDICATOR_LABELS[key]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedKey}
                  onClick={() => {
                    if (!selectedKey) return;
                    const key = selectedKey;
                    const now = Date.now();
                    if (lastAddRef.current && lastAddRef.current.key === key && now - lastAddRef.current.at < 400) {
                      return;
                    }
                    lastAddRef.current = { key, at: now };
                    const next = appendIndicator(local, key);
                    commit(next);
                    setSelectedKey(null);
                  }}
                  className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-50"
                >
                  추가
                </button>
                <span className="text-[11px] text-zinc-500">선택 후 ‘추가’를 눌러 아래 목록에 쌓입니다.</span>
              </div>
              <div className="h-px w-full bg-zinc-800/60" />
              <p className="text-xs text-zinc-400">상태 조건</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {statusMetrics.map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={selectedStatus === m}
                    onClick={() => setSelectedStatus((prev) => (prev === m ? null : m))}
                    className={`rounded px-3 py-2 text-left text-xs ${
                      selectedStatus === m
                        ? 'border border-sky-500/60 text-sky-200'
                        : 'border border-zinc-700 text-zinc-200 hover:border-sky-500/60 hover:text-sky-200'
                    }`}
                  >
                    {STATUS_LABELS[m]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={!selectedStatus}
                  onClick={() => {
                    if (!selectedStatus) return;
                    const next = appendStatus(local, selectedStatus);
                    commit(next);
                    setSelectedStatus(null);
                  }}
                  className="rounded border border-sky-500/60 px-3 py-1.5 text-xs font-semibold text-sky-200 disabled:opacity-50"
                >
                  상태 추가
                </button>
                <span className="text-[11px] text-zinc-500">상태 조건은 새 그룹으로 추가됩니다.</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-end"></div>
              <GroupTreeEditor value={local} onChange={(next) => commit(next)} />
            </div>
          )}
        </div>
  );

  if (embedded) {
    // Render only the body without overlay/header when embedded
    return <div className="rounded-lg border border-zinc-800 bg-zinc-950">{Content}</div>;
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,880px)] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">{currentTitle}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLocal(value);
                onChange(value); // reset to original
              }}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(local);
                onClose();
              }}
              className="rounded border border-emerald-500/60 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-400"
            >
              저장
            </button>
          </div>
        </header>
        {Content}
      </div>
    </div>
  );
}

function RootOperatorToggle({ value, onChange }: { value: IndicatorConditions; onChange: (next: IndicatorConditions) => void }) {
  const root = ensureRoot(value);
  const setOp = (op: AggregatorOperator) => {
    const compat = { ...(value as any) };
    compat.defaultAggregator = op;
    onChange({ ...compat, root: normalizeConditionTree({ ...root, operator: op }) });
  };
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setOp('and')}
        className={`rounded px-2 py-1 text-xs ${root.operator === 'and' ? 'border border-emerald-500/60 text-emerald-200' : 'border border-zinc-700 text-zinc-200'}`}
      >
        모든 조건 충족
      </button>
      <button
        type="button"
        onClick={() => setOp('or')}
        className={`rounded px-2 py-1 text-xs ${root.operator === 'or' ? 'border border-emerald-500/60 text-emerald-200' : 'border border-zinc-700 text-zinc-200'}`}
      >
        조건 중 하나 이상
      </button>
    </div>
  );
}

function GroupTreeEditor({ value, onChange }: { value: IndicatorConditions; onChange: (next: IndicatorConditions) => void }) {
  const root = ensureRoot(value);
  const { show } = useOptionalToast();
  const [hoverGroup, setHoverGroup] = useState<string | null>(null);
  const [hoverIndicator, setHoverIndicator] = useState<{ id: string; pos: 'before' | 'after' } | null>(null);

  const replaceStatusNode = (node: ConditionNode, targetId: string, replacer: (cur: StatusLeafNode) => StatusLeafNode): ConditionNode => {
    if (node.kind === 'status') {
      if (node.id === targetId) return replacer(node);
      return node;
    }
    if (node.kind === 'group') {
      return { ...node, children: node.children.map((c) => replaceStatusNode(c, targetId, replacer)) };
    }
    return node;
  };

  const updateIndicator = (id: string, updater: (current: IndicatorKey, config: any) => any) => {
    const nextRoot = replaceIndicatorNode(root, id, (current) => {
      const type = current.indicator.type;
      const nextConfig = updater(type, current.indicator.config);
      return { ...current, indicator: { ...current.indicator, config: nextConfig } };
    });
    const compat = { ...(value as any) };
    if (Array.isArray(compat.entries)) {
      compat.entries = compat.entries.map((e: any) => (e.id === id ? { ...e, config: updater(e.type, e.config) } : e));
    }
    onChange({ ...compat, root: normalizeConditionTree(nextRoot) });
  };

  const removeIndicator = (id: string) => {
    const nextRoot = ensureGroup(removeNode(root, id) ?? root);
    const compat = { ...(value as any) };
    if (Array.isArray(compat.entries)) {
      compat.entries = compat.entries.filter((e: any) => e.id !== id);
    }
    onChange({ ...compat, root: normalizeConditionTree(nextRoot) });
    show({ title: '지표 제거됨', type: 'info' });
  };

  const updateGroupOperator = (groupId: string, op: AggregatorOperator) => {
    const nextRoot = replaceGroupOperator(root, groupId, op);
    const compat = { ...(value as any) };
    compat.defaultAggregator = op; // 호환 필드
    onChange({ ...compat, root: normalizeConditionTree(nextRoot) });
  };

  const addIndicatorTo = (groupId: string) => {
    const nextRoot = insertChild(root, groupId, createIndicatorLeaf(createIndicatorEntry('ma')));
    const compat = { ...(value as any) };
    // compat entries는 appendIndicator 경로에서 갱신됨. 여기서는 트리만 반영.
    onChange({ ...compat, root: normalizeConditionTree(nextRoot) });
  };

  const addGroupTo = (groupId: string, op: AggregatorOperator) => {
    const nextRoot = insertChild(root, groupId, createIndicatorGroup(op));
    onChange({ ...(value as any), root: normalizeConditionTree(nextRoot) });
    show({ title: '그룹 추가됨', description: op.toUpperCase(), type: 'success' });
  };

  const removeNodeFromTree = (nodeId: string) => {
    const nextRoot = ensureGroup(removeNode(root, nodeId) ?? root);
    onChange({ ...(value as any), root: normalizeConditionTree(nextRoot) });
    show({ title: '그룹 제거됨', type: 'info' });
  };

  const updateCandle = (candleId: string, updater: (current: CandleLeafNode) => CandleLeafNode) => {
    const nextRoot = replaceCandleNode(root, candleId, updater);
    const compat = { ...(value as any) };
    onChange({ ...compat, root: normalizeConditionTree(nextRoot) });
  };

  const dragKey = 'application/x-cond-node';

  const renderNode = (node: ConditionNode, _isRoot = false) => {
    if (node.kind === 'group') {
      // 그룹 UI 제거: 단순히 자식 노드만 렌더링(플랫 편집)
      return <div key={node.id} className="space-y-3">{node.children.map((child) => renderNode(child))}</div>;
    }
    if (node.kind === 'status') {
      const metricOptions: Array<{ key: StatusMetric; label: string }> = [
        { key: 'profitRate', label: STATUS_LABELS.profitRate },
        { key: 'margin', label: STATUS_LABELS.margin },
        { key: 'buyCount', label: STATUS_LABELS.buyCount },
        { key: 'entryAge', label: STATUS_LABELS.entryAge }
      ];
      const unitOptions = (m: StatusMetric): StatusUnit[] => {
        if (m === 'profitRate') return ['percent'];
        if (m === 'margin') return ['USDT', 'USDC'];
        if (m === 'buyCount') return ['count'];
        return ['days'];
      };
      const units = unitOptions(node.metric);
      return (
        <div key={node.id} className="space-y-2 rounded border border-zinc-800 bg-zinc-950/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded border border-sky-500/40 px-2 py-0.5 text-[11px] text-sky-200">상태</span>
              <span className="text-sm font-semibold text-sky-200">{STATUS_LABELS[node.metric]}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextRoot = ensureGroup(removeNode(root, node.id) ?? root);
                onChange({ ...(value as any), root: normalizeConditionTree(nextRoot) });
              }}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-rose-400 hover:text-rose-300"
            >
              제거
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
            <label className="flex items-center gap-1">
              <span className="text-zinc-400">메트릭</span>
              <select
                value={node.metric}
                onChange={(e) => {
                  const m = e.target.value as StatusMetric;
                  const defUnits = unitOptions(m);
                  const nextUnit = defUnits.includes(node.unit as any) ? (node.unit as StatusUnit) : defUnits[0];
                  const next = replaceStatusNode(root, node.id, (cur) => ({ ...cur, metric: m, unit: nextUnit }));
                  onChange({ ...(value as any), root: normalizeConditionTree(next) });
                }}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
              >
                {metricOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-zinc-400">비교</span>
              <select
                value={node.comparator}
                onChange={(e) => {
                  const next = replaceStatusNode(root, node.id, (cur) => ({ ...cur, comparator: e.target.value as ComparisonOperator }));
                  onChange({ ...(value as any), root: normalizeConditionTree(next) });
                }}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
              >
                <option value="over">보다 큼({">"})</option>
                <option value="gte">크거나같음(≥)</option>
                <option value="eq">같음(=)</option>
                <option value="lte">작거나같음(≤)</option>
                <option value="under">보다 작음({"<"})</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-zinc-400">값</span>
              <input
                type="number"
                value={node.value}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  const next = replaceStatusNode(root, node.id, (cur) => ({ ...cur, value: Number.isFinite(v) ? v : cur.value }));
                  onChange({ ...(value as any), root: normalizeConditionTree(next) });
                }}
                className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-1">
              <span className="text-zinc-400">단위</span>
              <select
                value={(node.unit as any) ?? ''}
                onChange={(e) => {
                  const next = replaceStatusNode(root, node.id, (cur) => ({ ...cur, unit: e.target.value as StatusUnit }));
                  onChange({ ...(value as any), root: normalizeConditionTree(next) });
                }}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
              >
                {units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      );
    }
    if (node.kind === 'indicator') {
      const all = collectIndicatorNodes(root);
      const groups = collectGroupNodes(root);
      const parentInfo = (() => {
        // compute index within parent for move up/down UI state
        const get = (n: ConditionNode, parent: ConditionNode | null = null): { parent: any; index: number } | null => {
          if (n.kind !== 'group') return null;
          for (let i = 0; i < n.children.length; i++) {
            const c = n.children[i];
            if (c.id === node.id) return { parent: n, index: i };
            const res = get(c, n);
            if (res) return res;
          }
          return null;
        };
        return get(root);
      })();
      const summary = getIndicatorSummary(node);
      return (
        <div
          key={node.id}
          className="relative space-y-3 rounded border border-zinc-800 bg-zinc-950/50 p-3"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
            const pos: 'before' | 'after' = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
            setHoverIndicator((prev) => (prev?.id === node.id && prev.pos === pos ? prev : { id: node.id, pos }));
          }}
          onDrop={(e) => {
            const data = e.dataTransfer.getData(dragKey);
            if (!data) return;
            const sourceId = data;
            if (sourceId === node.id) return;
            const pos = hoverIndicator?.id === node.id ? hoverIndicator.pos : 'before';
            const next = moveNodeRelative(root, sourceId, node.id, pos);
            onChange({ ...(value as any), root: normalizeConditionTree(next) });
            setHoverIndicator(null);
            setHoverGroup(null);
          }}
          onDragEnter={() => setHoverIndicator((prev) => ({ id: node.id, pos: prev?.pos ?? 'before' }))}
          onDragLeave={() => setHoverIndicator((prev) => (prev?.id === node.id ? null : prev))}
          onDragEnd={() => {
            setHoverIndicator(null);
            setHoverGroup(null);
          }}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              onChange({ ...(value as any), root: normalizeConditionTree(moveNode(root, node.id, 'up')) });
            } else if (e.key === 'ArrowDown') {
              e.preventDefault();
              onChange({ ...(value as any), root: normalizeConditionTree(moveNode(root, node.id, 'down')) });
            } else if (e.key.toLowerCase() === 'd' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              const res = duplicateIndicator(root, node.id);
              onChange({ ...(value as any), root: normalizeConditionTree(res.root) });
              show({ title: '지표 복제됨', type: 'success' });
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
              e.preventDefault();
              const nextRoot = ensureGroup(removeNode(root, node.id) ?? root);
              onChange({ ...(value as any), root: normalizeConditionTree(nextRoot) });
              show({ title: '지표 제거됨', type: 'info' });
            }
          }}
          role="listitem"
        >
          {hoverIndicator?.id === node.id && hoverIndicator.pos === 'before' ? (
            <div className="pointer-events-none absolute -top-1 left-0 right-0 h-0.5 bg-emerald-400/80" />
          ) : null}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                role="button"
                aria-label="드래그 이동"
                title="드래그 이동"
                className="cursor-grab select-none rounded border border-zinc-700 px-1 text-[11px] text-zinc-400"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData(dragKey, node.id);
                }}
              >
                ⠿
              </span>
              <p className="text-sm font-semibold text-emerald-200">{INDICATOR_LABELS[node.indicator.type]}</p>
            </div>
            <button
              type="button"
              onClick={() => removeIndicator(node.id)}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-rose-400 hover:text-rose-300"
            >
              제거
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <button
              type="button"
              disabled={!parentInfo || parentInfo.index <= 0}
              onClick={() => onChange({ ...(value as any), root: normalizeConditionTree(moveNode(root, node.id, 'up')) })}
              className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-50"
            >
              위로
            </button>
            <button
              type="button"
              disabled={!parentInfo || !parentInfo.parent || parentInfo.index >= parentInfo.parent.children.length - 1}
              onClick={() => onChange({ ...(value as any), root: normalizeConditionTree(moveNode(root, node.id, 'down')) })}
              className="rounded border border-zinc-700 px-2 py-0.5 disabled:opacity-50"
            >
              아래로
            </button>
            <button
              type="button"
              onClick={() => {
                const res = duplicateIndicator(root, node.id);
                const compat = { ...(value as any) };
                if (Array.isArray(compat.entries)) {
                  compat.entries = [...compat.entries, { id: res.newId, type: node.indicator.type, config: node.indicator.config, aggregator: 'and', comparison: { mode: 'none' } }];
                }
                onChange({ ...compat, root: normalizeConditionTree(res.root) });
                show({ title: '지표 복제됨', type: 'success' });
              }}
              className="rounded border border-zinc-700 px-2 py-0.5"
            >
              복제
            </button>
            <span className="ml-2">그룹 이동</span>
            <select
              onChange={(e) => {
                const next = moveNodeToGroup(root, node.id, e.target.value);
                onChange({ ...(value as any), root: normalizeConditionTree(next) });
                e.currentTarget.selectedIndex = 0;
              }}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[11px] text-zinc-300"
              disabled={groups.length <= 1}
            >
              <option value="">선택</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.id === (parentInfo?.parent?.id ?? '') ? '(현재) ' : ''}그룹 {g.operator.toUpperCase()} …
                </option>
              ))}
            </select>
          </div>
          {summary ? (
            <p className="text-[11px] text-zinc-400">{summary}</p>
          ) : null}
          <IndicatorParamEditor
            type={node.indicator.type}
            value={node.indicator.config as any}
            onChange={(next) => updateIndicator(node.id, () => next)}
          />
          <InlineComparisonEditor node={node} allNodes={all} onChange={(next) => updateComparison(value, onChange, node.id, next)} />
          {hoverIndicator?.id === node.id && hoverIndicator.pos === 'after' ? (
            <div className="pointer-events-none absolute -bottom-1 left-0 right-0 h-0.5 bg-emerald-400/80" />
          ) : null}
        </div>
      );
    }
    if (node.kind === 'candle') return null; // 캔들 기준 편집 UI 제거 (비교 기준에서 처리)
    return null;
  };

  return <div className="space-y-4">{renderNode(root, true)}</div>;
}

function SummaryPanel({ value }: { value: IndicatorConditions }) {
  const root = ensureRoot(value);
  const items = collectIndicatorNodes(root);
  if (items.length === 0) return null;
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
      <p className="mb-2 text-xs font-semibold text-zinc-300">조건 요약</p>
      <ul className="space-y-1 text-[11px] text-zinc-400">
        {items.map((n, idx) => (
          <li key={n.id} className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-zinc-700 text-[10px] text-zinc-300">
              {idx + 1}
            </span>
            <span className="text-zinc-300">{INDICATOR_LABELS[n.indicator.type]}</span>
            <span className="opacity-70">— {getIndicatorSummary(n)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SelectListPanel({ value, onChange }: { value: IndicatorConditions; onChange: (next: IndicatorConditions) => void }) {
  const root = ensureRoot(value);
  const items = collectIndicatorNodes(root);
  const operator = root.operator;
  const setOp = (op: AggregatorOperator) => {
    const compat = { ...(value as any) };
    compat.defaultAggregator = op;
    onChange({ ...compat, root: normalizeConditionTree({ ...root, operator: op }) });
  };
  if (items.length === 0) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950/40 p-3 text-[11px] text-zinc-500">추가된 조건이 없습니다.</div>
    );
  }
  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold text-zinc-300">추가된 조건</p>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-zinc-400">병합 방식</span>
          <button
            type="button"
            onClick={() => setOp('and')}
            className={`rounded px-2 py-0.5 ${operator === 'and' ? 'border border-emerald-500/60 text-emerald-200' : 'border border-zinc-700 text-zinc-200'}`}
          >
            AND
          </button>
          <button
            type="button"
            onClick={() => setOp('or')}
            className={`rounded px-2 py-0.5 ${operator === 'or' ? 'border border-emerald-500/60 text-emerald-200' : 'border border-zinc-700 text-zinc-200'}`}
          >
            OR
          </button>
        </div>
      </div>
      <ul className="space-y-2">
        {items.map((n) => (
          <li key={n.id} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/40 p-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className="shrink-0 rounded border border-zinc-700 px-1 text-[10px] text-zinc-300">{INDICATOR_LABELS[n.indicator.type]}</span>
              <span className="truncate text-[11px] text-zinc-400">{getIndicatorSummary(n)}</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  // 전환: 편집 모드로 이동
                  const ev = new Event('switch-to-edit');
                  window.dispatchEvent(ev);
                }}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300"
              >
                편집
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextRoot = ensureGroup(removeNode(root, n.id) ?? root);
                  onChange({ ...(value as any), root: normalizeConditionTree(nextRoot) });
                }}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-rose-300"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CandleNodeEditor({ node, onChange }: { node: CandleLeafNode; onChange: (next: CandleLeafNode) => void }) {
  const { candle } = node;
  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-100">캔들 기준</span>
        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input type="checkbox" checked={candle.enabled} onChange={(e) => onChange({ ...node, candle: { ...candle, enabled: e.target.checked } })} />
          사용
        </label>
      </div>
      {candle.enabled ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <select
            value={candle.field}
            onChange={(e) => onChange({ ...node, candle: { ...candle, field: e.target.value as CandleFieldOption } })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          >
            {(['open', 'high', 'low', 'close'] as CandleFieldOption[]).map((f) => (
              <option key={f} value={f}>
                {f.toUpperCase()}
              </option>
            ))}
          </select>
          <select
            value={candle.comparator}
            onChange={(e) => onChange({ ...node, candle: { ...candle, comparator: e.target.value as ComparisonOperator } })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          >
            <option value="over">이상</option>
            <option value="under">이하</option>
          </select>
          <select
            value={candle.reference}
            onChange={(e) => onChange({ ...node, candle: { ...candle, reference: e.target.value as CandleReference } })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          >
            <option value="current">현재</option>
            <option value="previous">이전</option>
          </select>
          <input
            type="number"
            value={candle.targetValue}
            onChange={(e) => onChange({ ...node, candle: { ...candle, targetValue: Number(e.target.value) || 0 } })}
            className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
          />
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">비활성화 시 지표 간 비교만 평가됩니다.</p>
      )}
    </div>
  );
}

function toLegacyComparison(cmp: IndicatorLeafNode['comparison']): any {
  if (cmp.kind === 'none') return { mode: 'none' };
  if (cmp.kind === 'candle') return { mode: 'candle', comparator: cmp.comparator, field: cmp.field, reference: cmp.reference };
  if (cmp.kind === 'value') return { mode: 'value', comparator: cmp.comparator, value: cmp.value };
  if (cmp.kind === 'indicator') return { mode: 'indicator', comparator: cmp.comparator, targetEntryId: cmp.targetIndicatorId };
  return { mode: 'none' };
}

function updateComparison(value: IndicatorConditions, onChange: (next: IndicatorConditions) => void, id: string, cmp: IndicatorLeafNode['comparison']) {
  const root = ensureRoot(value);
  const nextRoot = replaceIndicatorNode(root, id, (current) => ({ ...current, comparison: cmp }));
  const compat = { ...(value as any) };
  if (Array.isArray(compat.entries)) {
    compat.entries = compat.entries.map((e: any) => (e.id === id ? { ...e, comparison: toLegacyComparison(cmp) } : e));
  }
  onChange({ ...compat, root: normalizeConditionTree(nextRoot) });
}

function InlineComparisonEditor({
  node,
  allNodes,
  onChange
}: {
  node: IndicatorLeafNode;
  allNodes: IndicatorLeafNode[];
  onChange: (next: IndicatorLeafNode['comparison']) => void;
}) {
  const mode = node.comparison.kind;
  const comparator = mode === 'none' ? 'over' : node.comparison.comparator;
  const lhsLabel = `${INDICATOR_LABELS[node.indicator.type]} 값`;
  const rhsLabel = (() => {
    if (mode === 'value') return `고정 값 ${(node.comparison as any).value ?? 0}`;
    if (mode === 'candle') {
      const c = node.comparison as any;
      return `캔들 ${String(c.field).toUpperCase()}(${c.reference === 'previous' ? '이전' : '현재'})`;
    }
    if (mode === 'indicator') {
      const t = (node.comparison as any).targetIndicatorId;
      const target = allNodes.find((n) => n.id === t);
      const metric = (node.comparison as any).metric;
      const ref = (node.comparison as any).reference;
      const base = target ? `${INDICATOR_LABELS[target.indicator.type]} 값` : '다른 지표 값';
      const m = metric ? ` ${metric}` : '';
      const r = ref ? `(${ref === 'previous' ? '이전' : '현재'})` : '';
      return `${base}${m}${r}`.trim();
    }
    return '';
  })();
  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-200">비교 기준</span>
        <select
          value={mode}
          onChange={(e) => {
            const m = e.target.value as 'none' | 'candle' | 'value' | 'indicator';
            if (m === 'none') return onChange({ kind: 'none' });
            if (m === 'candle') return onChange({ kind: 'candle', comparator: 'over', field: 'close', reference: 'previous' });
            if (m === 'value') return onChange({ kind: 'value', comparator: 'over', value: 0 });
            const another = allNodes.find((n) => n.id !== node.id);
            return onChange({ kind: 'indicator', comparator: 'over', targetIndicatorId: another?.id ?? node.id });
          }}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          <option value="none">비교 없음</option>
          <option value="candle">캔들 값</option>
          <option value="value">고정 값</option>
          <option value="indicator" disabled={allNodes.length <= 1}>
            다른 지표
          </option>
        </select>
      </div>
      {mode !== 'none' ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-zinc-200">비교 연산자</span>
          <select
            value={comparator}
            onChange={(e) => onChange({ ...(node.comparison.kind === 'none' ? { kind: 'value', value: 0 } : (node.comparison as any)), comparator: e.target.value as ComparisonOperator })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="none">선택안함</option>
            <option value="over">크다 ({">"})</option>
            <option value="under">작다 ({"<"})</option>
            <option value="eq">같다 (=)</option>
            <option value="gte">크거나같다 ({">="})</option>
            <option value="lte">작거나같다 ({"<="})</option>
          </select>
          {mode === 'value' ? (
            <input
              type="number"
              value={(node.comparison as any).value}
              onChange={(e) => onChange({ ...(node.comparison as any), value: Number(e.target.value) || 0 })}
              className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
            />
          ) : null}
          {mode === 'candle' ? (
            <>
              <select
                value={(node.comparison as any).field}
                onChange={(e) => onChange({ ...(node.comparison as any), field: e.target.value as CandleFieldOption })}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              >
                {(['open', 'high', 'low', 'close'] as CandleFieldOption[]).map((f) => (
                  <option key={f} value={f}>
                    {f.toUpperCase()}
                  </option>
                ))}
              </select>
              <select
                value={(node.comparison as any).reference}
                onChange={(e) => onChange({ ...(node.comparison as any), reference: e.target.value as CandleReference })}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              >
                <option value="current">현재</option>
                <option value="previous">이전</option>
              </select>
            </>
          ) : null}
          {mode === 'indicator' ? (
            <>
              <select
                value={(node.comparison as any).targetIndicatorId}
                onChange={(e) => onChange({ ...(node.comparison as any), targetIndicatorId: e.target.value })}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              >
                {allNodes
                  .filter((n) => n.id !== node.id)
                  .map((n) => (
                    <option key={n.id} value={n.id}>
                      {INDICATOR_LABELS[n.indicator.type]}
                    </option>
                  ))}
              </select>
              {(() => {
                const t = allNodes.find((n) => n.id === (node.comparison as any).targetIndicatorId);
                if (t?.indicator.type === 'bollinger') {
                  return (
                    <select
                      value={(node.comparison as any).metric ?? 'upper'}
                      onChange={(e) => onChange({ ...(node.comparison as any), metric: e.target.value })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                    >
                      <option value="upper">상단</option>
                      <option value="middle">중간</option>
                      <option value="lower">하단</option>
                    </select>
                  );
                }
                return null;
              })()}
              <select
                value={(node.comparison as any).reference ?? 'current'}
                onChange={(e) => onChange({ ...(node.comparison as any), reference: e.target.value as CandleReference })}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
              >
                <option value="current">현재</option>
                <option value="previous">이전</option>
              </select>
            </>
          ) : null}
          <span className="ml-2 text-[11px] text-zinc-400">
            해석: <strong className="text-zinc-200">{lhsLabel}</strong>{' '}
            {comparator === 'over' ? '>' : '<'}{' '}
            <strong className="text-zinc-200">{rhsLabel}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function getIndicatorSummary(node: IndicatorLeafNode): string {
  const type = node.indicator.type;
  const config: any = node.indicator.config;
  const parts: string[] = [];
  if (type === 'ma') {
    parts.push(`period ${config.period}`);
    if (Array.isArray(config.actions) && config.actions.length > 0) parts.push(config.actions.join(','));
  } else if (type === 'bollinger') {
    parts.push(`len ${config.length}`, `${config.standardDeviation}σ`, config.band);
    if (config.action && config.action !== 'none') parts.push(config.action);
  } else if (type === 'rsi') {
    parts.push(`period ${config.period}`, config.smoothing?.toUpperCase());
    if (typeof config.threshold === 'number') parts.push(`th ${config.threshold}`);
    if (Array.isArray(config.actions) && config.actions.length > 0) parts.push(config.actions.join(','));
  } else if (type === 'dmi') {
    parts.push(`DI ${config.diPeriod}`, `ADX ${config.adxPeriod}`);
    if (config.diComparison) parts.push(config.diComparison);
    if (config.adxVsDi) parts.push(config.adxVsDi);
  } else if (type === 'macd') {
    parts.push(`(${config.fast},${config.slow},${config.signal})`, config.method);
    if (config.comparison) parts.push(config.comparison);
    if (config.histogramAction) parts.push(`hist ${config.histogramAction}`);
  }
  const cmp = node.comparison;
  if (cmp.kind === 'candle') parts.push(`cmp: candle ${cmp.field.toUpperCase()}(${cmp.reference}) ${cmp.comparator}`);
  if (cmp.kind === 'value') parts.push(`cmp: ${cmp.comparator} ${cmp.value}`);
  if (cmp.kind === 'indicator') parts.push(`cmp: other ${cmp.comparator}`);
  return parts.join(' · ');
}
