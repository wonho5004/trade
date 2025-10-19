import type { AutoTradingSettings, PositionPreference } from '@/types/trading/auto-trading';

export type ResolvedSymbolConfig = {
  leverage: number;
  positionPreference: PositionPreference | 'default';
  features: { scaleIn: boolean; exit: boolean; stopLoss: boolean };
};

export function resolveSymbolConfig(settings: AutoTradingSettings, symbol: string): ResolvedSymbolConfig {
  const up = symbol.toUpperCase();
  const sel = settings.symbolSelection;
  const lev = sel.leverageOverrides[up];
  const position = (sel.positionOverrides ?? {})[up] ?? 'default';
  const feat = (sel.featureOverrides ?? {})[up] ?? {};
  return {
    leverage: typeof lev === 'number' && Number.isFinite(lev) && lev >= 1 ? Math.min(125, Math.max(1, Math.round(lev))) : settings.leverage,
    positionPreference: (position === 'both' || position === 'long' || position === 'short') ? position : 'default',
    features: {
      scaleIn: feat.scaleIn === false ? false : true,
      exit: feat.exit === false ? false : true,
      stopLoss: feat.stopLoss === false ? false : true
    }
  };
}

