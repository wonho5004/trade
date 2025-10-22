"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IndicatorConditions, PositionDirection } from '@/types/trading/auto-trading';
import type { IntervalOption, Candle } from '@/types/chart';
import { subscribeKline, type KlineUpdate, fetchFuturesCandles } from '@/lib/trading/realtime';
import { evaluateConditions, type EvaluationContext } from '@/lib/trading/engine/conditions';
import { createEngineWorker, type EngineWorker } from '@/lib/trading/engine/worker';
import { buildIndicatorSignalsFromSeries, buildIndicatorSignals, computeDmiSnapshot, requiredLookback } from '@/lib/trading/engine/indicatorSignals';
import { collectIndicatorNodes } from '@/lib/trading/conditionsTree';

export type UseConditionsEvaluatorArgs = {
  conditions: IndicatorConditions | undefined;
  symbol: string; // e.g., BTCUSDT
  interval: IntervalOption;
  direction: PositionDirection;
  indicatorSignals?: Record<string, boolean>;
  overrides?: Partial<EvaluationContext>;
  enabled?: boolean;
};

export type UseConditionsEvaluatorState = {
  ready: boolean;
  match: boolean;
  lastEvaluatedAt: number | null;
  context: EvaluationContext | null;
  error: string | null;
  extras?: { dmi?: { diPlus: number; diMinus: number; adx: number }; metrics?: { lastMs: number; avgMs: number; count: number }; series?: { closes: number[]; highs: number[]; lows: number[] } };
};

