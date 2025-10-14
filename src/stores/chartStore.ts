import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { IntervalOption } from '@/types/chart';

interface OverlaySettings {
  ma: boolean;
  bollinger: boolean;
  rsi: boolean;
  macd: boolean;
  dmi: boolean;
  highlight: boolean;
}

interface ChartState {
  symbol: string;
  interval: IntervalOption;
  overlays: OverlaySettings;
  setSymbol: (symbol: string) => void;
  setInterval: (interval: IntervalOption) => void;
  setOverlay: (key: keyof OverlaySettings, value: boolean) => void;
  toggleOverlay: (key: keyof OverlaySettings) => void;
}

const defaultOverlays: OverlaySettings = {
  ma: true,
  bollinger: true,
  rsi: false,
  macd: false,
  dmi: false,
  highlight: false
};

const emptyStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0
};

export const useChartStore = create<ChartState>()(
  persist(
    (set) => ({
      symbol: 'BTCUSDT',
      interval: '1m',
      overlays: defaultOverlays,
      setSymbol: (symbol) => set({ symbol }),
      setInterval: (interval) => set({ interval }),
      setOverlay: (key, value) =>
        set((state) => {
          const next = { ...state.overlays, [key]: value };
          if (key === 'highlight' && !next.ma) {
            next.ma = true;
          }
          return { overlays: next };
        }),
      toggleOverlay: (key) =>
        set((state) => {
          const nextValue = !state.overlays[key];
          const next = { ...state.overlays, [key]: nextValue };
          if (key === 'highlight' && !next.ma) {
            next.ma = true;
          }
          return { overlays: next };
        })
    }),
    {
      name: 'chart-preferences',
      version: 1,
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : emptyStorage
      ),
      partialize: (state) => ({
        symbol: state.symbol,
        interval: state.interval,
        overlays: state.overlays
      }),
      migrate: (persistedState) => {
        const next = persistedState as Partial<ChartState>;
        if (next?.overlays && !next.overlays.ma) {
          next.overlays.ma = true;
        }
        return next;
      }
    }
  )
);
