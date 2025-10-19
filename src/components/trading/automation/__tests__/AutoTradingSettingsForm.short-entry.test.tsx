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

    const entrySectionToggle = screen.getByRole('button', { name: /진입\(매수\) 설정/ });
    await user.click(entrySectionToggle);

    // 섹션 컨테이너 범위를 좁혀서 조회
    const entrySection = entrySectionToggle.closest('section')!;
    const entryWithin = within(entrySection);

    // 숏 패널에서 ‘조건 그룹 추가’ 클릭 (두 패널 중 두 번째 버튼 선택)
    const addGroupButtons = entryWithin.getAllByRole('button', { name: '조건 그룹 추가' });
    await user.click(addGroupButtons[addGroupButtons.length - 1]);

    // 그룹 편집 열기(숏 패널 쪽 버튼 선택)
    const editGroupButtons = entryWithin.getAllByRole('button', { name: '그룹 편집' });
    await user.click(editGroupButtons[editGroupButtons.length - 1]);

    // 모달에서 지표 추가: 볼린저 밴드 선택 후 추가 → 저장
    const bollingerOpt = await screen.findByRole('option', { name: '볼린저 밴드' });
    const indicatorSelect = bollingerOpt.parentElement as HTMLSelectElement;
    await user.selectOptions(indicatorSelect, 'bollinger');
    const addButtons = screen.getAllByRole('button', { name: '추가' });
    await user.click(addButtons[0]);
    const dialog = screen.getByRole('dialog');
    const saveButton = within(dialog).getByRole('button', { name: '저장' });
    await user.click(saveButton);

    // 스토어에 숏 엔트리 지표가 추가되었는지 확인
    await waitFor(() => {
      expect(useAutoTradingSettingsStore.getState().settings.entry.short.indicators.entries.length).toBeGreaterThan(0);
    });

    // 숏 패널에서 ‘지표 편집’ 버튼 클릭하여 편집 모달이 뜨는지 확인
    const indicatorEditButtons = entryWithin.getAllByRole('button', { name: '지표 편집' });
    await user.click(indicatorEditButtons[indicatorEditButtons.length - 1]);
    const indicatorDialog = await screen.findByRole('dialog');
    expect(within(indicatorDialog).getByText('지표 편집')).toBeInTheDocument();
  });
});
// @ts-nocheck
