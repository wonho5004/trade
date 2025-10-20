"use client";

import { evaluateWithTrace, toExecutablePlan } from '@/lib/trading/engine/conditions';
import { buildIndicatorNumericSeries } from '@/lib/trading/engine/indicatorSignals';
import { buildActionIntents } from '@/lib/trading/engine/actions';
import type { IndicatorConditions, ConditionNode, IndicatorLeafNode } from '@/types/trading/auto-trading';
import type { EvaluationContext } from '@/lib/trading/engine/conditions';

export function ConditionsTrace({
  conditions,
  context,
  indicatorSignals,
  seriesTail
}: {
  conditions: IndicatorConditions | undefined;
  context: EvaluationContext;
  indicatorSignals?: Record<string, boolean>;
  seriesTail?: { closes: number[]; highs: number[]; lows: number[] };
}) {
  if (!conditions) return null;
  const fmt = (n: any) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return String(n);
    const s = v.toFixed(4);
    return s.replace(/0+$/, '').replace(/\.$/, '');
  };
  const { result, trace } = evaluateWithTrace(conditions, context, { indicatorSignals });
  const plan = toExecutablePlan(conditions);
  const actionsPreview = (() => {
    try {
      if (!seriesTail) return [] as any[];
      const numericSeries = buildIndicatorNumericSeries(conditions, seriesTail);
      return buildActionIntents(conditions, context, indicatorSignals ?? {}, numericSeries);
    } catch {
      return [] as any[];
    }
  })();
  const indicatorMap = collectIndicatorMap((conditions.root as unknown) as ConditionNode);
  const indicatorLabel = (type: string) => {
    const map: Record<string, string> = { bollinger: '볼린저 밴드', ma: '이동평균선', rsi: 'RSI', dmi: 'DMI/ADX', macd: 'MACD' };
    return map[type] ?? type;
  };

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px]">
      <div className="flex items-center gap-2">
        <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">세부 결과</span>
        <span className={`rounded px-2 py-0.5 ${result ? 'border border-emerald-500/60 text-emerald-200' : 'border border-zinc-700 text-zinc-300'}`}>{result ? '충족' : '불충족'}</span>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <p className="mb-1 text-zinc-400">지표</p>
          {plan.indicators.length === 0 ? (
            <p className="text-zinc-500">없음</p>
          ) : (
            <ul className="space-y-1">
              {plan.indicators.map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                  <span className="truncate text-zinc-300">
                    {indicatorLabel(i.type)}
                    {(() => {
                      const leaf = indicatorMap[i.id];
                      if (!leaf) return null;
                      const cmp: any = leaf.comparison;
                      if (!cmp || cmp.kind === 'none') return null;
                      if (cmp.kind === 'candle') return <span className="text-zinc-500"> · cmp candle {String(cmp.field).toUpperCase()}({cmp.reference}) {cmp.comparator}</span>;
                      if (cmp.kind === 'value') return <span className="text-zinc-500"> · cmp {cmp.comparator} {cmp.value}</span>;
                      if (cmp.kind === 'indicator') {
                        const target = indicatorMap[cmp.targetIndicatorId];
                        const tLabel = target ? indicatorLabel(target.indicator.type) : '다른 지표';
                        const metric = cmp.metric ? ` ${cmp.metric}` : '';
                        const ref = cmp.reference ? `(${cmp.reference})` : '';
                        return <span className="text-zinc-500"> · cmp {tLabel}{metric}{ref} {cmp.comparator}</span>;
                      }
                      return null;
                    })()}
                  </span>
                  <span className={`ml-2 inline-flex h-2 w-2 rounded-full ${trace[i.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-zinc-400">상태</p>
          {plan.statuses.length === 0 ? (
            <p className="text-zinc-500">없음</p>
          ) : (
            <ul className="space-y-1">
              {plan.statuses.map((s) => (
                <li key={s.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                  <span className="truncate text-zinc-300">{s.metric} {s.comparator} {fmt(s.value)}{s.unit ? ` ${s.unit === 'percent' ? '%' : s.unit}` : ''}</span>
                  <span className={`ml-2 inline-flex h-2 w-2 rounded-full ${trace[s.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <p className="mb-1 text-zinc-400">캔들</p>
          {plan.candles.length === 0 ? (
            <p className="text-zinc-500">없음</p>
          ) : (
            <ul className="space-y-1">
              {plan.candles.map((c) => {
                const live = c.reference === 'previous' ? (context.candlePrevious as any) : (context.candleCurrent as any);
                const cur = live ? Number(live?.[c.field as any]) : null;
                return (
                  <li key={c.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                    <span className="truncate text-zinc-300">
                      {String(c.field).toUpperCase()} {c.comparator} {fmt(c.value)} ({c.reference})
                      {cur != null ? <span className="text-zinc-500"> · now {fmt(cur)}</span> : null}
                    </span>
                    <span className={`ml-2 inline-flex h-2 w-2 rounded-full ${trace[c.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <p className="mb-1 text-zinc-400">그룹</p>
          {plan.groups.length === 0 ? (
            <p className="text-zinc-500">없음</p>
          ) : (
            <ul className="space-y-1">
              {plan.groups.map((g) => (
                <li key={g.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                  <span className="truncate text-zinc-300">{g.operator.toUpperCase()} · {g.id}</span>
                  <span className={`ml-2 inline-flex h-2 w-2 rounded-full ${trace[g.id] ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {/* Actions preview */}
      <div>
        <p className="mb-1 text-zinc-400">액션(프리뷰)</p>
        {actionsPreview.length === 0 ? (
          <p className="text-zinc-500">없음</p>
        ) : (
          <ul className="space-y-1">
            {actionsPreview.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                <span className="truncate text-zinc-300">
                  {a.kind.toUpperCase()} · {a.orderType || 'n/a'}
                  {a.price != null ? <span className="text-zinc-500"> · 가격 {fmt(a.price)}</span> : null}
                  {a.amount?.mode ? (
                    <span className="text-zinc-500"> · 금액 {a.amount.mode}{a.amount.value != null ? ` ${fmt(a.amount.value)}${a.amount.mode.includes('percent') ? '%' : ''}` : ''}</span>
                  ) : null}
                </span>
                <span className="text-[10px] text-zinc-500">그룹 {a.groupId}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function collectIndicatorMap(root: ConditionNode): Record<string, IndicatorLeafNode> {
  const map: Record<string, IndicatorLeafNode> = {};
  const walk = (n: ConditionNode) => {
    if ((n as any).kind === 'indicator') {
      const leaf = n as IndicatorLeafNode;
      map[leaf.id] = leaf;
      return;
    }
    if ((n as any).kind === 'group') (n as any).children.forEach((c: any) => walk(c as any));
  };
  walk(root);
  return map;
}
