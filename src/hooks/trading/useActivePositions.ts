'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ActivePositionSummary } from '@/types/trading/monitoring';

interface UseActivePositionsReturn {
  positions: ActivePositionSummary[];
  isLoading: boolean;
  error: string | null;
  closePosition: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useActivePositions(): UseActivePositionsReturn {
  const [positions, setPositions] = useState<ActivePositionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/monitoring/positions');
      const data = await response.json();

      if (!response.ok) {
        // 401 에러는 조용히 처리 (로그인 필요)
        if (response.status === 401) {
          setError(null); // 에러 표시 안함
          setIsLoading(false);
          return;
        }
        throw new Error(data.error?.message || '포지션 조회에 실패했습니다');
      }

      setPositions(data.positions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(message);
      console.error('Failed to fetch positions:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const closePosition = useCallback(async (id: string) => {
    const response = await fetch(`/api/monitoring/positions/${id}/close`, {
      method: 'POST'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '포지션 청산에 실패했습니다');
    }

    // Refetch to update the list
    await fetchPositions();
  }, [fetchPositions]);

  // Initial fetch and periodic updates
  useEffect(() => {
    fetchPositions();

    // Poll every 5 seconds for real-time updates
    const interval = setInterval(fetchPositions, 5000);

    return () => clearInterval(interval);
  }, [fetchPositions]);

  return {
    positions,
    isLoading,
    error,
    closePosition,
    refetch: fetchPositions
  };
}
