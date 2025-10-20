import { materializeOrders, type MarketConstraints, type RuntimeAmounts } from '@/lib/trading/engine/orderPlanner';

describe('orderPlanner', () => {
  const constraints: MarketConstraints = { pricePrecision: 2, quantityPrecision: 3, minNotional: 5, minQuantity: 0.001 };
  const lastPrice = 10; // 10 USDT
  it('computes quantity from notional and respects precision', () => {
    const intents = [
      { id: 'o1', groupId: 'g1', kind: 'buy', orderType: 'limit', price: 10, amount: { mode: 'usdt', value: 12 } } as any
    ];
    const orders = materializeOrders(intents, constraints, lastPrice, {} as RuntimeAmounts);
    expect(orders[0].quantity).toBe(1.2); // 12 / 10, qtyPrecision=3 keeps 1.2
    expect(orders[0].notional).toBeCloseTo(12, 6);
  });
  it('bumps notional to minNotional when below', () => {
    const intents = [
      { id: 'o1', groupId: 'g1', kind: 'buy', orderType: 'limit', price: 10, amount: { mode: 'usdt', value: 1 } } as any
    ];
    const orders = materializeOrders(intents, constraints, lastPrice, {} as RuntimeAmounts);
    expect((orders[0].notional || 0) >= (constraints.minNotional || 0)).toBeTruthy();
  });
});

