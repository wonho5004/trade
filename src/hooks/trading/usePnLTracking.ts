'use client';

import { useState, useEffect, useCallback } from 'react';

interface UsePnLTrackingReturn {
  totalUnrealized: number;
  totalRealized: number;
  isLoading: boolean;
  error: string | null;
}

export function usePnLTracking(): UsePnLTrackingReturn {
  const [totalUnrealized, setTotalUnrealized] = useState(0);
  const [totalRealized, setTotalRealized] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPnL = useCallback(async (isInitialLoad = false) => {
    // 초기 로드일 때만 로딩 상태 표시
    if (isInitialLoad) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const response = await fetch('/api/monitoring/pnl');
      const data = await response.json();

      if (!response.ok) {
        // 401 에러는 조용히 처리 (로그인 필요)
        if (response.status === 401) {
          setError(null); // 에러 표시 안함
          if (isInitialLoad) {
            setIsLoading(false);
          }
          return;
        }
        throw new Error(data.error?.message || 'PnL 조회에 실패했습니다');
      }

      setTotalUnrealized(data.totalUnrealized || 0);
      setTotalRealized(data.totalRealized || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(message);
      console.error('Failed to fetch PnL:', err);
    } finally {
      if (isInitialLoad) {
        setIsLoading(false);
      }
    }
  }, []);

  // Initial fetch and periodic updates
  useEffect(() => {
    // 초기 로드
    fetchPnL(true);

    // Poll every 3 seconds for real-time PnL updates (초기 로드 아님)
    const interval = setInterval(() => fetchPnL(false), 3000);

    return () => clearInterval(interval);
  }, [fetchPnL]);

  return {
    totalUnrealized,
    totalRealized,
    isLoading,
    error
  };
}
