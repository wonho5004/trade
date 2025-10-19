// Lightweight engine Web Worker bootstrap (no external deps)
// NOTE: Must be used in browser only.

import type { IndicatorConditions, PositionDirection } from '@/types/trading/auto-trading';
import type { EvaluationContext } from './conditions';
import { evaluateConditions } from './conditions';

type EvaluateMessage = {
  type: 'evaluate';
  correlationId?: string;
  payload: {
    conditions: IndicatorConditions;
    context: EvaluationContext;
    indicatorSignals?: Record<string, boolean>;
  };
};

type ResultMessage = {
  type: 'result';
  correlationId?: string;
  ok: boolean;
  value: boolean;
};

const workerSource = () => {
  // In-worker copy: minimalist evaluator (stringified at runtime)
  const cmp = (l: number, op: 'over' | 'under' | 'eq' | 'lte' | 'gte', r: number) => {
    if (!Number.isFinite(l) || !Number.isFinite(r)) return false;
    switch (op) {
      case 'over':
        return l > r;
      case 'under':
        return l < r;
      case 'eq':
        return Math.abs(l - r) < 1e-12;
      case 'lte':
        return l <= r;
      case 'gte':
        return l >= r;
      default:
        return false;
    }
  };
  const evalStatus = (node: any, ctx: any) => {
    const { metric, comparator, value, unit } = node;
    if (!comparator || comparator === 'none') return false;
    if (metric === 'profitRate') {
      const v = Number(ctx.profitRatePct ?? NaN);
      if (unit && unit !== 'percent') return false;
      return cmp(v, comparator, value);
    }
    if (metric === 'margin') {
      const cur = ctx.margin;
      if (!cur) return false;
      if (unit && cur.asset !== unit) return false;
      return cmp(cur.value ?? NaN, comparator, value);
    }
    if (metric === 'buyCount') {
      const v = Number(ctx.buyCount ?? NaN);
      return cmp(v, comparator, value);
    }
    if (metric === 'entryAge') {
      const v = Number(ctx.entryAgeDays ?? NaN);
      return cmp(v, comparator, value);
    }
    return false;
  };
  const evalCandle = (node: any, ctx: any) => {
    const c = node.candle;
    if (!c?.enabled) return false;
    const target = c.reference === 'previous' ? ctx.candlePrevious : ctx.candleCurrent;
    if (!target) return false;
    const value = target[c.field];
    const op = c.comparator && c.comparator !== 'none' ? c.comparator : 'over';
    return cmp(value, op, c.targetValue);
  };
  const evalIndicator = (node: any, signals: any) => !!signals && !!signals[node.id];
  const evalNode = (node: any, ctx: any, signals: any): boolean => {
    if (node.kind === 'group') {
      const op = node.operator || 'and';
      if (op === 'and') return node.children.every((c: any) => evalNode(c, ctx, signals));
      return node.children.some((c: any) => evalNode(c, ctx, signals));
    }
    if (node.kind === 'indicator') return evalIndicator(node, signals);
    if (node.kind === 'status') return evalStatus(node, ctx);
    if (node.kind === 'candle') return evalCandle(node, ctx);
    return false;
  };
  self.onmessage = (ev: MessageEvent) => {
    const msg = ev.data as EvaluateMessage;
    if (!msg || msg.type !== 'evaluate') return;
    try {
      const { conditions, context, indicatorSignals } = msg.payload;
      const root = (conditions as any)?.root;
      const ok = !!root && typeof root === 'object';
      const value = ok ? evalNode(root, context, indicatorSignals) : false;
      const res: ResultMessage = { type: 'result', correlationId: msg.correlationId, ok, value };
      (self as any).postMessage(res);
    } catch (e) {
      const res: ResultMessage = { type: 'result', correlationId: msg.correlationId, ok: false, value: false };
      (self as any).postMessage(res);
    }
  };
};

export type EngineWorker = {
  evaluate: (args: { conditions: IndicatorConditions; context: EvaluationContext; indicatorSignals?: Record<string, boolean> }) => Promise<boolean>;
  cancel: () => void; // terminate in-flight computation by resetting worker
  terminate: () => void;
};

export function createEngineWorker(): EngineWorker {
  if (typeof window === 'undefined') {
    throw new Error('Engine worker must be created in browser context');
  }

  let url: string | null = null;
  let worker: Worker | null = null;

  const spawn = () => {
    if (worker) return;
    const src = `(${workerSource.toString()})()`;
    const blob = new Blob([src], { type: 'application/javascript' });
    url = URL.createObjectURL(blob);
    worker = new Worker(url, { type: 'classic' });
  };

  const cleanup = () => {
    try {
      worker?.terminate();
    } catch {}
    if (url) URL.revokeObjectURL(url);
    worker = null;
    url = null;
  };

  const evaluate = (args: { conditions: IndicatorConditions; context: EvaluationContext; indicatorSignals?: Record<string, boolean> }) => {
    spawn();
    const w = worker!;
    const correlationId = Math.random().toString(36).slice(2);
    return new Promise<boolean>((resolve) => {
      const onMessage = (ev: MessageEvent) => {
        const msg = ev.data as ResultMessage;
        if (!msg || msg.type !== 'result' || msg.correlationId !== correlationId) return;
        w.removeEventListener('message', onMessage as any);
        resolve(!!msg.value && !!msg.ok);
      };
      w.addEventListener('message', onMessage as any);
      const payload: EvaluateMessage = { type: 'evaluate', correlationId, payload: { ...args } };
      try {
        w.postMessage(payload);
      } catch {
        // if posting failed due to a bad worker state, reset and resolve false
        w.removeEventListener('message', onMessage as any);
        resolve(false);
      }
    });
  };

  const cancel = () => {
    // Hard cancel: terminate current worker and respawn lazily on next evaluate
    cleanup();
  };

  return {
    evaluate,
    cancel,
    terminate: cleanup
  };
}
