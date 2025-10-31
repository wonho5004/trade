'use client';

import { useState, useEffect } from 'react';
import { Layers, Clock, CheckCircle, Zap, TrendingUp, Play, Timer } from 'lucide-react';
import type { Strategy } from '@/types/trading/strategy';

interface EngineStatus {
  isRunning: boolean;
  mode: string;
  simulation: {
    startTime: number;
    durationHours?: number;
  } | null;
}

export function ActiveStrategyPanel() {
  const [activeStrategy, setActiveStrategy] = useState<Strategy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluationCount, setEvaluationCount] = useState(0);
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [simulationElapsed, setSimulationElapsed] = useState(0);
  const [runtimeStats, setRuntimeStats] = useState({
    nextEvaluationIn: 0,
    averageEvaluationTime: 0,
    successRate: 100
  });

  // 타임프레임을 초 단위로 변환
  const getTimeframeSeconds = (timeframe: string): number => {
    const map: Record<string, number> = {
      '1m': 60,
      '3m': 180,
      '5m': 300,
      '15m': 900,
      '30m': 1800,
      '1h': 3600,
      '2h': 7200,
      '4h': 14400,
      '6h': 21600,
      '8h': 28800,
      '12h': 43200,
      '1d': 86400
    };
    return map[timeframe] || 900; // 기본값 15분
  };

  // 시간 포맷팅 (HH:MM:SS 또는 MM:SS)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${minutes}:${String(secs).padStart(2, '0')}`;
  };

  const fetchActiveStrategy = async () => {
    try {
      const response = await fetch('/api/strategies?active=true');

      if (!response.ok) {
        // 401 에러는 조용히 처리 (로그인 필요)
        if (response.status === 401) {
          setError(null);
          setIsLoading(false);
          return;
        }
        console.error(`[ActiveStrategy] Failed to fetch: ${response.status} ${response.statusText}`);
        const errorData = await response.json().catch(() => null);
        if (errorData) {
          console.error('[ActiveStrategy] Error details:', errorData);
        }
        throw new Error(`활성 전략 조회 실패 (${response.status})`);
      }

      const data = await response.json();
      const active = data.strategies?.[0] || null;
      setActiveStrategy(active);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch active strategy:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvaluationCount = async (strategyId: string) => {
    try {
      const response = await fetch('/api/monitoring/condition-evaluations?limit=1000');

      if (!response.ok) {
        if (response.status === 401) return;
        console.error(`[EvaluationCount] Failed to fetch: ${response.status} ${response.statusText}`);
        const errorData = await response.json().catch(() => null);
        if (errorData) {
          console.error('[EvaluationCount] Error details:', errorData);
        }
        return; // Don't throw, just return silently
      }

      const data = await response.json();
      // 해당 전략의 평가만 카운트
      const count = data.evaluations?.filter((e: any) => e.strategy_id === strategyId).length || 0;
      setEvaluationCount(count);
    } catch (err) {
      console.error('Failed to fetch evaluation count:', err);
    }
  };

  const fetchEngineStatus = async () => {
    try {
      const response = await fetch('/api/trading/engine');

      if (!response.ok) {
        if (response.status === 401) return;
        console.error(`[EngineStatus] Failed to fetch: ${response.status} ${response.statusText}`);
        const errorData = await response.json().catch(() => null);
        if (errorData) {
          console.error('[EngineStatus] Error details:', errorData);
        }
        return; // Don't throw, just return silently
      }

      const data = await response.json();
      setEngineStatus(data.status);
    } catch (err) {
      console.error('Failed to fetch engine status:', err);
    }
  };

  const handleForceEvaluation = async () => {
    if (isEvaluating) return;

    try {
      setIsEvaluating(true);
      const response = await fetch('/api/trading/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'force-evaluation' })
      });

      const data = await response.json();

      if (data.success) {
        console.log(`✅ 평가 완료: ${data.evaluatedSymbols}개 심볼`);
        // 평가 횟수 갱신
        if (activeStrategy) {
          fetchEvaluationCount(activeStrategy.id);
        }
      } else {
        console.error('평가 실패:', data.message);
        setError(data.message);
      }
    } catch (err) {
      console.error('Failed to force evaluation:', err);
      setError(err instanceof Error ? err.message : '평가 실행 실패');
    } finally {
      setIsEvaluating(false);
    }
  };

  useEffect(() => {
    fetchActiveStrategy();
    const interval = setInterval(fetchActiveStrategy, 10000);
    return () => clearInterval(interval);
  }, []);

  // 평가 횟수 조회
  useEffect(() => {
    if (activeStrategy) {
      fetchEvaluationCount(activeStrategy.id);
      const interval = setInterval(() => fetchEvaluationCount(activeStrategy.id), 5000);
      return () => clearInterval(interval);
    }
  }, [activeStrategy]);

  // 엔진 상태 조회
  useEffect(() => {
    fetchEngineStatus();
    const interval = setInterval(fetchEngineStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  // 시뮬레이션 경과 시간 업데이트
  useEffect(() => {
    if (engineStatus?.simulation?.startTime) {
      const updateElapsed = () => {
        const elapsed = Date.now() - engineStatus.simulation!.startTime;
        setSimulationElapsed(Math.floor(elapsed / 1000));
      };

      updateElapsed();
      const timer = setInterval(updateElapsed, 1000);
      return () => clearInterval(timer);
    }
  }, [engineStatus?.simulation?.startTime]);

  // 타임프레임 기반 캔들 카운트다운
  useEffect(() => {
    if (!activeStrategy) return;

    const timeframeSeconds = getTimeframeSeconds(activeStrategy.settings.timeframe);

    // 현재 캔들 시작 시간 계산
    const now = Date.now();
    const timeframeMs = timeframeSeconds * 1000;
    const currentCandleStart = Math.floor(now / timeframeMs) * timeframeMs;
    const nextCandleStart = currentCandleStart + timeframeMs;
    const secondsUntilNextCandle = Math.floor((nextCandleStart - now) / 1000);

    // 초기 시간 설정
    setRuntimeStats(prev => ({
      ...prev,
      nextEvaluationIn: secondsUntilNextCandle
    }));

    // 매초 업데이트
    const timer = setInterval(() => {
      const now = Date.now();
      const currentCandleStart = Math.floor(now / timeframeMs) * timeframeMs;
      const nextCandleStart = currentCandleStart + timeframeMs;
      const secondsLeft = Math.floor((nextCandleStart - now) / 1000);

      setRuntimeStats(prev => ({
        ...prev,
        nextEvaluationIn: secondsLeft
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeStrategy]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="py-8 text-center text-zinc-500">
          활성 전략을 불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="rounded-lg border border-red-700/50 bg-red-900/20 p-4">
          <div className="text-sm text-red-200">{error}</div>
        </div>
      </div>
    );
  }

  if (!activeStrategy) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">활성 전략</h2>
        </div>
        <div className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-12 text-center">
          <Layers className="mx-auto h-12 w-12 text-zinc-600" />
          <h3 className="mt-2 text-sm font-semibold text-zinc-400">활성화된 전략이 없습니다</h3>
          <p className="mt-1 text-sm text-zinc-500">
            자동매매 설정에서 전략을 활성화하거나 로직을 생성하세요
          </p>
        </div>
      </div>
    );
  }

  const settings = activeStrategy.settings;
  const monitoringSymbols = settings.symbolSelection.manualSymbols.length > 0
    ? settings.symbolSelection.manualSymbols
    : ['종목 자동 선택 중...'];

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-zinc-100">활성 전략</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleForceEvaluation}
            disabled={isEvaluating}
            className="flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-sm font-medium text-blue-300 transition-colors hover:bg-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className={`h-4 w-4 ${isEvaluating ? 'animate-pulse' : ''}`} />
            {isEvaluating ? '평가 중...' : '평가 실행'}
          </button>
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-emerald-300">실행 중</span>
          </div>
        </div>
      </div>

      {/* Strategy Info */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-zinc-100">{activeStrategy.name}</h3>
            {activeStrategy.description && (
              <p className="mt-1 text-sm text-zinc-400">{activeStrategy.description}</p>
            )}
          </div>
          <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />
        </div>

        {/* Runtime Statistics */}
        <div className="grid gap-2 sm:grid-cols-2 mb-3 pb-3 border-b border-zinc-800">
          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="h-4 w-4 text-yellow-400" />
              <div className="text-xs text-zinc-500">평가 횟수</div>
            </div>
            <div className="text-lg font-semibold text-zinc-200">
              {evaluationCount}회
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-blue-400" />
              <div className="text-xs text-zinc-500">다음 평가까지</div>
            </div>
            <div className="text-lg font-semibold text-blue-300">
              {formatTime(runtimeStats.nextEvaluationIn)}
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-emerald-400" />
              <div className="text-xs text-zinc-500">성공률</div>
            </div>
            <div className="text-lg font-semibold text-emerald-300">
              {runtimeStats.successRate.toFixed(1)}%
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500 mb-1">평균 평가 시간</div>
            <div className="text-lg font-semibold text-zinc-200">
              {runtimeStats.averageEvaluationTime.toFixed(0)}ms
            </div>
          </div>
        </div>

        {/* Strategy Settings */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">레버리지</div>
            <div className="mt-1 text-lg font-semibold text-zinc-200">
              {settings.leverage}x
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">타임프레임</div>
            <div className="mt-1 text-lg font-semibold text-zinc-200">
              {settings.timeframe}
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">포지션 모드</div>
            <div className="mt-1 text-sm font-medium text-zinc-200">
              {settings.positionMode === 'hedge' ? 'Hedge (양방향)' : 'One-Way (단방향)'}
            </div>
          </div>

          <div className="rounded-md border border-zinc-700 bg-zinc-900 p-3">
            <div className="text-xs text-zinc-500">타겟 종목 수</div>
            <div className="mt-1 text-lg font-semibold text-zinc-200">
              {settings.symbolCount}개
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-zinc-700 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-zinc-400" />
            <div className="text-xs text-zinc-500">활성화 시간</div>
          </div>
          <div className="text-sm text-zinc-300">
            {new Date(activeStrategy.created_at).toLocaleString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </div>
        </div>

        {/* Simulation Timer */}
        {engineStatus?.mode === 'simulation' && engineStatus.simulation && (
          <div className="mt-4 rounded-md border border-purple-700 bg-purple-900/20 p-3">
            <div className="flex items-center gap-2 mb-3">
              <Timer className="h-4 w-4 text-purple-400" />
              <div className="text-xs font-medium text-purple-300">시뮬레이션 타이머</div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-zinc-500 mb-1">시작 시간</div>
                <div className="text-sm font-medium text-zinc-300">
                  {new Date(engineStatus.simulation.startTime).toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">경과 시간</div>
                <div className="text-sm font-medium text-purple-300">
                  {formatTime(simulationElapsed)}
                </div>
              </div>
              {engineStatus.simulation.durationHours && (
                <div>
                  <div className="text-xs text-zinc-500 mb-1">남은 시간</div>
                  <div className="text-sm font-medium text-blue-300">
                    {(() => {
                      const totalSeconds = engineStatus.simulation.durationHours * 3600;
                      const remaining = Math.max(0, totalSeconds - simulationElapsed);
                      return formatTime(remaining);
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Monitoring Symbols */}
      <div className="mb-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-300">모니터링 종목 ({monitoringSymbols.length}개)</h3>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
          {monitoringSymbols.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {monitoringSymbols.slice(0, 20).map((symbol, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center rounded-md bg-blue-500/20 px-2.5 py-1 text-xs font-medium text-blue-300 border border-blue-500/30"
                >
                  {symbol}
                </span>
              ))}
              {monitoringSymbols.length > 20 && (
                <span className="inline-flex items-center rounded-md bg-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-400">
                  +{monitoringSymbols.length - 20} 더보기
                </span>
              )}
            </div>
          ) : (
            <div className="text-sm text-zinc-500">
              랭킹 기반 자동 선택 모드
            </div>
          )}
        </div>
      </div>

      {/* Entry/Exit Status */}
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-xs text-zinc-500 mb-2">진입 조건</div>
          <div className="space-y-1 text-xs">
            <div className={`flex items-center gap-2 ${settings.entry.long.enabled ? 'text-emerald-300' : 'text-zinc-600'}`}>
              <div className={`h-2 w-2 rounded-full ${settings.entry.long.enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
              <span>롱: {settings.entry.long.enabled ? 'ON' : 'OFF'}</span>
            </div>
            <div className={`flex items-center gap-2 ${settings.entry.short.enabled ? 'text-rose-300' : 'text-zinc-600'}`}>
              <div className={`h-2 w-2 rounded-full ${settings.entry.short.enabled ? 'bg-rose-500' : 'bg-zinc-600'}`} />
              <span>숏: {settings.entry.short.enabled ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-3">
          <div className="text-xs text-zinc-500 mb-2">청산 조건</div>
          <div className="space-y-1 text-xs">
            <div className={`flex items-center gap-2 ${settings.exit.long.enabled ? 'text-emerald-300' : 'text-zinc-600'}`}>
              <div className={`h-2 w-2 rounded-full ${settings.exit.long.enabled ? 'bg-emerald-500' : 'bg-zinc-600'}`} />
              <span>롱: {settings.exit.long.enabled ? 'ON' : 'OFF'}</span>
            </div>
            <div className={`flex items-center gap-2 ${settings.exit.short.enabled ? 'text-rose-300' : 'text-zinc-600'}`}>
              <div className={`h-2 w-2 rounded-full ${settings.exit.short.enabled ? 'bg-rose-500' : 'bg-zinc-600'}`} />
              <span>숏: {settings.exit.short.enabled ? 'ON' : 'OFF'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
