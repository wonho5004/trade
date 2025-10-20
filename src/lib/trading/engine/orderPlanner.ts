import { applyPrecision, toQuantityByNotional } from '@/lib/trading/margin';
import type { ActionIntent } from './actions';

export type MarketConstraints = {
  pricePrecision?: number | null; // e.g., 2 → 0.01
  quantityPrecision?: number | null; // e.g., 3 → 0.001
  minNotional?: number | null;
  minQuantity?: number | null;
};

export type RuntimeAmounts = {
  // Optional references to resolve percentage-based amounts
  positionNotional?: number | null; // current position notional (abs)
  walletBalanceUSDT?: number | null; // or USDC if intent.amount.asset === 'USDC'
  initialBuyNotional?: number | null; // 최초 매수 금액
};

export type PlannedOrder = {
  id: string;
  groupId: string;
  side: 'BUY' | 'SELL' | 'STOPLOSS';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP_LIMIT';
  price?: number | null; // LIMIT or STOP_LIMIT
  stopPrice?: number | null; // STOP* orders
  quantity?: number | null;
  notional?: number | null;
  reason?: string; // when skipped or limited
  reduceOnly?: boolean;
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  raw: any;
};

const clampPositive = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

export function materializeOrders(
  intents: ActionIntent[],
  constraints: MarketConstraints,
  lastPrice: number | null,
  runtime?: RuntimeAmounts,
  options?: { useMinNotionalFallback?: boolean }
): PlannedOrder[] {
  const orders: PlannedOrder[] = [];
  const priceP = constraints.pricePrecision ?? null;
  const qtyP = constraints.quantityPrecision ?? null;
  const minNotional = clampPositive(constraints.minNotional);
  const minQty = clampPositive(constraints.minQuantity);

  const resolveNotional = (intent: ActionIntent): number | null => {
    const a = intent.amount;
    if (!a) return null;
    if (a.mode === 'usdt') return clampPositive(a.value);
    if (a.mode === 'position_percent') {
      const base = clampPositive(runtime?.positionNotional);
      const pct = clampPositive(a.value);
      if (base != null && pct != null) return (base * pct) / 100;
      return null;
    }
    if (a.mode === 'wallet_percent') {
      const base = clampPositive(runtime?.walletBalanceUSDT);
      const pct = clampPositive(a.value);
      if (base != null && pct != null) return (base * pct) / 100;
      return null;
    }
    if (a.mode === 'initial_percent') {
      const base = clampPositive(runtime?.initialBuyNotional);
      const pct = clampPositive(a.value);
      if (base != null && pct != null) return (base * pct) / 100;
      return null;
    }
    if (a.mode === 'min_notional') return minNotional ?? null;
    return null;
  };

  for (const it of intents) {
    let type: PlannedOrder['type'] = 'MARKET';
    let side: PlannedOrder['side'] = it.kind === 'stoploss' ? 'STOPLOSS' : it.kind.toUpperCase() as any;
    let price: number | null | undefined = null;
    let stopPrice: number | null | undefined = null;
    let reason: string | undefined;
    if (it.kind === 'stoploss') {
      type = 'STOP_MARKET';
      stopPrice = it.price != null ? applyPrecision(it.price, priceP, 'round') : null;
      if (stopPrice == null) reason = 'stop price unresolved';
    } else if (it.orderType === 'limit') {
      type = 'LIMIT';
      price = it.price != null ? applyPrecision(it.price, priceP, 'round') : null;
      if (price == null) reason = 'limit price unresolved';
    } else {
      type = 'MARKET';
    }

    let quantity: number | null = null;
    let notional: number | null = null;
    // Derive quantity for buy/sell when we have a price and notional target
    if (it.kind !== 'stoploss') {
      const refPrice = type === 'MARKET' ? clampPositive(lastPrice) : clampPositive(price ?? null);
      const targetNotional = resolveNotional(it);
      if (refPrice != null && targetNotional != null) {
        const q = toQuantityByNotional({ price: refPrice, notional: targetNotional, minQuantity: minQty ?? undefined, quantityPrecision: qtyP ?? undefined });
        quantity = q.quantity;
        notional = q.notional;
        if ((options?.useMinNotionalFallback ?? true) && minNotional != null && (notional ?? 0) < minNotional) {
          // bump to minimum notional
          const bump = toQuantityByNotional({ price: refPrice, notional: minNotional, minQuantity: minQty ?? undefined, quantityPrecision: qtyP ?? undefined });
          quantity = bump.quantity;
          notional = bump.notional;
          reason = reason ?? 'min_notional_aligned';
        }
      }
    }

    orders.push({
      id: it.id,
      groupId: it.groupId,
      side,
      type,
      price: price ?? null,
      stopPrice: stopPrice ?? null,
      quantity: quantity ?? null,
      notional: notional ?? null,
      reason,
      raw: it.raw
    });
  }
  return orders;
}
