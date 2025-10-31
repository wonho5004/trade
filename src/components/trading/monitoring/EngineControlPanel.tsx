'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Pause, Square, Activity, AlertTriangle, CheckCircle, XCircle, Zap, BarChart3 } from 'lucide-react';

interface EngineStatus {
  isRunning: boolean;
  mode: 'idle' | 'monitoring' | 'simulation' | 'trading'; // monitoring = 조건 계산만, simulation = 가상 거래, trading = 주문 실행까지
  activeStrategies: number;
  circuitBreakerOpen: boolean;
  consecutiveFailures: number;
  simulation?: {
    initialCapital: number;
    currentCapital: number;
    totalPnL: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    roi: number;
  };
  strategies: Array<{
    id: string;
    name: string;
    evaluationCount: number;
    errorCount: number;
    lastError?: string;
    lastEvaluationTime: number;
  }>;
}

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message?: string;
}

export function EngineControlPanel() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isControlling, setIsControlling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simulationCapital, setSimulationCapital] = useState<number>(10000); // 기본값: $10,000
  const [simulationDuration, setSimulationDuration] = useState<number>(24); // 기본값: 24시간
  const [durationUnit, setDurationUnit] = useState<'hours' | 'days'>('hours'); // 단위: 시간 or 일

  // 단계별 진행 상태
  const [steps, setSteps] = useState<Step[]>([
    { id: 'api', label: 'API 연결 확인', status: 'pending' },
    { id: 'data', label: '실시간 데이터 확인', status: 'pending' },
    { id: 'conditions', label: '조건 계산 시작', status: 'pending' },
    { id: 'orders', label: '주문 실행 대기', status: 'pending' }
  ]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/trading/engine');

      if (!response.ok) {
        if (response.status === 401) {
          setError('로그인이 필요합니다.');
          setIsLoading(false);
          return;
        }
        throw new Error('상태 조회 실패');
      }

      const data = await response.json();
      setStatus(data.status);
      setError(null);

      // 엔진이 실행 중이면 단계 업데이트
      if (data.status.isRunning) {
        updateStepsFromStatus(data.status);
      }
    } catch (err) {
      console.error('Failed to fetch engine status:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  const updateStepsFromStatus = (status: EngineStatus) => {
    setSteps(prev => prev.map(step => {
      if (step.id === 'api') {
        return { ...step, status: 'success', message: 'API 연결됨' };
      }
      if (step.id === 'data') {
        return { ...step, status: 'success', message: '실시간 데이터 수신 중' };
      }
      if (step.id === 'conditions') {
        return { ...step, status: 'success', message: '조건 평가 진행 중' };
      }
      if (step.id === 'orders') {
        if (status.mode === 'trading') {
          return { ...step, status: 'success', message: '주문 실행 활성화' };
        } else {
          return { ...step, status: 'pending', message: '주문 실행 비활성화 (모니터링 모드)' };
        }
      }
      return step;
    }));
  };

  const startEngine = async (mode: 'monitoring' | 'simulation' | 'trading') => {
    setIsControlling(true);
    setError(null);

    try {
      // 단계별 진행 시뮬레이션
      setSteps(prev => prev.map((s, i) =>
        i === 0 ? { ...s, status: 'running', message: 'API 연결 확인 중...' } : s
      ));

      await new Promise(resolve => setTimeout(resolve, 500));

      const requestBody: any = { action: 'start', mode };
      if (mode === 'simulation') {
        requestBody.simulationCapital = simulationCapital;
        // 시뮬레이션 기간을 시간 단위로 변환하여 전송
        const durationInHours = durationUnit === 'hours'
          ? simulationDuration
          : simulationDuration * 24;
        if (simulationDuration > 0) {
          requestBody.durationHours = durationInHours;
        }
      }

      const response = await fetch('/api/trading/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || '엔진 시작 실패');
      }

      // 단계별 성공 처리
      for (let i = 0; i < 4; i++) {
        setSteps(prev => prev.map((s, idx) => {
          if (idx === i) {
            return { ...s, status: 'success', message: `${s.label} 완료` };
          }
          if (idx === i + 1 && i < 3) {
            // 마지막 단계(주문)는 mode에 따라 다르게 처리
            if (i === 2 && mode === 'monitoring') {
              return { ...s, status: 'pending', message: '주문 실행 비활성화됨' };
            }
            return { ...s, status: 'running', message: `${s.label} 중...` };
          }
          return s;
        }));
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      setStatus(data.status);
      await fetchStatus();
    } catch (err) {
      console.error('Failed to start engine:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');

      // 에러 발생 시 현재 단계를 error로 표시
      setSteps(prev => prev.map(s =>
        s.status === 'running' ? { ...s, status: 'error', message: '실패' } : s
      ));
    } finally {
      setIsControlling(false);
    }
  };

  const stopEngine = async () => {
    setIsControlling(true);
    setError(null);

    try {
      const response = await fetch('/api/trading/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || '엔진 중지 실패');
      }

      setStatus(data.status);

      // 모든 단계를 pending으로 초기화
      setSteps(prev => prev.map(s => ({ ...s, status: 'pending', message: undefined })));

      await fetchStatus();
    } catch (err) {
      console.error('Failed to stop engine:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsControlling(false);
    }
  };

  const enableTrading = async () => {
    setIsControlling(true);
    setError(null);

    try {
      const response = await fetch('/api/trading/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable-trading' })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || '주문 실행 활성화 실패');
      }

      setSteps(prev => prev.map(s =>
        s.id === 'orders' ? { ...s, status: 'success', message: '주문 실행 활성화됨' } : s
      ));

      setStatus(data.status);
      await fetchStatus();
    } catch (err) {
      console.error('Failed to enable trading:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsControlling(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading && !status) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="py-8 text-center text-zinc-500">
          엔진 상태를 불러오는 중...
        </div>
      </div>
    );
  }

  // 상태를 불러오지 못한 경우에도 기본 UI 표시
  const isRunning = status?.isRunning || false;
  const isMonitoring = isRunning && status?.mode === 'monitoring';
  const isSimulation = isRunning && status?.mode === 'simulation';
  const isTrading = isRunning && status?.mode === 'trading';

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">실행 엔진 제어</h2>
        </div>

        {status && (
          <div className="flex items-center gap-3">
            <Link
              href="/simulation/results"
              className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-sm font-medium text-purple-300 transition-colors hover:bg-purple-500/20"
            >
              <BarChart3 className="h-4 w-4" />
              시뮬레이션 결과
            </Link>
            {isRunning ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-medium text-emerald-300">
                  {isTrading ? '실시간 거래 중' : isSimulation ? '시뮬레이션 중' : '모니터링 중'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-700 px-3 py-1">
                <div className="h-2 w-2 rounded-full bg-zinc-400" />
                <span className="text-sm font-medium text-zinc-300">중지됨</span>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-700/50 bg-red-900/20 p-4">
          <div className="flex items-center gap-2 text-sm text-red-200">
            <XCircle className="h-4 w-4" />
            {error}
          </div>
        </div>
      )}

      {/* status가 없을 때 기본 시작 버튼 표시 */}
      {!status && !isLoading && (
        <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 p-4">
          <div className="text-sm text-amber-200 mb-4">
            엔진 상태를 확인할 수 없습니다. 엔진을 시작하시겠습니까?
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => startEngine('monitoring')}
              disabled={isControlling}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="h-4 w-4" />
              {isControlling ? '처리 중...' : '모니터링 시작'}
            </button>

            <button
              onClick={() => startEngine('trading')}
              disabled={isControlling}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Zap className="h-4 w-4" />
              {isControlling ? '처리 중...' : '실시간 거래 시작'}
            </button>
          </div>

          {/* 시뮬레이션 모드 */}
          <div className="mt-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
            <div className="mb-2 text-sm font-medium text-purple-300">시뮬레이션 모드</div>
            <div className="mb-3 grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-400">초기 자본금 (USD)</label>
                <input
                  type="number"
                  value={simulationCapital}
                  onChange={(e) => setSimulationCapital(Number(e.target.value))}
                  min="100"
                  step="100"
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">시뮬레이션 기간</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={simulationDuration}
                    onChange={(e) => setSimulationDuration(Number(e.target.value))}
                    min="1"
                    step="1"
                    className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value as 'hours' | 'days')}
                    className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="hours">시간</option>
                    <option value="days">일</option>
                  </select>
                </div>
              </div>
            </div>
            <button
              onClick={() => startEngine('simulation')}
              disabled={isControlling || simulationCapital <= 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="h-4 w-4" />
              {isControlling ? '처리 중...' : '시뮬레이션 시작'}
            </button>
          </div>
        </div>
      )}

      {/* 단계별 진행 상태 */}
      {status && <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-3 text-sm font-medium text-zinc-300">엔진 상태</h3>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {step.status === 'pending' && (
                  <div className="h-6 w-6 rounded-full border-2 border-zinc-700 bg-zinc-800" />
                )}
                {step.status === 'running' && (
                  <div className="h-6 w-6 rounded-full border-2 border-blue-500 bg-blue-500/20 flex items-center justify-center">
                    <div className="h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
                  </div>
                )}
                {step.status === 'success' && (
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                )}
                {step.status === 'error' && (
                  <XCircle className="h-6 w-6 text-red-500" />
                )}
              </div>
              <div className="flex-1">
                <div className={`text-sm font-medium ${
                  step.status === 'success' ? 'text-emerald-300' :
                  step.status === 'error' ? 'text-red-300' :
                  step.status === 'running' ? 'text-blue-300' :
                  'text-zinc-500'
                }`}>
                  {step.label}
                </div>
                {step.message && (
                  <div className="text-xs text-zinc-500">{step.message}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>}

      {status && (
        <>
          {/* Status Cards */}
          <div className="mb-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-sm text-zinc-500">활성 전략</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-100">
                {status.activeStrategies}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-sm text-zinc-500">연속 실패</div>
              <div className={`mt-1 text-2xl font-semibold ${
                status.consecutiveFailures > 0 ? 'text-red-400' : 'text-zinc-100'
              }`}>
                {status.consecutiveFailures}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
              <div className="text-sm text-zinc-500">Circuit Breaker</div>
              <div className="mt-1 flex items-center gap-2">
                {status.circuitBreakerOpen ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <span className="text-sm font-medium text-red-400">열림</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">정상</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 시뮬레이션 결과 */}
          {isSimulation && status.simulation && (
            <div className="mb-4 rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
              <h3 className="mb-3 text-sm font-semibold text-purple-300">시뮬레이션 결과</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <div className="text-xs text-zinc-400">초기 자본</div>
                  <div className="text-lg font-semibold text-zinc-100">
                    ${status.simulation.initialCapital.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">현재 자본</div>
                  <div className={`text-lg font-semibold ${status.simulation.currentCapital >= status.simulation.initialCapital ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${status.simulation.currentCapital.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">총 손익</div>
                  <div className={`text-lg font-semibold ${status.simulation.totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${status.simulation.totalPnL.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">수익률 (ROI)</div>
                  <div className={`text-lg font-semibold ${status.simulation.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    {status.simulation.roi.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">총 거래</div>
                  <div className="text-lg font-semibold text-zinc-100">
                    {status.simulation.totalTrades}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-400">승률</div>
                  <div className={`text-lg font-semibold ${status.simulation.winRate >= 50 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {status.simulation.winRate.toFixed(1)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="space-y-3">
            {/* 엔진 실행 중일 때 */}
            {isRunning && (
              <>
                {/* 중지 버튼 - 가장 상단에 표시 */}
                <button
                  onClick={stopEngine}
                  disabled={isControlling}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                >
                  <Square className="h-5 w-5" />
                  {isControlling ? '처리 중...' : `엔진 중지 (${isTrading ? '실시간 거래' : isSimulation ? '시뮬레이션' : '모니터링'} 모드)`}
                </button>

                {/* 모니터링 모드일 때만 주문 실행 활성화 버튼 표시 */}
                {isMonitoring && (
                  <button
                    onClick={enableTrading}
                    disabled={isControlling}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    {isControlling ? '처리 중...' : '실시간 거래로 전환'}
                  </button>
                )}

                {/* 다른 모드로 전환 안내 */}
                <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                  <p className="text-xs text-zinc-400 text-center">
                    다른 모드로 전환하려면 먼저 엔진을 중지하세요
                  </p>
                </div>
              </>
            )}

            {/* 엔진 중지 상태일 때 */}
            {!isRunning && (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    onClick={() => startEngine('monitoring')}
                    disabled={isControlling}
                    className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    {isControlling ? '처리 중...' : '모니터링 시작'}
                  </button>

                  <button
                    onClick={() => startEngine('trading')}
                    disabled={isControlling}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Zap className="h-4 w-4" />
                    {isControlling ? '처리 중...' : '실시간 거래 시작'}
                  </button>
                </div>

                {/* 시뮬레이션 모드 */}
                <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                  <div className="mb-2 text-sm font-medium text-purple-300">시뮬레이션 모드</div>
                  <p className="mb-3 text-xs text-zinc-400">가상 자본으로 모든 로직을 테스트합니다 (실제 주문 없음)</p>
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">초기 자본금 (USD)</label>
                      <input
                        type="number"
                        value={simulationCapital}
                        onChange={(e) => setSimulationCapital(Number(e.target.value))}
                        min="100"
                        step="100"
                        className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-zinc-400">시뮬레이션 기간</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={simulationDuration}
                          onChange={(e) => setSimulationDuration(Number(e.target.value))}
                          min="1"
                          step="1"
                          className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        />
                        <select
                          value={durationUnit}
                          onChange={(e) => setDurationUnit(e.target.value as 'hours' | 'days')}
                          className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="hours">시간</option>
                          <option value="days">일</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => startEngine('simulation')}
                    disabled={isControlling || simulationCapital <= 0}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    {isControlling ? '처리 중...' : '시뮬레이션 시작'}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Strategy Status List */}
          {status.strategies.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-zinc-300">전략 상태</h3>
              <div className="space-y-2">
                {status.strategies.map(strategy => (
                  <div
                    key={strategy.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-zinc-100">{strategy.name}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          평가: {strategy.evaluationCount}회 | 에러: {strategy.errorCount}회
                          {strategy.lastEvaluationTime > 0 && (
                            <> | 마지막: {new Date(strategy.lastEvaluationTime).toLocaleTimeString('ko-KR')}</>
                          )}
                        </div>
                      </div>
                      {strategy.errorCount > 0 && (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                    {strategy.lastError && (
                      <div className="mt-2 text-xs text-red-400">
                        마지막 에러: {strategy.lastError}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
