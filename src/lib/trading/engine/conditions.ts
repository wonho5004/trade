import type {
  AggregatorOperator,
  CandleLeafNode,
  ConditionGroupNode,
  ConditionNode,
  IndicatorConditions,
  IndicatorLeafNode,
  StatusLeafNode,
  StatusMetric,
  StatusUnit,
  PositionDirection
} from '@/types/trading/auto-trading';
import type { ActionLeafNode, BuyOrderConfig, SellOrderConfig, StopLossConfig } from '@/types/trading/auto-trading';
import type { Candle } from '@/types/chart';

export type IndicatorSignalMap = Record<string, boolean>;

export type EvaluationContext = {
  symbol: string;
  direction: PositionDirection;
  // Runtime status metrics
  profitRatePct?: number; // e.g., 3.2 (현재 수익률 %)
  margin?: { asset: 'USDT' | 'USDC'; value: number }; // 현재 마진 금액
  buyCount?: number; // 매수 횟수
  entryAgeDays?: number; // 포지션 진입 후 경과 시간 (days, fractional ok)
  entryAgeHours?: number; // 포지션 진입 후 경과 시간 (hours)
  entryAgeMinutes?: number; // 포지션 진입 후 경과 시간 (minutes)
  walletBalance?: { asset: 'USDT' | 'USDC'; value: number }; // 잔고
  initialMarginRatePct?: number; // 초기 마진 대비 현재 마진 비율 (%)
  unrealizedPnl?: { asset: 'USDT' | 'USDC'; value: number }; // 미실현 손익
  positionSize?: { asset: 'USDT' | 'USDC'; value: number }; // 포지션 크기
  candleCurrent?: Candle;
  candlePrevious?: Candle;
};

export type EvaluateOptions = {
  indicatorSignals?: IndicatorSignalMap; // by indicator node id
  now?: number; // reserved
};

const cmp = (left: number, op: 'over' | 'under' | 'eq' | 'lte' | 'gte', right: number): boolean => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  switch (op) {
    case 'over':
      return left > right;
    case 'under':
      return left < right;
    case 'eq':
      return Math.abs(left - right) < 1e-12;
    case 'lte':
      return left <= right;
    case 'gte':
      return left >= right;
    default:
      return false;
  }
};

const evalStatus = (node: StatusLeafNode, ctx: EvaluationContext): boolean => {
  const { metric, comparator, value, unit } = node;
  if (!comparator || comparator === 'none') return false;

  if (metric === 'profitRate') {
    const v = Number(ctx.profitRatePct ?? NaN);
    if (unit && unit !== 'percent') return false;
    const result = cmp(v, comparator, value);
    console.log(`      [Status Eval] profitRate: ${v.toFixed(2)}% ${comparator} ${value}% => ${result ? '✅' : '❌'}`);
    return result;
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
    // 단위에 따라 적절한 컨텍스트 값 사용
    let v: number;
    if (unit === 'minutes') {
      v = Number(ctx.entryAgeMinutes ?? NaN);
    } else if (unit === 'hours') {
      v = Number(ctx.entryAgeHours ?? NaN);
    } else {
      // default to days
      v = Number(ctx.entryAgeDays ?? NaN);
    }
    return cmp(v, comparator, value);
  }

  if (metric === 'walletBalance') {
    const cur = ctx.walletBalance;
    if (!cur) return false;
    if (unit && cur.asset !== unit) return false;
    return cmp(cur.value ?? NaN, comparator, value);
  }

  if (metric === 'initialMarginRate') {
    const v = Number(ctx.initialMarginRatePct ?? NaN);
    if (unit && unit !== 'percent') return false;
    return cmp(v, comparator, value);
  }

  if (metric === 'unrealizedPnl') {
    const cur = ctx.unrealizedPnl;
    if (!cur) return false;
    if (unit && cur.asset !== unit) return false;
    return cmp(cur.value ?? NaN, comparator, value);
  }

  if (metric === 'positionSize') {
    const cur = ctx.positionSize;
    if (!cur) return false;
    if (unit && cur.asset !== unit) return false;
    return cmp(cur.value ?? NaN, comparator, value);
  }

  return false;
};

const evalIndicator = (node: IndicatorLeafNode, signals: IndicatorSignalMap | undefined): boolean => {
  // The engine expects upstream calculator to fill boolean signals per node.id
  if (!signals) return false;
  return !!signals[node.id];
};

