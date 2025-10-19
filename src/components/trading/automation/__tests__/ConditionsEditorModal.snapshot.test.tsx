// @ts-nocheck
import React from 'react';
import { render } from '@testing-library/react';

import { ConditionsEditorModal } from '../ConditionsEditorModal';
import { createIndicatorGroup } from '@/lib/trading/autoTradingDefaults';

describe('ConditionsEditorModal snapshots', () => {
  it('renders select mode (embedded) consistently', () => {
    const value: any = { root: createIndicatorGroup('or', []) };
    const { container } = render(
      <ConditionsEditorModal open title="조건 편집" value={value} onChange={() => {}} onClose={() => {}} initialMode="select" embedded />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders edit mode (embedded) consistently', () => {
    const value: any = { root: createIndicatorGroup('and', []) };
    const { container } = render(
      <ConditionsEditorModal open title="조건 편집" value={value} onChange={() => {}} onClose={() => {}} initialMode="edit" embedded />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});

