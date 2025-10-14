'use client';

import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { useChartStore } from '@/stores/chartStore';
import { useMarketDataStore } from '@/stores/marketDataStore';

const formatNumber = (value: number | null, fractionDigits = 2) => {
  if (value === null || Number.isNaN(value)) {
    return '-';
  }
  return value.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
};

export function TickerPanel() {
  const symbol = useChartStore((state) => state.symbol);
  const { status, lastPrice, priceChangePercent, highPrice, lowPrice, volume } = useMarketDataStore(
    useShallow((state) => ({
      status: state.status,
      lastPrice: state.lastPrice,
      priceChangePercent: state.priceChangePercent,
      highPrice: state.highPrice,
      lowPrice: state.lowPrice,
      volume: state.volume
    }))
  );
  const attachTicker = useMarketDataStore((state) => state.attach);

  useEffect(() => {
    if (!symbol) {
      return;
    }
    const detach = attachTicker(symbol);
    return detach;
  }, [symbol, attachTicker]);

  const isPositive = useMemo(() => (priceChangePercent ?? 0) >= 0, [priceChangePercent]);

  return (
    <section className="flex h-full flex-col justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <header className="flex items-baseline justify-between">
        <div>
          <p className="text-sm text-zinc-400">실시간 가격</p>
          <h2 className="text-lg font-semibold text-zinc-100">{symbol}</h2>
        </div>
        <span
          className={`text-sm font-semibold ${
            isPositive ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {status === 'connected' && priceChangePercent !== null
            ? `${formatNumber(priceChangePercent, 2)}%`
            : status === 'connecting'
            ? '연결 중...'
            : status === 'error'
            ? '에러'
            : '-'}
        </span>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-zinc-400">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">마지막 체결가</p>
          <p className="mt-2 text-base font-semibold text-zinc-100">
            {status === 'connected' ? formatNumber(lastPrice, 2) : '-'}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">24h 고가</p>
          <p className="mt-2 text-base font-semibold text-zinc-100">{formatNumber(highPrice, 2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">24h 저가</p>
          <p className="mt-2 text-base font-semibold text-zinc-100">{formatNumber(lowPrice, 2)}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">24h 거래량</p>
          <p className="mt-2 text-base font-semibold text-zinc-100">{formatNumber(volume, 0)}</p>
        </div>
      </div>
    </section>
  );
}