const evalCandle = (node: CandleLeafNode, ctx: EvaluationContext): boolean => {
  const c = node.candle;
  if (!c?.enabled) return false;
  const target = c.reference === 'previous' ? ctx.candlePrevious : ctx.candleCurrent;
  if (!target) return false;
  const value = target[c.field];
  const op: 'over' | 'under' | 'eq' | 'lte' | 'gte' =
    c.comparator === 'over' || c.comparator === 'under' || c.comparator === 'eq' || c.comparator === 'lte' || c.comparator === 'gte'
      ? c.comparator
      : 'over';
  return cmp(value, op, c.targetValue);
};

const evalNode = (node: ConditionNode, ctx: EvaluationContext, signals: IndicatorSignalMap | undefined, trace?: Record<string, boolean>): boolean => {
  if (node.kind === 'group') {
    const op: AggregatorOperator = node.operator ?? 'and';
    const res = op === 'and' ? node.children.every((c) => evalNode(c, ctx, signals, trace)) : node.children.some((c) => evalNode(c, ctx, signals, trace));
    if (trace) trace[node.id] = res;
    return res;
  }
  if (node.kind === 'indicator') {
    const v = evalIndicator(node, signals);
    if (trace) trace[node.id] = v;
    return v;
  }
  if (node.kind === 'status') {
    const v = evalStatus(node, ctx);
    if (trace) trace[node.id] = v;
    return v;
  }
  if (node.kind === 'candle') {
    const v = evalCandle(node, ctx);
    if (trace) trace[node.id] = v;
    return v;
  }
  return false;
};

export function evaluateConditions(
  conditions: IndicatorConditions | undefined,
  ctx: EvaluationContext,
  opts: EvaluateOptions = {}
): boolean {
  if (!conditions) return false;
  const root = (conditions.root as unknown) as ConditionNode;
  return evalNode(root, ctx, opts.indicatorSignals);
}

export type EvaluationTrace = Record<string, boolean>;

export function evaluateWithTrace(
  conditions: IndicatorConditions | undefined,
  ctx: EvaluationContext,
  opts: EvaluateOptions = {}
): { result: boolean; trace: EvaluationTrace } {
  const trace: EvaluationTrace = {};
  if (!conditions) return { result: false, trace };
  const root = (conditions.root as unknown) as ConditionNode;
  const result = evalNode(root, ctx, opts.indicatorSignals, trace);
  return { result, trace };
}

export function collectExecutableLeaves(root: ConditionNode): { indicators: IndicatorLeafNode[]; statuses: StatusLeafNode[] } {
  const indicators: IndicatorLeafNode[] = [];
  const statuses: StatusLeafNode[] = [];
  const walk = (n: ConditionNode) => {
    if (n.kind === 'indicator') indicators.push(n);
    else if (n.kind === 'status') statuses.push(n);
    else if (n.kind === 'group') n.children.forEach(walk);
  };
  walk(root);
  return { indicators, statuses };
}

export type ExecutablePlan = {
  indicators: Array<{ id: string; type: string; config: any }>;
  statuses: Array<{ id: string; metric: StatusMetric; comparator: string; value: number; unit?: StatusUnit }>;
  candles: Array<{ id: string; field: string; comparator: string; value: number; reference: string }>;
  groups: Array<{ id: string; operator: AggregatorOperator }>;
  actions: Array<{ id: string; groupId: string; action: BuyOrderConfig | SellOrderConfig | StopLossConfig }>;
  root: ConditionGroupNode;
};

export function toExecutablePlan(conditions: IndicatorConditions): ExecutablePlan {
  const root = (conditions.root as unknown) as ConditionGroupNode;
  const { indicators, statuses } = collectExecutableLeaves(root);
  const candles: CandleLeafNode[] = [];
  const groups: ConditionGroupNode[] = [];
  const actions: Array<{ id: string; groupId: string; action: BuyOrderConfig | SellOrderConfig | StopLossConfig }> = [];
  const groupStack: string[] = [];
  const walk = (n: ConditionNode) => {
    if (n.kind === 'candle') candles.push(n);
    else if (n.kind === 'action') {
      const gid = groupStack[groupStack.length - 1] ?? root.id;
      actions.push({ id: n.id, groupId: gid, action: n.action as any });
    } else if (n.kind === 'group') {
      groups.push(n);
      groupStack.push(n.id);
      n.children.forEach(walk);
      groupStack.pop();
    }
  };
  walk(root);
  return {
    indicators: indicators.map((n) => ({ id: n.id, type: n.indicator.type, config: n.indicator.config })),
    statuses: statuses.map((s) => ({ id: s.id, metric: s.metric, comparator: s.comparator, value: s.value, unit: s.unit })),
    candles: candles.map((c) => ({ id: c.id, field: c.candle.field, comparator: c.candle.comparator, value: c.candle.targetValue, reference: c.candle.reference } as any)),
    groups: groups.map((g) => ({ id: g.id, operator: g.operator })),
    actions,
    root
  };
}
