// @ts-nocheck
import { act } from '@testing-library/react';

import { createDefaultAutoTradingSettings } from '@/lib/trading/autoTradingDefaults';
import { normalizeAutoTradingSettings } from '@/lib/trading/migrations/autoTrading';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';

describe('normalizeAutoTradingSettings', () => {
  it('returns defaults when raw value is null', () => {
    const normalized = normalizeAutoTradingSettings(null);
    const defaults = createDefaultAutoTradingSettings();
    expect(normalized).toEqual(defaults);
  });

  it('migrates legacy single-direction settings into long/short structure', () => {
    const normalized = normalizeAutoTradingSettings({
      logicName: 'legacy-strategy',
      leverage: 25,
      symbolCount: 3,
      assetMode: 'single',
      positionMode: 'hedge',
      capital: {
        estimatedBalance: -10
      },
      timeframe: '4h',
      symbolSelection: {
        manualSymbols: ['BTCUSDT', 123, 'ETHUSDT'],
        excludedSymbols: ['USDC/USDT'],
        respectDefaultExclusions: false
      },
      entry: {
        enabled: true,
        immediate: true,
        indicators: {
          aggregator: 'or',
          candle: {
            enabled: true,
            field: 'close',
            comparator: 'over',
            targetValue: 5
          }
        }
      },
      scaleIn: {
        enabled: false,
        profitTarget: {
          enabled: true,
          comparator: 'over',
          value: 3
        }
      },
      exit: {
        enabled: true,
        profitTarget: {
          enabled: true,
          comparator: 'over',
          value: 1.5
        }
      },
      hedgeActivation: {
        enabled: true,
        directions: ['invalid'],
        indicators: {
          aggregator: 'or'
        }
      },
      metadata: {
        lastSavedAt: '2024-06-01T00:00:00.000Z'
      }
    });

    expect(normalized.logicName).toBe('legacy-strategy');
    expect(normalized.leverage).toBe(25);
    expect(normalized.symbolCount).toBe(3);
    expect(normalized.positionMode).toBe('hedge');
    expect(normalized.capital.estimatedBalance).toBe(10000);
    expect(normalized.symbolSelection.manualSymbols).toEqual(['BTCUSDT', 'ETHUSDT']);
    expect(normalized.symbolSelection.leverageMode).toBe('uniform');
    expect(normalized.symbolSelection.leverageOverrides).toEqual({});
    expect(normalized.entry.long.enabled).toBe(true);
    expect(normalized.entry.long.immediate).toBe(true);
    expect(normalized.entry.long.indicators.candle.reference).toBe('current');
    expect(normalized.entry.long.indicators.entries).toHaveLength(0);
    expect(normalized.entry.short.enabled).toBe(false);
    expect(normalized.scaleIn.long.enabled).toBe(false);
    expect(normalized.scaleIn.short.enabled).toBe(false);
    expect(normalized.exit.long.profitTarget.value).toBe(1.5);
    expect(normalized.exit.short.enabled).toBe(false);
    expect(normalized.hedgeActivation.enabled).toBe(true);
    expect(normalized.hedgeActivation.directions).toEqual(['long', 'short']);
    expect(normalized.metadata.lastSavedAt).toBe('2024-06-01T00:00:00.000Z');
    expect(normalized.metadata.lastValidatedAt).toBeNull();
  });
});

describe('useAutoTradingSettingsStore', () => {
  beforeEach(() => {
    useAutoTradingSettingsStore.setState({ settings: createDefaultAutoTradingSettings() });
    window.localStorage.clear();
  });

  it('normalizes draft updates before persisting', () => {
    act(() => {
      useAutoTradingSettingsStore.getState().updateSettings((draft) => {
        // simulate legacy shape during update
        // @ts-expect-error intentionally assigning invalid shape
        draft.entry = {
          enabled: true,
          immediate: true
        };
        draft.capital.estimatedBalance = -500;
      });
    });

    const state = useAutoTradingSettingsStore.getState().settings;
    expect(state.entry.long.enabled).toBe(true);
    expect(state.entry.short.enabled).toBe(false);
    expect(state.capital.estimatedBalance).toBe(10000);
  });
});
// @ts-nocheck
