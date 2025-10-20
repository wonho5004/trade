'use client';

import { useMemo, useState } from 'react';

import type { ConditionGroupNode, ConditionNode, IndicatorConditions, IndicatorLeafNode, StatusLeafNode } from '@/types/trading/auto-trading';
import { createIndicatorGroup, normalizeConditionTree } from '@/lib/trading/autoTradingDefaults';
import { collectGroupNodes, collectIndicatorNodes, ensureGroup, insertChild, removeNode } from '@/lib/trading/conditionsTree';
import { IndicatorEditModal } from './IndicatorEditModal';
import { normalizeSymbol as normalizePreviewSymbol } from '@/lib/trading/symbols';
import { useSymbolValidation } from '@/hooks/useSymbolValidation';
import { PreviewLauncher } from './PreviewLauncher';
import { GroupEditModal } from './GroupEditModal';

export function GroupListPanel({
  value,
  onChange,
  preview,
  groupPreviewInModal = true
}: {
  value: IndicatorConditions;
  onChange: (next: IndicatorConditions) => void;
  preview?: { symbol: string; symbolInput?: string; onSymbolChange?: (v: string) => void; quote?: 'USDT' | 'USDC'; datalistOptions?: string[]; interval: any; direction: 'long' | 'short'; indicatorSignals?: Record<string, boolean>; assumeSignalsOn?: boolean; onToggle?: (v: boolean) => void; onQuoteChange?: (q: 'USDT' | 'USDC') => void };
  groupPreviewInModal?: boolean;
}) {
  const [indicatorModal, setIndicatorModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [previewEnabled, setPreviewEnabled] = useState(false);

  const root = value.root as unknown as ConditionGroupNode;
  const baseGroups = useMemo(
    () => (root.kind === 'group' ? (root.children.filter((c) => c.kind === 'group') as ConditionGroupNode[]) : []),
    [root]
  );
  const directIndicators = useMemo(
    () => (root.kind === 'group' ? root.children.filter((c) => c.kind === 'indicator') : []),
    [root]
  );
  const isFallbackGroup = baseGroups.length === 0 && directIndicators.length > 0;
  const groups = isFallbackGroup ? [root] : baseGroups;
  const symValid = useSymbolValidation(preview ? (preview.symbolInput || preview.symbol) : '', (preview?.quote ?? 'USDT') as any);

  const addGroup = () => {
    const nextRoot: ConditionGroupNode = {
      ...root,
      operator: 'or',
      children: [...root.children, createIndicatorGroup('and', [])]
    };
    onChange({ root: normalizeConditionTree(nextRoot) } as any);
  };

  const removeGroup = (groupId: string) => {
    const next = ensureGroup(removeNode(root as unknown as ConditionNode, groupId) ?? (root as unknown as ConditionNode));
    onChange({ root: normalizeConditionTree(next) } as any);
  };

  const removeIndicator = (id: string) => {
    const next = ensureGroup(removeNode(root as unknown as ConditionNode, id) ?? (root as unknown as ConditionNode));
    onChange({ root: normalizeConditionTree(next) } as any);
  };

  const fmt = (n: any) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n);
    const s = v.toFixed(4);
    return s.replace(/0+$/, '').replace(/\.$/, '');
  };
  const labelOf = (type: string) => ({ bollinger: '볼린저 밴드', ma: '이동평균선', rsi: 'RSI', dmi: 'DMI/ADX', macd: 'MACD' } as Record<string, string>)[type] ?? type;
  const indicatorLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    try {
      collectIndicatorNodes(root as unknown as ConditionNode).forEach((n) => {
        map[n.id] = labelOf((n as any).indicator?.type ?? '');
      });
    } catch {}
    return map;
  }, [root]);

  const summary = (node: IndicatorLeafNode) => {
    const type = node.indicator.type;
    const config: any = node.indicator.config;
    const parts: string[] = [];
    if (type === 'ma') {
      if (config.period != null) parts.push(`period ${config.period}`);
      if (Array.isArray(config.actions) && config.actions.length > 0) parts.push(config.actions.join(','));
    } else if (type === 'bollinger') {
      if (config.length != null) parts.push(`len ${config.length}`);
      if (config.standardDeviation != null) parts.push(`${config.standardDeviation}σ`);
      if (config.band) parts.push(config.band);
    } else if (type === 'rsi') {
      if (config.period != null) parts.push(`period ${config.period}`);
      if (config.smoothing) parts.push(String(config.smoothing).toUpperCase());
      if (typeof config.threshold === 'number') parts.push(`th ${config.threshold}`);
      if (Array.isArray(config.actions) && config.actions.length > 0) parts.push(config.actions.join(','));
    } else if (type === 'dmi') {
      if (config.diPeriod != null) parts.push(`DI ${config.diPeriod}`);
      if (config.adxPeriod != null) parts.push(`ADX ${config.adxPeriod}`);
      if (config.diComparison) parts.push(config.diComparison);
      if (config.adxVsDi) parts.push(config.adxVsDi);
    } else if (type === 'macd') {
      const fast = config.fast ?? '-';
      const slow = config.slow ?? '-';
      const signal = config.signal ?? '-';
      parts.push(`(${fast},${slow},${signal})`);
      if (config.method) parts.push(config.method);
      if (config.comparison) parts.push(config.comparison);
      if (config.histogramAction) parts.push(`hist ${config.histogramAction}`);
    }
    const cmp = node.comparison as any;
    if (cmp?.kind === 'candle') parts.push(`cmp: candle ${String(cmp.field).toUpperCase()}(${cmp.reference}) ${cmp.comparator}`);
    if (cmp?.kind === 'value') parts.push(`cmp: ${cmp.comparator} ${fmt(cmp.value)}`);
    if (cmp?.kind === 'indicator') {
      const m = cmp.metric ? ` ${cmp.metric}` : '';
      const r = cmp.reference ? `(${cmp.reference})` : '';
      const tLabel = indicatorLabelMap[cmp.targetIndicatorId] ?? '다른 지표';
      parts.push(`cmp: ${tLabel}${m}${r} ${cmp.comparator}`.trim());
    }
    return parts.join(' · ');
  };

  const collectStatusNodes = (node: ConditionNode, acc: StatusLeafNode[] = []): StatusLeafNode[] => {
    if ((node as any).kind === 'status') {
      acc.push(node as any);
      return acc;
    }
    if ((node as any).kind === 'group') {
      (node as any).children.forEach((c: any) => collectStatusNodes(c, acc));
    }
    return acc;
  };

  const statusSummary = (s: StatusLeafNode) => {
    const label = s.metric === 'profitRate' ? '수익률' : s.metric === 'margin' ? '마진' : s.metric === 'buyCount' ? '매수횟수' : '진입경과';
    const unit = s.unit ? ` ${s.unit}` : '';
    return `${label} ${s.comparator} ${s.value}${unit}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300">조건 그룹</span>
          <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">그룹 간 OR(고정)</span>
          {preview ? (
            <PreviewLauncher
              conditions={value}
              symbol={preview.symbol}
              interval={preview.interval}
              direction={preview.direction}
              indicatorSignals={undefined}
            />
          ) : null}
          <button type="button" onClick={addGroup} className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-200">
            조건 그룹 추가
          </button>
        </div>
        <div className="flex items-center gap-2" />
      </div>

      {groups.length === 0 ? (
        <div className="text-[11px] text-zinc-500">그룹이 없습니다. ‘조건 그룹 추가’를 눌러 새 그룹을 만드세요.</div>
      ) : null}

      <div className="space-y-3">
        {groups.map((g, idx) => {
          const indicators = collectIndicatorNodes(g);
          const disableRemove = isFallbackGroup && g.id === root.id;
          return (
            <div key={g.id} className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300">조건 그룹 {idx + 1}</span>
                  <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">그룹 내 AND(고정)</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setGroupModal({ open: true, id: g.id })}
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300"
                  >
                    그룹 편집
                  </button>
                  <button
                    type="button"
                    onClick={() => removeGroup(g.id)}
                    disabled={disableRemove}
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-rose-300"
                  >
                    그룹 삭제
                  </button>
                </div>
              </div>

              {(() => {
                const statuses = collectStatusNodes(g as any);
                const hasAny = indicators.length > 0 || statuses.length > 0;
                if (!hasAny) return <div className="text-[11px] text-zinc-500">지표/상태 조건이 없습니다. ‘그룹 편집’에서 추가하세요.</div>;
                return (
                  <ul className="space-y-1">
                    {indicators.map((n) => (
                      <li key={n.id} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/40 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-zinc-400">{summary(n)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setIndicatorModal({ open: true, id: n.id })}
                            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300"
                          >
                            지표 편집
                          </button>
                          <button
                            type="button"
                            onClick={() => removeIndicator(n.id)}
                            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-rose-300"
                          >
                            삭제
                          </button>
                        </div>
                      </li>
                    ))}
                    {statuses.map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/40 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-[11px] text-zinc-400">상태 · {statusSummary(s)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          );
        })}
      </div>

      <IndicatorEditModal
        open={indicatorModal.open}
        title="지표 편집"
        conditions={value}
        indicatorId={indicatorModal.id ?? ''}
        onChange={onChange}
        onClose={() => setIndicatorModal({ open: false, id: null })}
      />
      <GroupEditModal
        open={groupModal.open}
        title="그룹 편집"
        conditions={value}
        groupId={groupModal.id ?? ''}
        onChange={onChange}
        onClose={() => setGroupModal({ open: false, id: null })}
        preview={groupPreviewInModal && preview ? {
          symbol: preview.symbol,
          symbolInput: preview.symbolInput,
          onSymbolChange: preview.onSymbolChange,
          quote: preview.quote,
          interval: preview.interval,
          direction: preview.direction,
          indicatorSignals: preview.indicatorSignals,
          assumeSignalsOn: preview.assumeSignalsOn,
          onToggle: preview.onToggle
        } : undefined}
      />
    </div>
  );
}
