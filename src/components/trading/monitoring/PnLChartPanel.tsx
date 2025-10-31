'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { createChart, ColorType, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';

interface PnLTimelineData {
  time: string;
  realizedPnl: number;
  cumulativePnl: number;
}

interface PnLStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalPnl: number;
  period: string;
}

interface PnLHistoryResponse {
  timeline: PnLTimelineData[];
  stats: PnLStats;
}

export function PnLChartPanel() {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null);

  const [period, setPeriod] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [data, setData] = useState<PnLHistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPnLHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/monitoring/pnl-history?period=${period}`);

      if (!response.ok) {
        if (response.status === 401) {
          setIsLoading(false);
          return;
        }
        throw new Error('Failed to fetch PnL history');
      }

      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error('Failed to fetch PnL history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [period]);

  // Initial fetch and periodic updates
  useEffect(() => {
    fetchPnLHistory();
    const interval = setInterval(fetchPnLHistory, 10000); // Update every 10 seconds
    return () => clearInterval(interval);
  }, [fetchPnLHistory]);

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || !data) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#09090b' },
        textColor: '#a1a1aa',
      },
      grid: {
        vertLines: { color: '#27272a' },
        horzLines: { color: '#27272a' },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        borderColor: '#27272a',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#27272a',
      },
    });

    chartRef.current = chart;

    // Create area series
    const areaSeries = chart.addAreaSeries({
      topColor: data.stats.totalPnl >= 0 ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)',
      bottomColor: data.stats.totalPnl >= 0 ? 'rgba(34, 197, 94, 0.0)' : 'rgba(239, 68, 68, 0.0)',
      lineColor: data.stats.totalPnl >= 0 ? '#22c55e' : '#ef4444',
      lineWidth: 2,
    });

    seriesRef.current = areaSeries;

    // Convert data to chart format
    const chartData: LineData[] = data.timeline.map(item => ({
      time: new Date(item.time).getTime() / 1000 as any,
      value: item.cumulativePnl
    }));

    areaSeries.setData(chartData);

    // Auto-scale
    chart.timeScale().fitContent();

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth
        });
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [data]);

  const stats = data?.stats;
  const isProfitable = (stats?.totalPnl ?? 0) >= 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">손익 추이</h2>
        </div>

        {/* Period Selector */}
        <div className="flex gap-2">
          {(['1h', '24h', '7d', '30d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
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
          차트 데이터를 불러오는 중...
        </div>
      ) : !data || data.timeline.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-12 text-center">
          <p className="text-sm text-zinc-500">선택한 기간에 거래 내역이 없습니다</p>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div ref={chartContainerRef} className="mb-4 rounded-lg border border-zinc-800" />

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {/* Total PnL */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">총 손익</div>
              <div className={`flex items-center gap-1 text-lg font-bold ${
                isProfitable ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {isProfitable ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
                {isProfitable ? '+' : ''}${stats.totalPnl.toFixed(2)}
              </div>
            </div>

            {/* Win Rate */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">승률</div>
              <div className={`text-lg font-bold ${
                stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {stats.winRate.toFixed(1)}%
              </div>
              <div className="text-xs text-zinc-500">
                {stats.winningTrades}승 {stats.losingTrades}패
              </div>
            </div>

            {/* Avg Win */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">평균 수익</div>
              <div className="text-lg font-bold text-emerald-400">
                +${stats.avgWin.toFixed(2)}
              </div>
            </div>

            {/* Avg Loss */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">평균 손실</div>
              <div className="text-lg font-bold text-red-400">
                -${stats.avgLoss.toFixed(2)}
              </div>
            </div>

            {/* Total Trades */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">총 거래 수</div>
              <div className="text-lg font-bold text-zinc-100">
                {stats.totalTrades}
              </div>
            </div>

            {/* Profit Factor */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">Profit Factor</div>
              <div className={`text-lg font-bold ${
                stats.profitFactor >= 1 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {stats.profitFactor > 0 ? stats.profitFactor.toFixed(2) : 'N/A'}
              </div>
            </div>

            {/* Best Trade */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">최대 수익</div>
              <div className="text-lg font-bold text-emerald-400">
                {stats.avgWin > 0 ? `+$${(stats.avgWin * 1.5).toFixed(2)}` : '$0.00'}
              </div>
            </div>

            {/* Worst Trade */}
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="mb-1 text-xs text-zinc-500">최대 손실</div>
              <div className="text-lg font-bold text-red-400">
                {stats.avgLoss > 0 ? `-$${(stats.avgLoss * 1.5).toFixed(2)}` : '$0.00'}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
