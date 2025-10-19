import { createIndicatorEntry, createIndicatorGroup, createIndicatorLeaf } from '@/lib/trading/autoTradingDefaults';
import { requiredLookback } from '@/lib/trading/engine/indicatorSignals';

describe('indicatorSignals.requiredLookback', () => {
  it('returns at least 50 by default', () => {
    const root = createIndicatorGroup('and', []);
    const conditions: any = { root };
    expect(requiredLookback(conditions)).toBeGreaterThanOrEqual(50);
  });

  it('scales with MA period when large', () => {
    const entry = createIndicatorEntry('ma');
    (entry.config as any).period = 200;
    const root = createIndicatorGroup('and', [createIndicatorLeaf(entry)]);
    const conditions: any = { root };
    expect(requiredLookback(conditions)).toBeGreaterThanOrEqual(205); // period + 5
  });
});

