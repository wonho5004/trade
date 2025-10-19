"use client";

import { useMemo, useState } from 'react';

import type { IndicatorConditions, PositionDirection } from '@/types/trading/auto-trading';
import type { IntervalOption } from '@/types/chart';
import { useConditionsEvaluator } from '@/hooks/useConditionsEvaluator';
import { intervalToMs } from '@/types/chart';
import { ConditionsTrace } from './ConditionsTrace';

export function ConditionsPreview({
  conditions,
  symbol,
  interval,
  direction = 'long',
  indicatorSignals,
  overrides
}: {
  conditions: IndicatorConditions | undefined;
  symbol: string;
  interval: IntervalOption;
  direction?: PositionDirection;
  indicatorSignals?: Record<string, boolean>;
  overrides?: Partial<ReturnType<typeof mapOverrides>>;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<{ profitRatePct?: number; marginUSDT?: number; marginUSDC?: number; buyCount?: number; entryAgeDays?: number }>(overrides ?? {});
  const mappedOverrides = useMemo(() => mapOverrides(overrides), [overrides]);
  const { match, ready, lastEvaluatedAt, error, context, extras } = useConditionsEvaluator({
    conditions,
    symbol,
    interval,
    direction,
    indicatorSignals,
    overrides: mapOverrides(localOverrides)
  });

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${match ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <span className="text-zinc-400">프리뷰</span>
        <span className="text-zinc-200">{match ? '충족' : ready ? '불충족' : '대기'}</span>
        {lastEvaluatedAt ? <span className="text-zinc-500 hidden sm:inline">· {new Date(lastEvaluatedAt).toLocaleTimeString()}</span> : null}
        {extras?.metrics ? (
          <span className="text-zinc-500 hidden md:inline">· 평가 {extras.metrics.lastMs.toFixed(1)}ms (평균 {extras.metrics.avgMs.toFixed(1)}ms)</span>
        ) : null}
        {error ? <span className="text-rose-400">· {error}</span> : null}
        <button type="button" onClick={() => setShowDetails((v) => !v)} className="ml-auto rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
          {showDetails ? '간단히' : '자세히'}
        </button>
      </div>
      {/* 캔들 요약: OHLC/거래량/시간 */}
      {context?.candleCurrent ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-zinc-400">
          <span className="text-zinc-500">캔들</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">O {context.candleCurrent.open.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">H {context.candleCurrent.high.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">L {context.candleCurrent.low.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">C {context.candleCurrent.close.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300 hidden sm:inline">VOL {Math.round(context.candleCurrent.volume).toLocaleString()}</span>
          {(() => {
            const ts = context.candleCurrent!.timestamp;
            const openAt = new Date(ts);
            const closeAt = new Date(ts + (intervalToMs as any)[interval]);
            return <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-500 hidden md:inline">{openAt.toLocaleTimeString()}~{closeAt.toLocaleTimeString()}</span>;
          })()}
          {context.candlePrevious ? (
            (() => {
              const prev = context.candlePrevious!.close;
              const cur = context.candleCurrent!.close;
              const pct = prev ? ((cur - prev) / prev) * 100 : 0;
              const cls = pct > 0 ? 'text-emerald-300' : pct < 0 ? 'text-rose-300' : 'text-zinc-300';
              return <span className={`rounded border border-zinc-700 px-1 py-0.5 ${cls}`}>전봉대비 {pct.toFixed(2)}%</span>;
            })()
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-zinc-400">
        <span>상태 가정값</span>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">수익률%</span>
          <input type="number" value={localOverrides.profitRatePct ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, profitRatePct: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-16 sm:w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">마진USDT</span>
          <input type="number" value={localOverrides.marginUSDT ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, marginUSDT: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-20 sm:w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">매수횟수</span>
          <input type="number" value={localOverrides.buyCount ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, buyCount: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-16 sm:w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">경과일</span>
          <input type="number" value={localOverrides.entryAgeDays ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, entryAgeDays: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-16 sm:w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
      </div>
      {extras?.dmi ? (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          <span className="text-zinc-500">DMI</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">DI+ {extras.dmi.diPlus.toFixed(1)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">DI- {extras.dmi.diMinus.toFixed(1)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">ADX {extras.dmi.adx.toFixed(1)}</span>
        </div>
      ) : null}
      {showDetails && context ? (
        <ConditionsTrace conditions={conditions} context={context} indicatorSignals={indicatorSignals} />
      ) : null}
    </div>
  );
}

function mapOverrides(src?: Partial<{ profitRatePct: number; marginUSDT: number; marginUSDC: number; buyCount: number; entryAgeDays: number }>) {
  if (!src) return {} as any;
  const margin =
    typeof src.marginUSDT === 'number'
      ? ({ asset: 'USDT', value: src.marginUSDT } as const)
      : typeof src.marginUSDC === 'number'
      ? ({ asset: 'USDC', value: src.marginUSDC } as const)
      : undefined;
  return {
    profitRatePct: src.profitRatePct,
    margin,
    buyCount: src.buyCount,
    entryAgeDays: src.entryAgeDays
  };
}
