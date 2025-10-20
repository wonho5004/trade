import type { IndicatorConditions } from '@/types/trading/auto-trading';
import type { EvaluationContext, EvaluationTrace } from './conditions';
import { evaluateWithTrace, toExecutablePlan } from './conditions';
import { resolvePriceFromRef, type IndicatorSeriesMap } from './priceResolver';

export type ActionIntent = {
  id: string;
  groupId: string;
  kind: 'buy' | 'sell' | 'stoploss';
  orderType?: 'market' | 'limit';
  price?: number | null; // resolved when orderType=limit or stoploss price
  amount?: {
    mode: 'usdt' | 'position_percent' | 'wallet_percent' | 'initial_percent' | 'min_notional';
    asset?: 'USDT' | 'USDC';
    value?: number; // when present (usdt or percent)
    walletBasis?: 'wallet' | 'total' | 'free';
  };
  raw: any; // original action config
};

export function buildActionIntents(
  conditions: IndicatorConditions,
  ctx: EvaluationContext,
  indicatorSignals: Record<string, boolean> | undefined,
  indicatorSeries: IndicatorSeriesMap,
  index?: number
): ActionIntent[] {
  const { result, trace } = evaluateWithTrace(conditions, ctx, { indicatorSignals });
  if (!result) return [];
  const plan = toExecutablePlan(conditions);
  const intents: ActionIntent[] = [];
  for (const a of plan.actions) {
    // group must be true to trigger actions inside it
    if (trace[a.groupId] !== true) continue;
    const cfg: any = a.action as any;
    if (cfg.kind === 'buy') {
      const intent: ActionIntent = {
        id: a.id,
        groupId: a.groupId,
        kind: 'buy',
        orderType: cfg.orderType,
        amount: {
          mode: cfg.amountMode,
          asset: cfg.asset,
          value: cfg.usdt ?? cfg.positionPercent ?? cfg.walletPercent ?? cfg.initialPercent,
          walletBasis: cfg.walletBasis
        },
        raw: cfg
      };
      if (cfg.orderType === 'limit') {
        intent.price = cfg.limitPriceMode === 'input' ? Number(cfg.limitPrice ?? NaN) : resolvePriceFromRef(cfg.indicatorRefId, indicatorSeries, index);
      }
      intents.push(intent);
    } else if (cfg.kind === 'sell') {
      const intent: ActionIntent = {
        id: a.id,
        groupId: a.groupId,
        kind: 'sell',
        orderType: cfg.orderType,
        amount: {
          mode: cfg.amountMode,
          asset: cfg.asset,
          value: cfg.usdt ?? cfg.positionPercent,
        },
        raw: cfg
      };
      if (cfg.orderType === 'limit') {
        intent.price = cfg.limitPriceMode === 'input' ? Number(cfg.limitPrice ?? NaN) : resolvePriceFromRef(cfg.indicatorRefId, indicatorSeries, index);
      }
      intents.push(intent);
    } else if (cfg.kind === 'stoploss') {
      const intent: ActionIntent = {
        id: a.id,
        groupId: a.groupId,
        kind: 'stoploss',
        price: cfg.priceMode === 'input' ? Number(cfg.price ?? NaN) : resolvePriceFromRef(cfg.indicatorRefId, indicatorSeries, index),
        raw: cfg
      };
      intents.push(intent);
    }
  }
  return intents;
}