// Engine evaluator hook: subscribes to candles and evaluates conditions via worker (with sync fallback)
export function useConditionsEvaluator(args: UseConditionsEvaluatorArgs): UseConditionsEvaluatorState {
  const { conditions, symbol, interval, direction, indicatorSignals, overrides, enabled = true } = args;
  const [state, setState] = useState<UseConditionsEvaluatorState>({ ready: false, match: false, lastEvaluatedAt: null, context: null, error: null });
  const lastTwoRef = useRef<{ prev: KlineUpdate['candle'] | null; cur: KlineUpdate['candle'] | null }>({ prev: null, cur: null });
  const workerRef = useRef<EngineWorker | null>(null);
  const pendingEvalRef = useRef<number>(0);
  const inflightRef = useRef<boolean>(false);
  const seriesRef = useRef<Candle[]>([] as any);
  const seriesBufRef = useRef<{ closes: number[]; highs: number[]; lows: number[]; cap: number }>({ closes: [], highs: [], lows: [], cap: 0 });
  const signalsCacheRef = useRef<{ condRef: any; lastTs: number | null; len: number; signals?: Record<string, boolean> } | null>(null);
  const throttleTimerRef = useRef<number | null>(null);
  const throttlePendingRef = useRef<boolean>(false);
  const metricsRef = useRef<{ lastMs: number; avgMs: number; count: number }>({ lastMs: 0, avgMs: 0, count: 0 });

  const baseContext = useMemo<EvaluationContext>(() => ({ symbol, direction }), [symbol, direction]);

  const evaluateNow = useCallback(() => {
    if (!enabled || !conditions) return;
    const ctx: EvaluationContext = {
      ...baseContext,
      candleCurrent: lastTwoRef.current.cur ?? undefined,
      candlePrevious: lastTwoRef.current.prev ?? undefined,
      ...(overrides ?? {})
    };
    const myTicket = ++pendingEvalRef.current;
    const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const finish = (value: boolean) => {
      if (pendingEvalRef.current !== myTicket) return;
      inflightRef.current = false;
      const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
      const dt = Math.max(0, t1 - t0);
      metricsRef.current.lastMs = dt;
      const n = metricsRef.current.count;
      metricsRef.current.avgMs = n === 0 ? dt : (metricsRef.current.avgMs * n + dt) / (n + 1);
      metricsRef.current.count = n + 1;
      let dmiExtras: { diPlus: number; diMinus: number; adx: number } | undefined = undefined;
      try {
        const root = (conditions as any)?.root || conditions;
        const dmiNode = collectIndicatorNodes(root).find((n) => (n as any).indicator?.type === 'dmi');
        if (dmiNode) {
          const cfg = (dmiNode as any).indicator?.config || {};
          const diP = Math.max(2, Number(cfg?.diPeriod) || 14);
          const adxP = Math.max(2, Number(cfg?.adxPeriod) || 14);
          const lookback = Math.max(50, diP + adxP + 5);
          const snap = computeDmiSnapshot(seriesRef.current.slice(-lookback), diP, adxP);
          if (snap) dmiExtras = snap;
        }
      } catch {}
      setState({
        ready: true,
        match: value,
        lastEvaluatedAt: Date.now(),
        context: ctx,
        error: null,
        extras: {
          ...(dmiExtras ? { dmi: dmiExtras } : {}),
          metrics: { ...metricsRef.current },
          series: { closes: seriesBufRef.current.closes.slice(), highs: seriesBufRef.current.highs.slice(), lows: seriesBufRef.current.lows.slice() }
        }
      });
    };
    try {
      const w = workerRef.current;
      if (w && inflightRef.current) {
        try { w.cancel(); } catch {}
      }
      let computedSignals = indicatorSignals;
      const last = seriesRef.current[seriesRef.current.length - 1];
      const lastTs = last?.timestamp ?? null;
      if (!computedSignals) {
        const cache = signalsCacheRef.current;
        const needRebuild = !cache || cache.condRef !== conditions || cache.len !== seriesRef.current.length || cache.lastTs !== lastTs;
        const lookback = requiredLookback(conditions);
        const buf = seriesBufRef.current;
        if (buf.cap !== lookback) {
          const tail = seriesRef.current.slice(-lookback);
          seriesBufRef.current = { closes: tail.map((c) => c.close), highs: tail.map((c) => c.high), lows: tail.map((c) => c.low), cap: lookback };
        }
        if (needRebuild) {
          const series = seriesBufRef.current;
          computedSignals = conditions ? buildIndicatorSignalsFromSeries(conditions, series) : undefined;
          signalsCacheRef.current = { condRef: conditions, len: seriesRef.current.length, lastTs, signals: computedSignals };
        } else {
          computedSignals = cache?.signals;
        }
      }
      inflightRef.current = true;
      if (w) {
        w.evaluate({ conditions, context: ctx, indicatorSignals: computedSignals })
          .then(finish)
          .catch((e) => {
            inflightRef.current = false;
            setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
          });
      } else {
        const v = evaluateConditions(conditions, ctx, { indicatorSignals: computedSignals });
        finish(v);
      }
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    }
  }, [enabled, conditions, baseContext, overrides, indicatorSignals]);

  const triggerEvaluate = useCallback(() => {
    if (throttleTimerRef.current != null) {
      throttlePendingRef.current = true;
      return;
    }
    throttleTimerRef.current = window.setTimeout(() => {
      throttleTimerRef.current && window.clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
      const pending = throttlePendingRef.current;
      throttlePendingRef.current = false;
      evaluateNow();
      if (pending) {
        triggerEvaluate();
      }
    }, 150);
  }, [evaluateNow]);

  useEffect(() => {
    if (!enabled) return;
    // init worker lazily in browser
    if (typeof window === 'undefined') return;
    try {
      workerRef.current = createEngineWorker();
    } catch {
      workerRef.current = null; // fallback to sync
    }
    return () => {
      try {
        workerRef.current?.terminate();
      } catch {}
      workerRef.current = null;
    };
  }, [enabled]);

  // subscribe kline
  useEffect(() => {
    if (!enabled) return;
    if (!symbol || !interval) return;
    let unsubscribe: (() => void) | null = null;
    let cancelled = false;
    // prime series
    (async () => {
      try {
        const base = await fetchFuturesCandles(symbol, interval, 200);
        if (!cancelled) {
          seriesRef.current = base.slice();
          // reset series buffer; cap will be set on first evaluate
          seriesBufRef.current = { closes: [], highs: [], lows: [], cap: 0 };
        }
      } catch (e) {
        // ignore
      }
    })();
    try {
      unsubscribe = subscribeKline(symbol, interval, (update) => {
        lastTwoRef.current = { prev: lastTwoRef.current.cur, cur: update.candle };
        // update rolling full series
        const arr = seriesRef.current;
        if (arr.length === 0 || arr[arr.length - 1].timestamp !== update.candle.timestamp) {
          arr.push(update.candle);
          if (arr.length > 1200) arr.shift();
        } else {
          arr[arr.length - 1] = update.candle;
        }
        // update tail buffer with current cap if configured
        const cap = seriesBufRef.current.cap;
        if (cap > 0) {
          const buf = seriesBufRef.current;
          const append = (arrVals: number[], v: number) => {
            if (arrVals.length === 0 || arrVals.length < cap) arrVals.push(v);
            else arrVals[arrVals.length - 1] = v;
          };
          const replaceLast = (arrVals: number[], v: number) => {
            if (arrVals.length === 0) arrVals.push(v);
            else arrVals[arrVals.length - 1] = v;
          };
          const lastTs = arr[arr.length - 1]?.timestamp;
          const prevTs = arr.length > 1 ? arr[arr.length - 2]?.timestamp : null;
          const justReplaced = update.candle.timestamp === lastTs && prevTs !== lastTs; // same-bar update
          if (justReplaced) {
            replaceLast(buf.closes, update.candle.close);
            replaceLast(buf.highs, update.candle.high);
            replaceLast(buf.lows, update.candle.low);
          } else {
            // new bar appended
            buf.closes.push(update.candle.close);
            buf.highs.push(update.candle.high);
            buf.lows.push(update.candle.low);
            if (buf.closes.length > cap) {
              buf.closes.shift();
              buf.highs.shift();
              buf.lows.shift();
            }
          }
        }
        triggerEvaluate();
      });
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }));
    }
    return () => {
      try { unsubscribe?.(); } catch {}
      cancelled = true;
    };
  }, [enabled, symbol, interval, triggerEvaluate]);

  // re-evaluate when inputs change
  useEffect(() => {
    if (!enabled) return;
    triggerEvaluate();
  }, [enabled, conditions, direction, indicatorSignals, overrides, triggerEvaluate]);

  // (legacy inlined functions removed; using useCallback versions above)

  return state;
}
