'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ConditionEvaluation } from '@/types/trading/monitoring';

interface UseConditionMonitorReturn {
  evaluations: ConditionEvaluation[];
  isLoading: boolean;
  error: string | null;
  activeStrategies: number;
  refetch: () => Promise<void>;
}

export function useConditionMonitor(): UseConditionMonitorReturn {
  const [evaluations, setEvaluations] = useState<ConditionEvaluation[]>([]);
  const [activeStrategies, setActiveStrategies] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvaluations = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/monitoring/condition-evaluations?limit=20');
      const data = await response.json();

      if (!response.ok) {
        // 401 에러는 조용히 처리 (로그인 필요)
        if (response.status === 401) {
          setError(null); // 에러 표시 안함
          setIsLoading(false);
          return;
        }
        throw new Error(data.error?.message || '조건 평가 내역 조회에 실패했습니다');
      }

      setEvaluations(data.evaluations || []);
      setActiveStrategies(data.activeStrategies || 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(message);
      console.error('Failed to fetch condition evaluations:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and periodic updates
  useEffect(() => {
    fetchEvaluations();

    // Poll every 5 seconds for real-time condition monitoring
    const interval = setInterval(fetchEvaluations, 5000);

    return () => clearInterval(interval);
  }, [fetchEvaluations]);

  return {
    evaluations,
    isLoading,
    error,
    activeStrategies,
    refetch: fetchEvaluations
  };
}
