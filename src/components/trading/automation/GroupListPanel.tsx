'use client';

import { useMemo, useState } from 'react';

import type { ConditionGroupNode, ConditionNode, IndicatorConditions, IndicatorLeafNode } from '@/types/trading/auto-trading';
import { createIndicatorGroup, normalizeConditionTree } from '@/lib/trading/autoTradingDefaults';
import { collectGroupNodes, collectIndicatorNodes, ensureGroup, insertChild, removeNode } from '@/lib/trading/conditionsTree';
import { IndicatorEditModal } from './IndicatorEditModal';
import { GroupEditModal } from './GroupEditModal';

export function GroupListPanel({
  value,
  onChange
}: {
  value: IndicatorConditions;
  onChange: (next: IndicatorConditions) => void;
}) {
  const [indicatorModal, setIndicatorModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [groupModal, setGroupModal] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

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
    if (cmp?.kind === 'value') parts.push(`cmp: ${cmp.comparator} ${cmp.value}`);
    if (cmp?.kind === 'indicator') {
      const m = cmp.metric ? ` ${cmp.metric}` : '';
      const r = cmp.reference ? `(${cmp.reference})` : '';
      parts.push(`cmp: other${m}${r} ${cmp.comparator}`.trim());
    }
    return parts.join(' · ');
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300">조건 그룹</span>
          <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">그룹 간 OR(고정)</span>
        </div>
        <button type="button" onClick={addGroup} className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-200">
          조건 그룹 추가
        </button>
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

              {indicators.length === 0 ? (
                <div className="text-[11px] text-zinc-500">지표가 없습니다. ‘그룹 편집’에서 지표를 추가하세요.</div>
              ) : (
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
                </ul>
              )}
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
      />
    </div>
  );
}
