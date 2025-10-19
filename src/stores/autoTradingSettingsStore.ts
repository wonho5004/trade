import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { createDefaultAutoTradingSettings } from '@/lib/trading/autoTradingDefaults';
import { normalizeAutoTradingSettings } from '@/lib/trading/migrations/autoTrading';
import type { AutoTradingSettings } from '@/types/trading/auto-trading';
import { DEFAULT_EXCLUDED_SYMBOLS } from '@/types/trading/auto-trading';

type AutoTradingSettingsStore = {
  settings: AutoTradingSettings;
  updateSettings: (updater: (draft: AutoTradingSettings) => void) => void;
  // Raw updater for indicator trees: bypass global normalization to avoid accidental drops
  updateIndicatorsRaw: (
    target:
      | { type: 'entry'; direction: 'long' | 'short' }
      | { type: 'scaleIn'; direction: 'long' | 'short' }
      | { type: 'exit'; direction: 'long' | 'short' }
      | { type: 'hedge' }
      | { type: 'stopLossLine' },
    indicators: AutoTradingSettings['entry']['long']['indicators']
  ) => void;
  reset: () => void;
  getDefaultExcludedSymbols: () => string[];
};

const cloneSettings = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);

export const useAutoTradingSettingsStore = create<AutoTradingSettingsStore>()(
  persist(
    (set) => ({
      settings: createDefaultAutoTradingSettings(),
      updateSettings: (updater) => {
        set((state) => {
          const draft = cloneSettings(state.settings);
          updater(draft);
          return { settings: normalizeAutoTradingSettings(draft) };
        });
      },
      updateIndicatorsRaw: (target, indicators) => {
        set((state) => {
          const next = cloneSettings(state.settings);
          if (target.type === 'entry') {
            next.entry[target.direction].indicators = indicators as any;
          } else if (target.type === 'scaleIn') {
            next.scaleIn[target.direction].indicators = indicators as any;
          } else if (target.type === 'exit') {
            next.exit[target.direction].indicators = indicators as any;
          } else if (target.type === 'hedge') {
            next.hedgeActivation.indicators = indicators as any;
          } else if (target.type === 'stopLossLine') {
            next.stopLoss.stopLossLine.indicators = indicators as any;
          }
          next.metadata.lastSavedAt = new Date().toISOString();
          return { settings: next };
        });
      },
      reset: () => set({ settings: createDefaultAutoTradingSettings() }),
      getDefaultExcludedSymbols: () => DEFAULT_EXCLUDED_SYMBOLS.slice()
    }),
    {
      name: 'auto-trading-settings-v1',
      version: 2,
      migrate: (persistedState) => {
        const state = persistedState as { settings?: unknown } | undefined;
        if (!state?.settings) {
          return { settings: createDefaultAutoTradingSettings() };
        }
        return {
          settings: normalizeAutoTradingSettings(state.settings)
        };
      },
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as { settings?: unknown } | undefined)?.settings;
        if (!persisted) {
          return currentState;
        }
        return {
          ...currentState,
          settings: normalizeAutoTradingSettings(persisted)
        } as AutoTradingSettingsStore;
      }
    }
  )
);
