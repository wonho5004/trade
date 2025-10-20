import { create } from 'zustand';

type AccountState = {
  symbol: string | null;
  walletUSDT?: number;
  positionNotionalUSDT?: number;
  loading: boolean;
  error?: string;
  lastUpdated?: number;
  intervalSec: number;
  _timer?: any;
  startPolling: (symbol: string) => void;
  stopPolling: () => void;
  setIntervalSec: (sec: number) => void;
};

export const useAccountStore = create<AccountState>((set, get) => ({
  symbol: null,
  loading: false,
  intervalSec: 15,
  startPolling: (symbol: string) => {
    const prev = get()._timer;
    if (prev) clearInterval(prev);
    set({ symbol, loading: true, error: undefined });
    const fetchOnce = async () => {
      try {
        const res = await fetch(`/api/trading/binance/account?symbol=${encodeURIComponent(symbol)}`);
        const json = await res.json();
        const wallet = Number(json?.account?.walletUSDT ?? NaN);
        const posNotional = Number(json?.account?.positionNotionalUSDT ?? NaN);
        set({
          walletUSDT: Number.isFinite(wallet) ? wallet : undefined,
          positionNotionalUSDT: Number.isFinite(posNotional) ? posNotional : undefined,
          loading: false,
          error: undefined,
          lastUpdated: Date.now()
        });
      } catch (e) {
        set({ loading: false, error: e instanceof Error ? e.message : String(e) });
      }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, Math.max(5, get().intervalSec) * 1000);
    set({ _timer: id });
  },
  stopPolling: () => {
    const prev = get()._timer;
    if (prev) clearInterval(prev);
    set({ _timer: undefined });
  },
  setIntervalSec: (sec: number) => set({ intervalSec: Math.max(5, Math.min(120, Math.floor(sec))) })
}));

