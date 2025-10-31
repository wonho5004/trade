'use client';

import { useEffect, useState, useTransition } from 'react';
import { useChartStore } from '@/stores/chartStore';
import { useDebounce } from '@/hooks/useDebounce';
import type { IntervalOption } from '@/types/chart';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

const intervalOptions: IntervalOption[] = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w'];
const quoteOptions: QuoteCurrency[] = ['USDT', 'USDC'];
const sortOptions: Array<{
  value: 'volume' | 'tradeValue' | 'changeUp' | 'changeDown' | 'alphabet';
  label: string;
}> = [
  { value: 'volume', label: '거래량순' },
  { value: 'tradeValue', label: '거래금액순' },
  { value: 'changeUp', label: '상승률순' },
  { value: 'changeDown', label: '하락률순' },
  { value: 'alphabet', label: '알파벳순' }
];

export function ChartTopBar() {
  const interval = useChartStore((state) => state.interval);
  const setInterval = useChartStore((state) => state.setInterval);
  const symbol = useChartStore((state) => state.symbol);
  const setSymbol = useChartStore((state) => state.setSymbol);

  const [isPending, startTransition] = useTransition();
  const [quote, setQuote] = useState<QuoteCurrency>('USDT');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'alphabet' | 'volume' | 'tradeValue' | 'changeUp' | 'changeDown'>(
    'volume'
  );
  const [isSymbolOpen, setIsSymbolOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const [isLoadingTickers, setIsLoadingTickers] = useState(false);
  const [tickers, setTickers] = useState<TickerInfo[]>([]);

  useEffect(() => {
    setSearch('');
  }, [symbol]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function loadTickers() {
      setIsLoadingTickers(true);
      try {
        const params = new URLSearchParams({ quote, sort: sortMode });
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }
        const response = await fetch(`/api/markets?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('failed to load markets');
        }
        const payload = (await response.json()) as { items: TickerInfo[] };
        if (!aborted) {
          setTickers(payload.items);
        }
      } catch (error) {
        if (!aborted) {
          console.error('[ChartTopBar] ticker fetch failed', error);
          setTickers([]);
        }
      } finally {
        if (!aborted) {
          setIsLoadingTickers(false);
        }
      }
    }

    loadTickers();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [quote, debouncedSearch, sortMode]);

  const handleIntervalClick = (option: IntervalOption) => {
    startTransition(() => setInterval(option));
  };

  return (
    <div className="flex items-center gap-4 px-2 py-2 bg-panel-dark rounded-lg">
      <div className="flex items-center gap-2">
        <select
          value={quote}
          onChange={(event) => setQuote(event.target.value as QuoteCurrency)}
          className="rounded border border-border-dark bg-background-dark px-2 py-1 text-xs uppercase text-text-main-dark focus:border-positive focus:outline-none"
        >
          {quoteOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as typeof sortMode)}
          className="rounded border border-border-dark bg-background-dark px-2 py-1 text-xs text-text-main-dark focus:border-positive focus:outline-none"
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(event) => {
              const value = event.target.value.toUpperCase();
              setSearch(value);
              const matched = tickers.find((item) => item.symbol === value);
              if (matched) {
                setSymbol(matched.symbol);
              }
            }}
            placeholder={`Search ${quote} markets`}
            onFocus={() => setIsSymbolOpen(true)}
            onBlur={() => {
              window.setTimeout(() => setIsSymbolOpen(false), 120);
            }}
            className="w-64 rounded border border-border-dark bg-background-dark px-3 py-1 text-sm text-text-main-dark focus:border-positive focus:outline-none"
          />
          {isLoadingTickers && (
            <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-[11px] uppercase text-text-secondary-dark">
              loading…
            </div>
          )}
          {!isLoadingTickers && isSymbolOpen && (
            <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border border-border-dark bg-panel-dark shadow-lg">
              {tickers.length > 0 ? (
                tickers.slice(0, 200).map((item) => (
                  <button
                    key={item.symbol}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      setSymbol(item.symbol);
                      setSearch(item.symbol);
                      setIsSymbolOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-xs transition hover:bg-background-dark ${
                      symbol === item.symbol ? 'bg-positive/10 text-positive' : 'text-text-main-dark'
                    }`}
                  >
                    <span className="flex flex-col items-start">
                      <span className="font-semibold text-sm text-text-main-dark">{item.symbol}</span>
                      <span className="flex items-center gap-3 text-[11px] text-text-secondary-dark">
                        <span>Vol {Intl.NumberFormat('en', { notation: 'compact' }).format(item.volume)}</span>
                        <span>Val {Intl.NumberFormat('en', { notation: 'compact' }).format(item.quoteVolume)}</span>
                      </span>
                    </span>
                    <span
                      className={`text-[11px] font-semibold ${
                        item.priceChangePercent >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {item.priceChangePercent.toFixed(2)}%
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-text-secondary-dark">No markets found</div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {intervalOptions.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => handleIntervalClick(option)}
            disabled={isPending && interval === option}
            className={`flex h-8 shrink-0 cursor-pointer items-center justify-center rounded-md px-3 text-sm font-medium leading-normal ${
              interval === option
                ? 'bg-background-dark text-text-main-dark font-bold'
                : 'text-text-secondary-dark hover:bg-background-dark hover:text-text-main-dark'
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
