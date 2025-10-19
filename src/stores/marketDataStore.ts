import { create } from 'zustand';

import { fetchTicker24h, subscribeTicker } from '@/lib/trading/realtime';
import type { TickerUpdate } from '@/lib/trading/realtime';

type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

type MarketDataState = {
  status: ConnectionStatus;
  symbol: string;
  lastPrice: number | null;
  priceChangePercent: number | null;
  highPrice: number | null;
  lowPrice: number | null;
  volume: number | null;
  error?: string;
  listeners: number;
  cleanup?: () => void;
  setTicker: (update: TickerUpdate) => void;
  setError: (message: string) => void;
  attach: (symbol: string) => () => void;
  beginConnection: (symbol: string) => () => void;
  reset: () => void;
};

const baseState = {
  status: 'idle' as ConnectionStatus,
  symbol: '',
  lastPrice: null,
  priceChangePercent: null,
  highPrice: null,
  lowPrice: null,
  volume: null,
  error: undefined,
  listeners: 0,
  cleanup: undefined
};

const createConnection = (
  symbol: string,
  set: (updater: (state: MarketDataState) => MarketDataState) => void
) => {
  set((state) => ({
    ...state,
    status: 'connecting',
    symbol,
    error: undefined
  }));

  const cleanup = subscribeTicker(
    symbol,
    (update) => {
      set((state) => {
        if (state.symbol !== update.symbol) {
          return state;
        }
        return {
          ...state,
          status: 'connected',
          symbol: update.symbol,
          lastPrice: update.lastPrice,
          priceChangePercent: update.priceChangePercent,
          highPrice: update.highPrice,
          lowPrice: update.lowPrice,
          volume: update.volume,
          error: undefined
        };
      });
    },
    (message) => {
      set((state) => ({
        ...state,
        status: 'error',
        error: message
      }));
    }
  );

  return cleanup;
};

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
  ...baseState,
  setTicker: (update) =>
    set((state) => {
      if (state.symbol !== update.symbol) {
        return state;
      }
      return {
        ...state,
        status: 'connected',
        symbol: update.symbol,
        lastPrice: update.lastPrice,
        priceChangePercent: update.priceChangePercent,
        highPrice: update.highPrice,
        lowPrice: update.lowPrice,
        volume: update.volume,
        error: undefined
      };
    }),
  setError: (message) =>
    set((state) => ({
      ...state,
      status: 'error',
      error: message
    })),
  attach: (symbol: string) => {
    const state = get();

    if (state.symbol !== symbol) {
      state.cleanup?.();
      set(() => ({ ...baseState, symbol }));
    }

    const current = get();
    let cleanup = current.cleanup;

    if (!cleanup) {
      cleanup = createConnection(symbol, (updater) => set((prev) => updater(prev)));
      set((prev) => ({ ...prev, cleanup, listeners: 1 }));
    } else {
      set((prev) => ({ ...prev, listeners: prev.listeners + 1, symbol }));
    }

    if (current.status === 'idle') {
      fetchTicker24h(symbol)
        .then((snapshot) => {
          get().setTicker(snapshot);
        })
        .catch(() => {
          /* ignore snapshot fallback errors */
        });
    }

    return () => {
      const latest = get();
      if (latest.symbol !== symbol) {
        return;
      }
      const nextListeners = Math.max(0, latest.listeners - 1);
      if (nextListeners === 0) {
        latest.cleanup?.();
        set(() => ({ ...baseState }));
      } else {
        set((prev) => ({ ...prev, listeners: nextListeners }));
      }
    };
  },
  beginConnection: (symbol: string) => get().attach(symbol),
  reset: () => {
    const state = get();
    state.cleanup?.();
    set(() => ({ ...baseState }));
  }
}));
