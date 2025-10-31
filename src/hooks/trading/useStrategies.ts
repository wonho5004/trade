'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import type { Strategy, CreateStrategyRequest } from '@/types/trading/strategy';

interface UseStrategiesReturn {
  strategies: Strategy[];
  isLoading: boolean;
  error: string | null;
  saveStrategy: (request: CreateStrategyRequest) => Promise<void>;
  loadStrategy: (strategy: Strategy) => Promise<void>;
  deleteStrategy: (id: string) => Promise<void>;
  refetch: () => Promise<void>;
}

export function useStrategies(): UseStrategiesReturn {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateSettings = useAutoTradingSettingsStore(state => state.updateSettings);

  // Fetch strategies from API
  const fetchStrategies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/strategies');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || '전략 목록을 불러오는데 실패했습니다');
      }

      setStrategies(data.strategies || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
      setError(message);
      console.error('Failed to fetch strategies:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save a new strategy
  const saveStrategy = useCallback(async (request: CreateStrategyRequest) => {
    // Debug logging
    console.log('[useStrategies] Saving strategy with request:', {
      name: request.name,
      description: request.description,
      hasSettings: !!request.settings,
      settingsKeys: request.settings ? Object.keys(request.settings) : [],
      is_active: request.is_active
    });
    console.log('[useStrategies] Full settings object:', request.settings);

    const response = await fetch('/api/strategies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[useStrategies] Save failed:', data);
      throw new Error(data.error?.message || '전략 저장에 실패했습니다');
    }

    console.log('[useStrategies] Save successful:', data);

    // Refetch to update the list
    await fetchStrategies();
  }, [fetchStrategies]);

  // Load a strategy into current settings
  const loadStrategy = useCallback(async (strategy: Strategy) => {
    try {
      // Update the store with strategy settings
      // updateSettings expects an updater function, not the settings object directly
      updateSettings((draft) => {
        // Replace all settings with the loaded strategy's settings
        Object.assign(draft, strategy.settings);
      });

      // Optionally sync localStorage
      localStorage.setItem('last-loaded-strategy', JSON.stringify(strategy));

      console.log('Strategy loaded:', strategy.name);
    } catch (err) {
      console.error('Failed to load strategy:', err);
      throw new Error('전략 불러오기에 실패했습니다');
    }
  }, [updateSettings]);

  // Delete a strategy
  const deleteStrategy = useCallback(async (id: string) => {
    const response = await fetch(`/api/strategies/${id}`, {
      method: 'DELETE'
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || '전략 삭제에 실패했습니다');
    }

    // Refetch to update the list
    await fetchStrategies();
  }, [fetchStrategies]);

  // Initial fetch
  useEffect(() => {
    fetchStrategies();
  }, [fetchStrategies]);

  return {
    strategies,
    isLoading,
    error,
    saveStrategy,
    loadStrategy,
    deleteStrategy,
    refetch: fetchStrategies
  };
}
