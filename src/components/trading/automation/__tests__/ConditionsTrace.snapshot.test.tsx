// @ts-nocheck
import React from 'react';
import { render } from '@testing-library/react';

import { ConditionsTrace } from '../ConditionsTrace';
import { createIndicatorEntry, createIndicatorLeaf, createIndicatorGroup } from '@/lib/trading/autoTradingDefaults';

function sampleConditions() {
  const ma = createIndicatorEntry('ma');
  (ma.config as any).period = 20;
  const leaf = createIndicatorLeaf(ma, { kind: 'value', comparator: 'over', value: 0 });
  const root = createIndicatorGroup('and', [leaf]);
  (root as any).id = 'cond-root';
  return { root } as any;
}

describe('ConditionsTrace snapshots', () => {
  it('renders indicator/status/candle summary consistently', () => {
    const conds = sampleConditions();
    const context: any = {
      symbol: 'BTCUSDT',
      direction: 'long',
      candleCurrent: { timestamp: Date.now(), open: 1, high: 2, low: 0.5, close: 1.5, volume: 1000 },
      candlePrevious: { timestamp: Date.now() - 60000, open: 0.9, high: 1.1, low: 0.8, close: 1.0, volume: 900 }
    };
    const indicatorSignals = { /* by node id */ } as any;
    const { container } = render(<ConditionsTrace conditions={conds} context={context} indicatorSignals={indicatorSignals} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});
