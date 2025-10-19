// @ts-nocheck
import React from 'react';
import { render } from '@testing-library/react';

import { GroupListPanel } from '../GroupListPanel';
import { createIndicatorEntry, createIndicatorLeaf, createIndicatorGroup } from '@/lib/trading/autoTradingDefaults';

function sampleConditions() {
  const rsi = createIndicatorEntry('rsi');
  (rsi.config as any).period = 14;
  const leaf = createIndicatorLeaf(rsi, { kind: 'none' } as any);
  const group = createIndicatorGroup('and', [leaf]);
  return { root: createIndicatorGroup('or', [group]) } as any;
}

describe('GroupListPanel snapshots', () => {
  it('renders group summary consistently', () => {
    const value = sampleConditions();
    const { container } = render(<GroupListPanel value={value} onChange={() => {}} />);
    expect(container.firstChild).toMatchSnapshot();
  });
});

