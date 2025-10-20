import type { PlannedOrder } from '@/lib/trading/engine/orderPlanner';

export type BinanceFuturesOrder = {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_MARKET' | 'STOP';
  quantity?: string; // string per API
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
  // extra flags could be added as needed: reduceOnly, workingType, positionSide, etc.
};

export function toBinanceFuturesOrder(symbol: string, order: PlannedOrder): BinanceFuturesOrder | null {
  if (!symbol) return null;
  if (!order) return null;
  const base: BinanceFuturesOrder = {
    symbol,
    side: order.side === 'STOPLOSS' ? 'SELL' : (order.side as any),
    type: order.type as any
  };
  if (order.type === 'LIMIT') {
    if (order.price == null || order.quantity == null) return null;
    base.price = String(order.price);
    base.quantity = String(order.quantity);
    base.timeInForce = 'GTC';
  } else if (order.type === 'MARKET') {
    if (order.quantity == null) return null;
    base.quantity = String(order.quantity);
  } else if (order.type === 'STOP_MARKET') {
    if (order.stopPrice == null) return null;
    base.stopPrice = String(order.stopPrice);
    base.reduceOnly = order.reduceOnly ?? true;
    base.workingType = order.workingType || 'MARK_PRICE';
    // Hedge 모드: 포지션 사이드에 따라 스탑 방향 결정
    if (order.side === 'STOPLOSS') {
      if (order.positionSide === 'LONG') base.side = 'SELL';
      else if (order.positionSide === 'SHORT') base.side = 'BUY';
    }
  } else if (order.type === 'STOP') {
    if (order.stopPrice == null || order.quantity == null || order.price == null) return null;
    base.stopPrice = String(order.stopPrice);
    base.price = String(order.price);
    base.quantity = String(order.quantity);
    base.timeInForce = 'GTC';
    base.reduceOnly = order.reduceOnly ?? true;
    base.workingType = order.workingType || 'MARK_PRICE';
    if (order.side === 'STOPLOSS') {
      if (order.positionSide === 'LONG') base.side = 'SELL';
      else if (order.positionSide === 'SHORT') base.side = 'BUY';
    }
  }
  return base;
}
