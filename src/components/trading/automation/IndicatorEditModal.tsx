'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  CandleFieldOption,
  CandleReference,
  ComparisonOperator,
  ConditionGroupNode,
  ConditionNode,
  IndicatorLeafNode,
  IndicatorConditions
} from '@/types/trading/auto-trading';
import { replaceIndicatorNode, moveNodeToGroup, collectGroupNodes, collectIndicatorNodes } from '@/lib/trading/conditionsTree';
import { normalizeConditionTree } from '@/lib/trading/autoTradingDefaults';
import { IndicatorParamEditor } from '@/components/trading/indicators/IndicatorParamEditor';

export function IndicatorEditModal({
  open,
  title,
  conditions,
  indicatorId,
  onChange,
  onClose
}: {
  open: boolean;
  title: string;
  conditions: IndicatorConditions;
  indicatorId: string;
  onChange: (next: IndicatorConditions) => void;
  onClose: () => void;
}) {
  const [local, setLocal] = useState<IndicatorConditions>(() => conditions);
  const [origin, setOrigin] = useState<IndicatorConditions>(() => conditions);

  useEffect(() => {
    if (open) {
      setLocal(conditions);
      setOrigin(conditions);
    }
  }, [open, conditions]);

  const root = useMemo(() => (local?.root as unknown as ConditionGroupNode) ?? ({ kind: 'group', id: 'root', operator: 'or', children: [] } as any), [local]);
  const allIndicators = useMemo(() => collectIndicatorNodes(root as unknown as ConditionNode), [root]);
  const target = useMemo(() => allIndicators.find((n) => n.id === indicatorId) ?? null, [allIndicators, indicatorId]);
  const groups = useMemo(() => collectGroupNodes(root as unknown as ConditionNode), [root]);

  if (!open) return null;
  if (!target) return null;

  const updateIndicator = (updater: (current: IndicatorLeafNode) => IndicatorLeafNode) => {
    const nextRoot = replaceIndicatorNode(root as unknown as ConditionNode, indicatorId, updater) as ConditionNode;
    setLocal({ root: normalizeConditionTree(nextRoot) } as any);
  };

  const handleMoveGroup = (groupId: string) => {
    const nextRoot = moveNodeToGroup(root as unknown as ConditionNode, indicatorId, groupId);
    setLocal({ root: normalizeConditionTree(nextRoot) } as any);
  };

  const allNodes = allIndicators;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,720px)] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocal(origin)}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              초기화
            </button>
            <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">
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
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span className="text-zinc-300">그룹 이동</span>
            <select
              disabled={groups.length <= 1}
              onChange={(e) => {
                if (!e.target.value) return;
                handleMoveGroup(e.target.value);
                e.currentTarget.selectedIndex = 0;
              }}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300"
            >
              <option value="">선택</option>
              {groups.map((g, idx) => (
                <option key={g.id} value={g.id}>
                  조건 그룹 {idx + 1}
                </option>
              ))}
            </select>
          </div>

          <IndicatorParamEditor
            type={target.indicator.type}
            value={target.indicator.config as any}
            onChange={(next) => updateIndicator((cur) => ({ ...cur, indicator: { ...cur.indicator, config: next } }))}
          />

          <InlineComparisonEditor node={target} allNodes={allNodes} onChange={(cmp) => updateIndicator((cur) => ({ ...cur, comparison: cmp }))} />
        </div>
      </div>
    </div>
  );
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
  const lhsLabel = '지표 값';
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
      const base = target ? labelOf(target.indicator.type) : '다른 지표';
      const m = metric ? ` ${metric}` : '';
      const r = ref ? `(${ref === 'previous' ? '이전' : '현재'})` : '';
      return `${base}${m}${r}`.trim();
    }
    return '';
  })();

  const targetIndicator = useMemo(() => {
    if (mode !== 'indicator') return null;
    const t = (node.comparison as any).targetIndicatorId;
    return allNodes.find((n) => n.id === t) ?? null;
  }, [mode, node.comparison, allNodes]);

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
            return onChange({ kind: 'indicator', comparator: 'over', targetIndicatorId: another?.id ?? node.id } as any);
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
                      {labelOf(n.indicator.type)}
                    </option>
                  ))}
              </select>
              {(() => {
                const t = targetIndicator;
                if (!t) return null;
                if (t.indicator.type === 'bollinger') {
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
                if (t.indicator.type === 'macd') {
                  return (
                    <select
                      value={(node.comparison as any).metric ?? 'macd'}
                      onChange={(e) => onChange({ ...(node.comparison as any), metric: e.target.value })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                    >
                      <option value="macd">MACD</option>
                      <option value="signal">Signal</option>
                      <option value="histogram">Histogram</option>
                    </select>
                  );
                }
                if (t.indicator.type === 'dmi') {
                  return (
                    <select
                      value={(node.comparison as any).metric ?? 'adx'}
                      onChange={(e) => onChange({ ...(node.comparison as any), metric: e.target.value })}
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                    >
                      <option value="diplus">DI+</option>
                      <option value="diminus">DI-</option>
                      <option value="adx">ADX</option>
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
            해석: <strong className="text-zinc-200">{lhsLabel}</strong> {comparator === 'over' ? '>' : '<'}{' '}
            <strong className="text-zinc-200">{rhsLabel}</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function labelOf(key: string) {
  const map: Record<string, string> = { bollinger: '볼린저 밴드', ma: '이동평균선', rsi: 'RSI', dmi: 'DMI / ADX', macd: 'MACD' };
  return map[key] ?? key.toUpperCase();
}
