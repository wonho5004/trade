// @ts-nocheck
import {
  calculateMaxPosition,
  calculateMinMargin,
  calculateMinPosition,
  calculateScaleInBudget,
  SCALE_IN_BUDGET_PERCENT_CAP,
  resolveMarginCap,
  toQuantityByNotional
} from '@/lib/trading/margin';

describe('resolveMarginCap', () => {
  const leverageBrackets = [
    { maxLeverage: 125, maxNotional: 200_000 },
    { maxLeverage: 50, maxNotional: 500_000 }
  ];

  it('prioritises exchange cap when it is lower than strategy cap', () => {
    const result = resolveMarginCap({
      leverage: 100,
      strategyMaxNotional: 1_000_000,
      leverageBrackets
    });

    expect(result.exchangeMaxNotional).toBe(200_000);
    expect(result.strategyMaxNotional).toBe(1_000_000);
    expect(result.effectiveMaxNotional).toBe(200_000);
    expect(result.limitedBy).toBe('exchange');
  });

  it('falls back to strategy cap when exchange tiers are missing', () => {
    const result = resolveMarginCap({
      leverage: 20,
      strategyMaxNotional: 50_000,
      leverageBrackets: null
    });

    expect(result.exchangeMaxNotional).toBeNull();
    expect(result.strategyMaxNotional).toBe(50_000);
    expect(result.effectiveMaxNotional).toBe(50_000);
    expect(result.limitedBy).toBe('strategy');
  });
});

describe('calculateMinMargin', () => {
  it('returns null when leverage or notional is invalid', () => {
    expect(calculateMinMargin({ leverage: 0, notional: 1_000 })).toBeNull();
    expect(calculateMinMargin({ leverage: 10, notional: null })).toBeNull();
  });

  it('divides notional by leverage', () => {
    expect(calculateMinMargin({ leverage: 25, notional: 5_000 })).toBeCloseTo(200);
  });
});

describe('toQuantityByNotional', () => {
  it('rounds down quantity according to precision and honours minimum quantity', () => {
    const result = toQuantityByNotional({
      price: 2_500,
      notional: 1_000,
      quantityPrecision: 3,
      minQuantity: 0.05
    });

    expect(result.quantity).toBeCloseTo(0.4);
    expect(result.notional).toBeCloseTo(1_000);
  });

  it('returns null quantity when price is missing', () => {
    expect(
      toQuantityByNotional({
        price: null,
        notional: 500
      })
    ).toEqual({ quantity: null, notional: 500 });
  });
});

describe('calculateMinPosition', () => {
  it('computes margin and quantity for minimum notional', () => {
    const result = calculateMinPosition({
      leverage: 50,
      minNotional: 750,
      price: 1_500,
      quantityPrecision: 4,
      minQuantity: 0.01
    });

    expect(result.margin).toBeCloseTo(15);
    expect(result.notional).toBeCloseTo(750);
    expect(result.quantity).toBeCloseTo(0.5);
  });
});

describe('calculateMaxPosition', () => {
  it('returns capped values and propagates limit source', () => {
    const result = calculateMaxPosition({
      leverage: 100,
      strategyMaxNotional: 150_000,
      leverageBrackets: [
        { maxLeverage: 125, maxNotional: 200_000 },
        { maxLeverage: 50, maxNotional: 600_000 }
      ],
      price: 2_000,
      quantityPrecision: 3,
      minQuantity: 0.01
    });

    expect(result.limitedBy).toBe('strategy');
    expect(result.notional).toBeCloseTo(150_000);
    expect(result.margin).toBeCloseTo(1_500);
    expect(result.quantity).toBeCloseTo(75);
  });

  it('resets limit source when minimum notional exceeds cap', () => {
    const result = calculateMaxPosition({
      leverage: 20,
      strategyMaxNotional: 5_000,
      leverageBrackets: [{ maxLeverage: 50, maxNotional: 2_000 }],
      price: 100,
      quantityPrecision: 2,
      minQuantity: 0.1,
      minNotional: 10_000
    });

    expect(result.limitedBy).toBe('none');
    expect(result.notional).toBeCloseTo(10_000);
    expect(result.margin).toBeCloseTo(500);
  });
});

describe('calculateScaleInBudget', () => {
  it('distributes balance percentage across symbols and respects leverage', () => {
    const result = calculateScaleInBudget({
      mode: 'balance_percentage',
      percentage: 10,
      leverage: 20,
      estimatedBalance: 50_000,
      allocationCount: 5,
      price: 1_800,
      quantityPrecision: 3,
      minQuantity: 0.01
    });

    expect(result.limitedBy).toBe('balance');
    expect(result.margin).toBeCloseTo((50_000 * 0.1) / 5, 1);
    expect(result.notional).toBeCloseTo((result.margin ?? 0) * 20, 4);
    expect(result.quantity).toBeGreaterThan(0);
  });

  it('caps margin percentage at configured upper bound', () => {
    const result = calculateScaleInBudget({
      mode: 'margin_percentage',
      percentage: SCALE_IN_BUDGET_PERCENT_CAP * 2,
      leverage: 50,
      baseMargin: 150,
      allocationCount: 1,
      price: 2_000
    });

    expect(result.limitedBy).toBe('margin');
    expect(result.margin).toBeCloseTo(150 * (SCALE_IN_BUDGET_PERCENT_CAP / 100));
  });

  it('aligns min_notional mode with exchange constraints', () => {
    const result = calculateScaleInBudget({
      mode: 'min_notional',
      minNotional: 100,
      leverage: 20,
      baseNotional: 150,
      price: 2_500,
      quantityPrecision: 2,
      minQuantity: 0.05
    });

    expect(result.limitedBy).toBe('min_notional');
    expect(result.notional).toBeGreaterThanOrEqual(150);
    expect(result.margin).toBeCloseTo(result.notional! / 20);
  });
});
// @ts-nocheck
