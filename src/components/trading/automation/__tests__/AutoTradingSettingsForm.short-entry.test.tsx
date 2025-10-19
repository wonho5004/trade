// @ts-nocheck
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AutoTradingSettingsForm } from '../AutoTradingSettingsForm';
import { createDefaultAutoTradingSettings } from '@/lib/trading/autoTradingDefaults';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';

describe('AutoTradingSettingsForm – short entry indicators', () => {
  const originalFetch = global.fetch;
  const mockFetch = jest.fn();

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ markets: [] })
    } as Response);
    global.fetch = mockFetch as unknown as typeof fetch;
    localStorage.clear();
    useAutoTradingSettingsStore.setState((state) => ({
      ...state,
      settings: createDefaultAutoTradingSettings()
    }));
  });

  afterEach(() => {
    mockFetch.mockReset();
    global.fetch = originalFetch;
  });

  it('opens the short entry indicator editor when requested', async () => {
    const user = userEvent.setup();

    render(<AutoTradingSettingsForm />);

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());

    const entrySectionToggle = screen.getByRole('button', { name: /포지션 진입\(매수\) 설정/ });
    await user.click(entrySectionToggle);

    const shortTab = screen.getByRole('tab', { name: /숏/ });
    await user.click(shortTab);

    const shortPanel = document.getElementById('entry-panel-short');
    expect(shortPanel).not.toBeNull();

    const panel = within(shortPanel!);
    const enableShortEntry = panel.getByLabelText('숏 매수 사용');
    await user.click(enableShortEntry);

    const addButton = panel.getByRole('button', { name: '조건 추가' });
    await user.click(addButton);

    await screen.findByText('지표 선택');

    const bollingerOption = await screen.findByRole('button', { name: /볼린저 밴드/ });
    await user.click(bollingerOption);
    await waitFor(() => {
      expect(useAutoTradingSettingsStore.getState().settings.entry.short.indicators.entries.length).toBeGreaterThan(0);
    });

    const indicatorModalTitle = await screen.findByText('볼린저 밴드 조건 편집');
    const modalHeader = indicatorModalTitle.closest('header');
    const closeButton = modalHeader?.querySelector('button');
    if (!closeButton) {
      throw new Error('조건 편집 모달 닫기 버튼을 찾을 수 없습니다.');
    }
    await user.click(closeButton);

    const editButtons = panel.getAllByRole('button', { name: '조건 편집' });
    await user.click(editButtons[0]);

    expect(await screen.findByText('볼린저 밴드 조건 편집')).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /조건 중 하나 이상/ })).toBeInTheDocument();
  });
});
// @ts-nocheck
