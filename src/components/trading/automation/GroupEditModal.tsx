'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ConditionGroupNode, ConditionNode, IndicatorConditions, StatusLeafNode, StatusMetric, StatusUnit } from '@/types/trading/auto-trading';
import { normalizeConditionTree, createIndicatorEntry, createIndicatorLeaf } from '@/lib/trading/autoTradingDefaults';
import { replaceGroupChildren, ensureGroup } from '@/lib/trading/conditionsTree';
import { ConditionsEditorModal } from './ConditionsEditorModal';
import { ConditionsPreview } from './ConditionsPreview';
import { useSymbolValidation } from '@/hooks/useSymbolValidation';
import { normalizeSymbol as normalizePreviewSymbol } from '@/lib/trading/symbols';

// Lightweight wrapper: reuse ConditionsEditorModal's editor for a single group
export function GroupEditModal({
  open,
  title,
  conditions,
  groupId,
  onChange,
  onClose,
  preview
}: {
  open: boolean;
  title: string;
  conditions: IndicatorConditions;
  groupId: string;
  onChange: (next: IndicatorConditions) => void;
  onClose: () => void;
  preview?: {
    symbol: string;
    symbolInput?: string;
    onSymbolChange?: (v: string) => void;
    quote?: 'USDT' | 'USDC';
    onQuoteChange?: (q: 'USDT' | 'USDC') => void;
    datalistOptions?: string[];
    interval: any;
    direction: 'long' | 'short';
    indicatorSignals?: Record<string, boolean>;
    assumeSignalsOn?: boolean;
    onToggle?: (v: boolean) => void;
  };
}) {
  const [origin, setOrigin] = useState<IndicatorConditions>(() => conditions);
  // 편집 대상 그룹 전체를 상태로 관리(자식만 분리하지 않음)
  const [editedGroup, setEditedGroup] = useState<ConditionGroupNode | null>(null);
  const symValid = useSymbolValidation(preview ? (preview.symbolInput || preview.symbol) : '', (preview?.quote ?? 'USDT') as any);

  const root = useMemo(() => conditions.root as unknown as ConditionNode, [conditions]);
  const group = useMemo(() => findGroupNode(root, groupId), [root, groupId]);
  const [addType, setAddType] = useState<'bollinger' | 'ma' | 'rsi' | 'dmi' | 'macd'>('ma');
  const [addStatus, setAddStatus] = useState<StatusMetric>('profitRate');

  useEffect(() => {
    if (open && group) {
      const g = normalizeConditionTree(group);
      setOrigin(({ root: g } as any) as IndicatorConditions);
      setEditedGroup(g as any);
    }
  }, [open, group]);

  if (!open) return null;
  if (!group) return null;

  const handleSave = () => {
    if (!editedGroup) return onClose();
    const baseRoot = conditions.root as unknown as ConditionNode;
    const next = replaceGroupChildren(baseRoot, groupId, editedGroup.children);
    onChange({ ...(conditions as any), root: normalizeConditionTree(next) } as any);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,860px)] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const g = origin.root as unknown as ConditionGroupNode;
                const norm = normalizeConditionTree(g);
                setEditedGroup(norm as any);
              }}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              초기화
            </button>
            <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">
              취소
            </button>
            <button type="button" onClick={handleSave} className="rounded border border-emerald-500/60 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-400">
              저장
            </button>
          </div>
        </header>
        <div className="space-y-4 p-4">
          {preview ? (
            <div className="flex items-center justify-between">
              <ConditionsPreview
                conditions={{ root: (editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) } as any}
                symbol={preview.symbol}
                interval={preview.interval}
                direction={preview.direction}
                indicatorSignals={preview.indicatorSignals}
              />
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <label className="flex items-center gap-2">
                  <span>심볼</span>
                  <input
                    value={preview.symbolInput ?? ''}
                    onChange={(e) => preview.onSymbolChange?.(e.target.value)}
                    onBlur={(e) => {
                      const q = preview.quote ?? 'USDT';
                      const norm = normalizePreviewSymbol(e.currentTarget.value || preview.symbol, q);
                      preview.onSymbolChange?.(norm);
                    }}
                    placeholder={preview.symbol}
                    className={`w-44 rounded bg-zinc-900 px-2 py-1 text-zinc-100 ${
                      symValid?.valid === true ? 'border border-emerald-600' : symValid?.valid === false ? 'border border-rose-600' : 'border border-zinc-700'
                    }`}
                  />
                  {symValid?.loading ? (
                    <span className="text-[10px] text-zinc-500">검증중…</span>
                  ) : preview.symbolInput ? (
                    <span className={`rounded border px-1 text-[10px] ${symValid?.valid ? 'border-emerald-700 text-emerald-300' : 'border-zinc-800 text-zinc-500'}`}>미리보기 {preview.symbol}</span>
                  ) : null}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!preview.assumeSignalsOn} onChange={(e) => preview.onToggle?.(e.target.checked)} />
                  지표 신호 가정(ON)
                </label>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span className="text-zinc-300">지표 추가</span>
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as any)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
            >
              <option value="ma">이동평균선</option>
              <option value="bollinger">볼린저 밴드</option>
              <option value="rsi">RSI</option>
              <option value="dmi">DMI / ADX</option>
              <option value="macd">MACD</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setEditedGroup((prev) => {
                  const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                  const nextChildren = [
                    ...base.children,
                    (createIndicatorLeaf(createIndicatorEntry(addType)) as unknown) as ConditionNode,
                  ];
                  return { ...base, children: nextChildren };
                });
              }}
              className="rounded border border-emerald-500/60 px-2 py-1 text-[11px] text-emerald-200"
            >
              추가
            </button>
            <span className="ml-4 text-zinc-300">상태 추가</span>
            <select
              value={addStatus}
              onChange={(e) => setAddStatus(e.target.value as StatusMetric)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
            >
              <option value="profitRate">현재 수익률(%)</option>
              <option value="margin">현재 마진</option>
              <option value="buyCount">매수 횟수</option>
              <option value="entryAge">진입 경과(일)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const createStatus = (metric: StatusMetric): StatusLeafNode => {
                  const id = `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                  const base: StatusLeafNode = { kind: 'status', id, metric, comparator: 'over', value: 0 } as StatusLeafNode;
                  if (metric === 'profitRate') base.unit = 'percent';
                  else if (metric === 'margin') base.unit = 'USDT';
                  else if (metric === 'buyCount') base.unit = 'count';
                  else if (metric === 'entryAge') base.unit = 'days';
                  return base;
                };
                setEditedGroup((prev) => {
                  const base = (prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as ConditionGroupNode;
                  const nextChildren = [...base.children, (createStatus(addStatus) as unknown) as ConditionNode];
                  return { ...base, children: nextChildren };
                });
              }}
              className="rounded border border-sky-500/60 px-2 py-1 text-[11px] text-sky-200"
            >
              상태 추가
            </button>
          </div>
          {/* Embedded editor body only (no overlay/header) */}
          <ConditionsEditorModal
            open={true}
            title=""
            value={{ root: (editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) } as any}
            onChange={(next) => {
              const g = ensureGroup(next.root as unknown as ConditionNode);
              setEditedGroup(g as any);
            }}
            onClose={() => {}}
            initialMode="edit"
            embedded
            previewCtx={preview ? {
              symbol: preview.symbol,
              symbolInput: preview.symbolInput,
              onSymbolChange: preview.onSymbolChange,
              quote: preview.quote,
              onQuoteChange: preview.onQuoteChange,
              interval: preview.interval,
              direction: preview.direction,
              indicatorSignals: preview.indicatorSignals,
              assumeSignalsOn: preview.assumeSignalsOn,
              onToggle: preview.onToggle
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function findGroupNode(root: ConditionNode, id: string): ConditionGroupNode | null {
  if (root.kind === 'group') {
    if (root.id === id) return root;
    for (const child of root.children) {
      const r = findGroupNode(child, id);
      if (r) return r;
    }
  }
  return null;
}
