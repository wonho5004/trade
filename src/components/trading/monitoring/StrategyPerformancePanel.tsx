'use client';

import { useEffect, useState, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, Activity, Award } from 'lucide-react';

interface StrategyPerformance {
  strategyId: string;
  strategyName: string;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export function StrategyPerformancePanel() {
  const [strategies, setStrategies] = useState<StrategyPerformance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  const fetchStrategiesPerformance = useCallback(async () => {
    setIsLoading(true);
    try {
      // Get active strategies
      const strategiesResponse = await fetch('/api/strategies?active=true');
      const strategiesData = await strategiesResponse.json();

      if (!strategiesResponse.ok) {
        if (strategiesResponse.status === 401) {
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch strategies');
      }

      const activeStrategies = strategiesData.strategies || [];

      // Fetch performance for each strategy
      const performancePromises = activeStrategies.map(async (strategy: any) => {
        try {
          const response = await fetch(`/api/monitoring/pnl-history?period=${selectedPeriod}&strategyId=${strategy.id}`);

          if (!response.ok) {
            return null;
          }

          const data = await response.json();

          return {
            strategyId: strategy.id,
            strategyName: strategy.name,
            ...data.stats,
            sharpeRatio: calculateSharpeRatio(data.timeline),
            maxDrawdown: calculateMaxDrawdown(data.timeline)
          };
        } catch (error) {
          console.error(`Failed to fetch performance for strategy ${strategy.id}:`, error);
          return null;
        }
      });

      const performances = (await Promise.all(performancePromises)).filter(Boolean) as StrategyPerformance[];
      setStrategies(performances);
    } catch (error) {
      console.error('Failed to fetch strategy performance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  // Calculate Sharpe Ratio (simplified)
  const calculateSharpeRatio = (timeline: any[]): number => {
    if (timeline.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < timeline.length; i++) {
      const prevPnl = timeline[i - 1].cumulativePnl;
      const currPnl = timeline[i].cumulativePnl;
      if (prevPnl !== 0) {
        returns.push((currPnl - prevPnl) / Math.abs(prevPnl));
      }
    }

    if (returns.length === 0) return 0;

    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );

    return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // Annualized
  };

  // Calculate Maximum Drawdown
  const calculateMaxDrawdown = (timeline: any[]): number => {
    if (timeline.length === 0) return 0;

    let maxPnl = timeline[0].cumulativePnl;
    let maxDrawdown = 0;

    for (const point of timeline) {
      const pnl = point.cumulativePnl;
      if (pnl > maxPnl) {
        maxPnl = pnl;
      } else {
        const drawdown = ((maxPnl - pnl) / (Math.abs(maxPnl) || 1)) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }

    return maxDrawdown;
  };

  useEffect(() => {
    fetchStrategiesPerformance();
    const interval = setInterval(fetchStrategiesPerformance, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [fetchStrategiesPerformance]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">전략별 성과</h2>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['24h', '7d', '30d', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setSelectedPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedPeriod === p
                  ? 'bg-blue-500/20 text-blue-300'
                  : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-zinc-500">
          전략 성과를 불러오는 중...
        </div>
      ) : strategies.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-12 text-center">
          <p className="text-sm text-zinc-500">활성 전략이 없거나 거래 내역이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-4">
          {strategies.map(strategy => {
            const isProfitable = strategy.totalPnl >= 0;
            const isGoodWinRate = strategy.winRate >= 50;

            return (
              <div
                key={strategy.strategyId}
                className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4"
              >
                {/* Strategy Header */}
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-zinc-100">{strategy.strategyName}</h3>
                    <p className="text-sm text-zinc-500">
                      {strategy.totalTrades}건의 거래
                    </p>
                  </div>

                  <div className={`text-right ${isProfitable ? 'text-emerald-400' : 'text-red-400'}`}>
                    <div className="flex items-center gap-1 text-xl font-bold">
                      {isProfitable ? (
                        <TrendingUp className="h-5 w-5" />
                      ) : (
                        <TrendingDown className="h-5 w-5" />
                      )}
                      {isProfitable ? '+' : ''}${strategy.totalPnl.toFixed(2)}
                    </div>
                    <div className="text-xs">총 손익</div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {/* Win Rate */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                      <Award className="h-3 w-3" />
                      승률
                    </div>
                    <div className={`text-lg font-bold ${
                      isGoodWinRate ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {strategy.winRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-zinc-500">
                      {strategy.winningTrades}승 {strategy.losingTrades}패
                    </div>
                  </div>

                  {/* Profit Factor */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 flex items-center gap-1 text-xs text-zinc-500">
                      <Activity className="h-3 w-3" />
                      Profit Factor
                    </div>
                    <div className={`text-lg font-bold ${
                      strategy.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {strategy.profitFactor > 0 ? strategy.profitFactor.toFixed(2) : 'N/A'}
                    </div>
                  </div>

                  {/* Sharpe Ratio */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 text-xs text-zinc-500">Sharpe Ratio</div>
                    <div className={`text-lg font-bold ${
                      strategy.sharpeRatio >= 1 ? 'text-emerald-400' :
                      strategy.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {strategy.sharpeRatio.toFixed(2)}
                    </div>
                  </div>

                  {/* Max Drawdown */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 text-xs text-zinc-500">Max DD</div>
                    <div className={`text-lg font-bold ${
                      strategy.maxDrawdown < 10 ? 'text-emerald-400' :
                      strategy.maxDrawdown < 20 ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      -{strategy.maxDrawdown.toFixed(1)}%
                    </div>
                  </div>

                  {/* Avg Win */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 text-xs text-zinc-500">평균 수익</div>
                    <div className="text-sm font-semibold text-emerald-400">
                      +${strategy.avgWin.toFixed(2)}
                    </div>
                  </div>

                  {/* Avg Loss */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 text-xs text-zinc-500">평균 손실</div>
                    <div className="text-sm font-semibold text-red-400">
                      -${strategy.avgLoss.toFixed(2)}
                    </div>
                  </div>

                  {/* Risk/Reward */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 text-xs text-zinc-500">Risk/Reward</div>
                    <div className={`text-sm font-semibold ${
                      strategy.avgLoss > 0 && (strategy.avgWin / strategy.avgLoss) >= 1
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}>
                      {strategy.avgLoss > 0 ? (strategy.avgWin / strategy.avgLoss).toFixed(2) : 'N/A'}
                    </div>
                  </div>

                  {/* Expectancy */}
                  <div className="rounded-md border border-zinc-700 bg-zinc-800/50 p-2.5">
                    <div className="mb-1 text-xs text-zinc-500">기대값</div>
                    <div className={`text-sm font-semibold ${
                      strategy.totalTrades > 0 && (strategy.totalPnl / strategy.totalTrades) > 0
                        ? 'text-emerald-400'
                        : 'text-red-400'
                    }`}>
                      {strategy.totalTrades > 0
                        ? `$${(strategy.totalPnl / strategy.totalTrades).toFixed(2)}`
                        : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
