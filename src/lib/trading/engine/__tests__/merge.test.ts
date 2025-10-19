import { createDefaultAutoTradingSettings } from '@/lib/trading/autoTradingDefaults';
import { resolveSymbolConfig } from '@/lib/trading/engine/merge';

describe('resolveSymbolConfig', () => {
  it('returns defaults when no overrides exist', () => {
    const settings = createDefaultAutoTradingSettings();
    settings.leverage = 7;
    const res = resolveSymbolConfig(settings, 'BTCUSDT');
    expect(res.leverage).toBe(7);
    expect(res.positionPreference).toBe('default');
    expect(res.features).toEqual({ scaleIn: true, exit: true, stopLoss: true });
  });

  it('applies per-symbol overrides safely', () => {
    const settings = createDefaultAutoTradingSettings();
    settings.leverage = 5;
    settings.symbolSelection.leverageOverrides['BTCUSDT'] = 20;
    settings.symbolSelection.positionOverrides!['BTCUSDT'] = 'short';
    settings.symbolSelection.featureOverrides!['BTCUSDT'] = { scaleIn: false };

    const res = resolveSymbolConfig(settings, 'btcusdt'); // case-insensitive
    expect(res.leverage).toBe(20);
    expect(res.positionPreference).toBe('short');
    expect(res.features).toEqual({ scaleIn: false, exit: true, stopLoss: true });
  });
});

