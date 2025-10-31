'use client';

import React, { useState, useEffect } from 'react';
import { Play, Pause, RefreshCw, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import type { ConditionNode, IndicatorConditions } from '@/types/trading/auto-trading';
import { evaluateConditions } from '@/lib/trading/engine/conditions';
import { getMarketDataService } from '@/lib/trading/market-data/MarketDataService';
import { IndicatorCalculator } from '@/lib/trading/evaluation/IndicatorCalculator';
import { getIndicatorEngine } from '@/lib/trading/indicators/IndicatorEngine';

interface SimulationResult {
  timestamp: number;
  symbol: string;
  condition: string;
  result: boolean;
  details: Record<string, any>;
  error?: string;
}

interface Props {
  conditions: IndicatorConditions | null;
  symbol?: string;
  timeframe?: string;
}

export function ConditionSimulator({ conditions, symbol = 'BTCUSDT', timeframe = '15m' }: Props) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [indicators, setIndicators] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  // 실시간 데이터 시뮬레이션
  useEffect(() => {
    if (!isRunning || !conditions) return;

    const marketData = getMarketDataService();
    const calculator = new IndicatorCalculator();
    const indicatorEngine = getIndicatorEngine();

    const interval = setInterval(async () => {
      try {
        // 현재 시장 데이터 가져오기
        const price = marketData.getCurrentPrice(symbol);
        if (!price) {
          setError('시장 데이터를 가져올 수 없습니다');
          return;
        }
        setCurrentPrice(price);

        // 캔들 데이터 가져오기
        const candles = marketData.getLatestCandles(symbol, timeframe, 100);
        if (!candles || candles.length === 0) {
          setError('캔들 데이터가 없습니다');
          return;
        }

        // 지표 계산을 위한 데이터 준비
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // 지표 신호 맵 생성
        const indicatorSignals: Record<string, boolean> = {};

        // 각 조건에 대한 지표 계산 및 평가
        const processNode = async (node: ConditionNode) => {
          if (node.type === 'indicator') {
            // 지표 평가 로직
            const result = await calculator.evaluateIndicator(
              node,
              symbol,
              timeframe,
              candles[candles.length - 1],
              candles[candles.length - 2]
            );
            indicatorSignals[node.id] = result.signal;
          } else if (node.type === 'group' && node.conditions) {
            for (const child of node.conditions) {
              await processNode(child);
            }
          }
        };

        if (conditions) {
          await processNode(conditions);
        }

        // 전체 지표 값 계산 (디스플레이용)
        const calculatedIndicators: Record<string, any> = {};

        // RSI
        const rsi = indicatorEngine.calculateRSI(closes, 14);
        if (rsi !== null) calculatedIndicators.rsi = rsi;

        // MA
        const ma20 = indicatorEngine.calculateSMA(closes, 20);
        if (ma20 !== null) calculatedIndicators.ma20 = ma20;

        setIndicators(calculatedIndicators);

        // 조건 평가
        const evaluationContext = {
          symbol,
          direction: 'long' as const,
          candleCurrent: candles[candles.length - 1],
          candlePrevious: candles[candles.length - 2]
        };

        const evaluationResult = evaluateConditions(
          conditions,
          evaluationContext,
          { indicatorSignals }
        );

        // 결과 저장
        const newResult: SimulationResult = {
          timestamp: Date.now(),
          symbol,
          condition: formatCondition(conditions),
          result: evaluationResult,
          details: {
            price,
            indicators: calculatedIndicators,
            candle: candles[candles.length - 1]
          }
        };

        setResults(prev => [newResult, ...prev.slice(0, 49)]); // 최대 50개 유지
        setError(null);
      } catch (err) {
        console.error('시뮬레이션 오류:', err);
        setError(err instanceof Error ? err.message : '시뮬레이션 오류');
      }
    }, 2000); // 2초마다 평가

    return () => clearInterval(interval);
  }, [isRunning, conditions, symbol, timeframe]);

  const formatCondition = (condition: IndicatorConditions): string => {
    if (!condition) return '조건 없음';

    const formatNode = (node: ConditionNode): string => {
      if (node.type === 'group') {
        if (!node.conditions || node.conditions.length === 0) return '빈 그룹';
        const formatted = node.conditions.map(formatNode).filter(s => s !== '');
        return formatted.length > 1 ? `(${formatted.join(` ${node.operator} `)})` : formatted[0] || '';
      } else if (node.type === 'indicator') {
        return `${node.indicator} ${node.comparator} ${node.value}`;
      } else if (node.type === 'candle') {
        return `${node.field} ${node.comparator} ${node.value}`;
      }
      return '';
    };

    return formatNode(condition);
  };

  const handleStart = () => {
    setIsRunning(true);
    setResults([]);
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setResults([]);
    setIndicators({});
    setError(null);
  };

  return (
    <div className="space-y-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-zinc-100">조건 시뮬레이터</h3>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!conditions}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              시작
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600"
            >
              <Pause className="w-4 h-4" />
              중지
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 bg-zinc-700 text-zinc-200 rounded-md hover:bg-zinc-600"
          >
            <RefreshCw className="w-4 h-4" />
            초기화
          </button>
        </div>
      </div>

      {/* 현재 상태 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-800 p-3 rounded">
          <div className="text-xs text-zinc-400 mb-1">심볼</div>
          <div className="text-sm font-medium text-zinc-100">{symbol}</div>
        </div>
        <div className="bg-zinc-800 p-3 rounded">
          <div className="text-xs text-zinc-400 mb-1">현재가</div>
          <div className="text-sm font-medium text-zinc-100">
            {currentPrice ? `$${currentPrice.toLocaleString()}` : '-'}
          </div>
        </div>
        <div className="bg-zinc-800 p-3 rounded">
          <div className="text-xs text-zinc-400 mb-1">타임프레임</div>
          <div className="text-sm font-medium text-zinc-100">{timeframe}</div>
        </div>
      </div>

      {/* 지표 값 */}
      {Object.keys(indicators).length > 0 && (
        <div className="bg-zinc-800 p-3 rounded">
          <div className="text-xs text-zinc-400 mb-2">현재 지표 값</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {Object.entries(indicators).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-zinc-400">{key}:</span>
                <span className="text-zinc-100 font-medium">
                  {typeof value === 'number' ? value.toFixed(2) : value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-900/20 border border-red-800 rounded">
          <AlertCircle className="w-4 h-4 text-red-400" />
          <span className="text-sm text-red-300">{error}</span>
        </div>
      )}

      {/* 평가 결과 */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-zinc-300">평가 결과</div>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {results.length === 0 ? (
            <div className="text-sm text-zinc-500 text-center py-4">
              시뮬레이션을 시작하면 결과가 여기에 표시됩니다
            </div>
          ) : (
            results.map((result, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-2 rounded ${
                  result.result ? 'bg-emerald-900/20' : 'bg-zinc-800'
                }`}
              >
                <div className="flex-shrink-0">
                  {result.result ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-xs text-zinc-400">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </div>
                  <div className="text-sm text-zinc-200">
                    {result.condition}
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {result.result ? (
                    <span className="text-emerald-400">충족</span>
                  ) : (
                    <span className="text-zinc-500">미충족</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}