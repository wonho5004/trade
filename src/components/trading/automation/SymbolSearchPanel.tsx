'use client';

import React, { useState, useMemo, useEffect } from 'react';
import type { EnrichedSymbolData, SymbolSortCriteria } from '@/types/trading/symbol-selection';
import type { FuturesSymbolMeta } from '@/types/trading/markets';

interface SymbolSearchPanelProps {
  /** 선택된 종목 목록 */
  selectedSymbols: string[];
  /** 제외된 종목 목록 */
  excludedSymbols: string[];
  /** 종목 추가 핸들러 */
  onAddSymbol: (symbol: string) => void;
  /** 종목 제외 핸들러 */
  onExcludeSymbol: (symbol: string) => void;
}

/**
 * 종목 검색 패널
 * - USDT/USDC 쿼터 선택
 * - 검색어 필터링
 * - 5가지 정렬 기준 (알파벳, 거래량, 시가총액, 상승률, 하락률)
 * - 종목 추가/제외 버튼
 */
export const SymbolSearchPanel: React.FC<SymbolSearchPanelProps> = ({
  selectedSymbols,
  excludedSymbols,
  onAddSymbol,
  onExcludeSymbol
}) => {
  // 상태
  const [quote, setQuote] = useState<'USDT' | 'USDC'>('USDT');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<SymbolSortCriteria>('alpha');
  const [markets, setMarkets] = useState<FuturesSymbolMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // API 호출
  useEffect(() => {
    const fetchMarkets = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/trading/binance/futures-symbols');
        if (!res.ok) {
          throw new Error('종목 목록을 가져올 수 없습니다.');
        }
        const data = await res.json();
        setMarkets(data.markets || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '알 수 없는 오류');
      } finally {
        setLoading(false);
      }
    };

    fetchMarkets();
  }, []);

  // 필터링 및 정렬
  const filteredAndSortedSymbols = useMemo(() => {
    // 1. 쿼터 필터
    let filtered = markets.filter((m) => m.quote === quote);

    // 2. 검색어 필터
    if (searchTerm.trim()) {
      const term = searchTerm.trim().toUpperCase();
      filtered = filtered.filter(
        (m) =>
          m.symbol.includes(term) ||
          m.base.includes(term)
      );
    }

    // 3. 정렬
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'alpha':
          return a.symbol.localeCompare(b.symbol);
        case 'volume':
          return (b.quoteVolume || 0) - (a.quoteVolume || 0);
        case 'marketcap':
          return (b.marketCapEstimate || 0) - (a.marketCapEstimate || 0);
        case 'gainers':
        case 'losers':
          // TODO: 일일 변동률 계산 필요 (현재는 알파벳순 fallback)
          return a.symbol.localeCompare(b.symbol);
        default:
          return 0;
      }
    });

    return sorted;
  }, [markets, quote, searchTerm, sortBy]);

  // 렌더링 최적화: 최대 100개만 표시
  const displayedSymbols = useMemo(() => {
    return filteredAndSortedSymbols.slice(0, 100);
  }, [filteredAndSortedSymbols]);

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <h3 className="text-sm font-semibold text-zinc-100">종목 검색</h3>
      </div>

      {/* 쿼터 선택 탭 */}
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setQuote('USDT')}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-all ${
            quote === 'USDT'
              ? 'bg-blue-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
        >
          USDT
        </button>
        <button
          onClick={() => setQuote('USDC')}
          className={`flex-1 rounded px-3 py-2 text-sm font-medium transition-all ${
            quote === 'USDC'
              ? 'bg-blue-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
        >
          USDC
        </button>
      </div>

      {/* 검색 입력 */}
      <div className="mb-3">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="종목명 검색 (예: BTC, ETH)"
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* 정렬 선택 */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-zinc-300">
          정렬 기준
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SymbolSortCriteria)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="alpha">알파벳순</option>
          <option value="volume">거래량순 (24h)</option>
          <option value="marketcap">시가총액순 (추정)</option>
          <option value="gainers">상승률순 (24h)</option>
          <option value="losers">하락률순 (24h)</option>
        </select>
      </div>

      {/* 로딩 상태 */}
      {loading && (
        <div className="py-8 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent" />
          <p className="mt-2 text-xs text-zinc-400">종목 목록 로딩 중...</p>
        </div>
      )}

      {/* 에러 상태 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* 종목 목록 */}
      {!loading && !error && (
        <>
          <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
            <span>
              {filteredAndSortedSymbols.length}개 종목
              {filteredAndSortedSymbols.length > 100 && ' (100개만 표시)'}
            </span>
          </div>

          <div className="max-h-96 space-y-1 overflow-y-auto">
            {displayedSymbols.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-zinc-400">검색 결과가 없습니다</p>
              </div>
            )}

            {displayedSymbols.map((market) => {
              const isSelected = selectedSymbols.includes(market.symbol);
              const isExcluded = excludedSymbols.includes(market.symbol);

              return (
                <div
                  key={market.symbol}
                  className={`flex items-center justify-between rounded border p-2 transition-all ${
                    isSelected
                      ? 'border-green-500/50 bg-green-500/10'
                      : isExcluded
                      ? 'border-red-500/50 bg-red-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800'
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-zinc-100">
                        {market.base}
                      </span>
                      <span className="text-xs text-zinc-500">
                        / {market.quote}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-xs text-zinc-400">
                      {market.lastPrice && (
                        <span>${market.lastPrice.toLocaleString()}</span>
                      )}
                      {market.quoteVolume && (
                        <span>Vol: ${(market.quoteVolume / 1_000_000).toFixed(1)}M</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    {!isSelected && !isExcluded && (
                      <>
                        <button
                          onClick={() => onAddSymbol(market.symbol)}
                          className="rounded bg-blue-500 px-3 py-1 text-xs font-medium text-white hover:bg-blue-600 transition-colors"
                          title="종목 추가"
                        >
                          추가
                        </button>
                        <button
                          onClick={() => onExcludeSymbol(market.symbol)}
                          className="rounded bg-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
                          title="종목 제외"
                        >
                          제외
                        </button>
                      </>
                    )}
                    {isSelected && (
                      <span className="rounded bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300">
                        선택됨
                      </span>
                    )}
                    {isExcluded && (
                      <span className="rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300">
                        제외됨
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 도움말 */}
      <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
        <p className="text-xs font-medium text-blue-300 mb-1">💡 검색 팁</p>
        <ul className="space-y-0.5 text-xs text-blue-200">
          <li>• USDT/USDC 탭으로 쿼터 선택</li>
          <li>• 검색창에 종목명 입력 (BTC, ETH 등)</li>
          <li>• 정렬 기준 선택 후 목록에서 추가/제외</li>
        </ul>
      </div>
    </div>
  );
};
