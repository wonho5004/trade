'use client';

import { useState, useEffect, useCallback } from 'react';
import type { RecentTradingActivity, TradeAction, TradeStatus } from '@/types/trading/monitoring';

interface UseTradeHistoryOptions {
  action?: TradeAction | 'ALL';
  status?: TradeStatus | 'ALL';
  limit?: number;
}

interface UseTradeHistoryReturn {
  trades: RecentTradingActivity[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useTradeHistory(options: UseTradeHistoryOptions = {}): UseTradeHistoryReturn {
  const { action = 'ALL', status = 'ALL', limit = 50 } = options;

  const [trades, setTrades] = useState<RecentTradingActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTrades = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (action !== 'ALL') params.append('action', action);
      if (status !== 'ALL') params.append('status', status);
      params.append('limit', limit.toString());

      const response = await fetch(`/api/monitoring/trades?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        // 401 에러는 조용히 처리 (로그인 필요)
        if (response.status === 401) {
          setError(null); // 에러 표시 안함
          setIsLoading(false);
          return;
        }
        throw new Error(data.error?.message || '거래 내역 조회에 실패했습니다');
      }

      setTrades(data.trades || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(message);
      console.error('Failed to fetch trade history:', err);
    } finally {
      setIsLoading(false);
    }
  }, [action, status, limit]);

  // Fetch when filters change
  useEffect(() => {
    fetchTrades();

    // Poll every 10 seconds for updates
    const interval = setInterval(fetchTrades, 10000);

    return () => clearInterval(interval);
  }, [fetchTrades]);

  return {
    trades,
    isLoading,
    error,
    refetch: fetchTrades
  };
}
