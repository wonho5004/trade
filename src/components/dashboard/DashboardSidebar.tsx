'use client';

import { useState, useEffect } from 'react';
import { ChartControlPanel } from '@/components/chart/ChartControlPanel';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';

interface Strategy {
  id: string;
  name: string;
  description?: string;
  settings: unknown;
  created_at: string;
  updated_at: string;
}

interface Balance {
  asset: string;
  walletBalance: string;
  availableBalance: string;
  crossWalletBalance: string;
}

export function DashboardSidebar() {
  const [expandedSection, setExpandedSection] = useState<string>('chart');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [isLoadingStrategies, setIsLoadingStrategies] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<'USDT' | 'USDC'>('USDT');
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const loadSettings = useAutoTradingSettingsStore((state) => state.loadSettings);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? '' : section);
  };

  useEffect(() => {
    const fetchBalances = async () => {
      setIsLoadingBalances(true);
      try {
        const response = await fetch('/api/trading/binance/account');
        if (!response.ok) {
          throw new Error('Failed to fetch balances');
        }
        const data = await response.json();
        setBalances(data.assets || []);
      } catch (error) {
        console.error('Error fetching balances:', error);
        setBalances([]);
      } finally {
        setIsLoadingBalances(false);
      }
    };

    fetchBalances();

    // Update balances every 10 seconds
    const interval = setInterval(fetchBalances, 10000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const fetchStrategies = async () => {
      setIsLoadingStrategies(true);
      setAuthRequired(false);
      try {
        const response = await fetch('/api/strategies');
        if (!response.ok) {
          if (response.status === 401) {
            // Not authenticated
            console.log('Authentication required for strategies');
            setAuthRequired(true);
            setStrategies([]);
            return;
          }
          const errorData = await response.json();
          console.error('Failed to fetch strategies:', errorData);
          setStrategies([]);
          return;
        }
        const data = await response.json();
        setStrategies(data.strategies || []);
      } catch (error) {
        console.error('Error fetching strategies:', error);
        setStrategies([]);
      } finally {
        setIsLoadingStrategies(false);
      }
    };

    if (expandedSection === 'strategy') {
      fetchStrategies();
    }
  }, [expandedSection]);

  const handleStrategySelect = async (strategy: Strategy) => {
    setSelectedStrategy(strategy.id);
    loadSettings(strategy.settings);
  };

  const handleStrategyDelete = async (strategyId: string) => {
    if (!confirm('이 전략을 삭제하시겠습니까?')) {
      return;
    }

    try {
      const response = await fetch(`/api/strategies/${strategyId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to delete strategy:', errorData);
        alert(errorData.error?.message || '전략 삭제에 실패했습니다.');
        return;
      }

      setStrategies(strategies.filter((s) => s.id !== strategyId));
      if (selectedStrategy === strategyId) {
        setSelectedStrategy(null);
      }
    } catch (error) {
      console.error('Error deleting strategy:', error);
      alert('전략 삭제에 실패했습니다.');
    }
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto rounded-lg bg-panel-dark p-3">
      <div className="flex flex-col gap-2">
        <button
          onClick={() => toggleSection('chart')}
          className="flex w-full cursor-pointer items-center justify-between rounded-md bg-background-dark p-2 text-left"
        >
          <span className="font-bold text-sm text-text-main-dark">차트 설정</span>
          <svg
            className={`w-5 h-5 text-text-main-dark transition-transform ${expandedSection === 'chart' ? '' : 'rotate-180'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        {expandedSection === 'chart' && (
          <div className="px-1">
            <ChartControlPanel />
          </div>
        )}
      </div>

      <div className="border-t border-border-dark my-1"></div>

      <button
        onClick={() => toggleSection('strategy')}
        className="flex w-full cursor-pointer items-center justify-between rounded-md bg-background-dark p-2 text-left"
      >
        <span className="font-bold text-sm text-text-main-dark">전략 선택</span>
        <svg
          className={`w-5 h-5 text-text-main-dark transition-transform ${expandedSection === 'strategy' ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expandedSection === 'strategy' && (
        <div className="flex flex-col gap-2 px-1">
          {isLoadingStrategies ? (
            <div className="px-3 py-2 text-xs text-text-secondary-dark">로딩 중...</div>
          ) : authRequired ? (
            <div className="px-3 py-2 text-xs text-text-secondary-dark">로그인이 필요합니다.</div>
          ) : strategies.length > 0 ? (
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {strategies.map((strategy) => (
                <div
                  key={strategy.id}
                  className={`flex items-center justify-between rounded border p-2 text-xs transition ${
                    selectedStrategy === strategy.id
                      ? 'border-positive bg-positive/10'
                      : 'border-border-dark bg-background-dark hover:border-border-dark/50'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className="font-semibold text-text-main-dark cursor-pointer hover:text-positive transition truncate"
                      onClick={() => handleStrategySelect(strategy)}
                    >
                      {strategy.name}
                    </div>
                    {strategy.description && (
                      <div className="text-[10px] text-text-secondary-dark mt-0.5 truncate">
                        {strategy.description}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleStrategyDelete(strategy.id)}
                    className="ml-2 text-text-secondary-dark hover:text-negative transition"
                    title="삭제"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-xs text-text-secondary-dark">저장된 전략이 없습니다.</div>
          )}
        </div>
      )}

      <div className="border-t border-border-dark my-1"></div>

      <button
        onClick={() => toggleSection('advanced')}
        className="flex w-full cursor-pointer items-center justify-between rounded-md bg-background-dark p-2 text-left"
      >
        <span className="font-bold text-sm text-text-main-dark">고급 설정</span>
        <svg
          className={`w-5 h-5 text-text-main-dark transition-transform ${expandedSection === 'advanced' ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expandedSection === 'advanced' && (
        <div className="px-3 py-2 text-xs text-text-secondary-dark">고급 설정 기능 준비 중</div>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <div className="rounded-lg border border-border-dark bg-background-dark p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-text-main-dark">잔고 확인</span>
            <select
              value={selectedAsset}
              onChange={(e) => setSelectedAsset(e.target.value as 'USDT' | 'USDC')}
              className="rounded border border-border-dark bg-panel-dark px-2 py-1 text-xs text-text-main-dark focus:border-positive focus:outline-none"
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
          {isLoadingBalances ? (
            <div className="text-xs text-text-secondary-dark text-center py-2">로딩 중...</div>
          ) : (() => {
            const balance = balances.find((b) => b.asset === selectedAsset);
            if (!balance) {
              return <div className="text-xs text-text-secondary-dark text-center py-2">데이터 없음</div>;
            }
            const wallet = parseFloat(balance.walletBalance || '0');
            const total = parseFloat(balance.crossWalletBalance || '0');
            const free = parseFloat(balance.availableBalance || '0');
            return (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary-dark">Wallet:</span>
                  <span className="font-semibold text-text-main-dark">{wallet.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary-dark">Total:</span>
                  <span className="font-semibold text-text-main-dark">{total.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary-dark">Free:</span>
                  <span className="font-semibold text-text-main-dark">{free.toFixed(2)}</span>
                </div>
              </div>
            );
          })()}
        </div>
        <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-primary text-white gap-2 text-sm font-bold hover:bg-opacity-90 transition">
          자동매매 시작
        </button>
        <button className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-10 bg-negative text-white gap-2 text-sm font-bold hover:bg-opacity-90 transition">
          모든 포지션 종료
        </button>
      </div>
    </div>
  );
}
