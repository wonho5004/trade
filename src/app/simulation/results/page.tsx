'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, BarChart3, Clock, Target, AlertCircle } from 'lucide-react';

interface SimulationSession {
  id: string;
  name: string;
  description: string | null;
  strategyName: string;
  initialCapital: number;
  currentCapital: number;
  totalPnL: number;
  roi: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  dailyAvgRoi: number | null;
  maxDrawdown: number | null;
  sharpeRatio: number | null;
  status: string;
  mode: string;
  startedAt: string;
  completedAt: string | null;
  durationHours: number;
  planDurationHours: number | null;
}

interface SessionDetail {
  session: SimulationSession & {
    durationMinutes: number;
  };
  trades: Array<{
    id: string;
    symbol: string;
    side: string;
    action: string;
    entryPrice: number | null;
    exitPrice: number | null;
    quantity: number;
    pnl: number | null;
    pnlPercentage: number | null;
    holdingTimeMinutes: number | null;
    entryTime: string | null;
    exitTime: string | null;
    indicators: any;
  }>;
  symbolResults: Array<{
    symbol: string;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;
    totalPnL: number;
    roi: number;
  }>;
  errors: Array<{
    id: string;
    errorType: string;
    errorMessage: string;
    errorDetails: any;
    symbol: string | null;
    occurredAt: string;
  }>;
}

export default function SimulationResultsPage() {
  const [sessions, setSessions] = useState<SimulationSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<SessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 세션 목록 조회
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/simulation/sessions?limit=50');
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || '세션 목록 조회 실패');
      }

      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoading(false);
    }
  };

  // 세션 상세 조회
  const fetchSessionDetail = async (sessionId: string) => {
    try {
      setIsLoadingDetail(true);
      const response = await fetch(`/api/simulation/sessions/${sessionId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || '세션 상세 조회 실패');
      }

      setSelectedSession(data);
    } catch (err) {
      console.error('Failed to fetch session detail:', err);
      setError(err instanceof Error ? err.message : '알 수 없는 오류');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="py-12 text-center text-zinc-400">
          시뮬레이션 결과를 불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="rounded-lg border border-red-800 bg-red-950/30 p-4 text-red-400">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-2xl font-bold text-zinc-100">시뮬레이션 결과</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 세션 목록 */}
        <div className="lg:col-span-1">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
            <h2 className="mb-4 text-lg font-semibold text-zinc-100">세션 목록</h2>

            {sessions.length === 0 ? (
              <div className="py-8 text-center text-sm text-zinc-500">
                시뮬레이션 결과가 없습니다
              </div>
            ) : (
              <div className="space-y-2">
                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => fetchSessionDetail(session.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedSession?.session.id === session.id
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700 hover:bg-zinc-800'
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <div className="font-medium text-zinc-100">{session.name}</div>
                      <div className={`text-sm font-semibold ${
                        session.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {formatPercent(session.roi)}
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400">{session.strategyName}</div>
                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                      <span>{session.totalTrades} 거래</span>
                      <span>{new Date(session.startedAt).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 세션 상세 */}
        <div className="lg:col-span-2">
          {isLoadingDetail ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
              <div className="py-12 text-center text-zinc-400">
                상세 정보를 불러오는 중...
              </div>
            </div>
          ) : selectedSession ? (
            <div className="space-y-6">
              {/* 요약 통계 */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-1 text-xs text-zinc-400">총 손익</div>
                  <div className={`text-xl font-bold ${
                    selectedSession.session.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(selectedSession.session.totalPnL)}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {formatPercent(selectedSession.session.roi)}
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-1 text-xs text-zinc-400">승률</div>
                  <div className="text-xl font-bold text-zinc-100">
                    {selectedSession.session.winRate.toFixed(2)}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {selectedSession.session.winningTrades}승 / {selectedSession.session.losingTrades}패
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-1 text-xs text-zinc-400">일평균 수익률</div>
                  <div className="text-xl font-bold text-zinc-100">
                    {selectedSession.session.dailyAvgRoi?.toFixed(2) || '0.00'}%
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {selectedSession.session.durationHours}시간 {selectedSession.session.durationMinutes}분
                  </div>
                </div>

                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <div className="mb-1 text-xs text-zinc-400">총 거래</div>
                  <div className="text-xl font-bold text-zinc-100">
                    {selectedSession.session.totalTrades}
                  </div>
                  <div className="mt-1 text-xs text-zinc-500">
                    자본금: {formatCurrency(selectedSession.session.initialCapital)}
                  </div>
                </div>
              </div>

              {/* 종목별 결과 */}
              {selectedSession.symbolResults.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="mb-4 text-lg font-semibold text-zinc-100">종목별 결과</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="pb-2 text-left font-medium text-zinc-400">종목</th>
                          <th className="pb-2 text-right font-medium text-zinc-400">거래</th>
                          <th className="pb-2 text-right font-medium text-zinc-400">승률</th>
                          <th className="pb-2 text-right font-medium text-zinc-400">손익</th>
                          <th className="pb-2 text-right font-medium text-zinc-400">ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSession.symbolResults.map((result) => (
                          <tr key={result.symbol} className="border-b border-zinc-800/50">
                            <td className="py-2 text-zinc-100">{result.symbol}</td>
                            <td className="py-2 text-right text-zinc-300">{result.totalTrades}</td>
                            <td className="py-2 text-right text-zinc-300">{result.winRate.toFixed(1)}%</td>
                            <td className={`py-2 text-right font-medium ${
                              result.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(result.totalPnL)}
                            </td>
                            <td className={`py-2 text-right font-medium ${
                              result.roi >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatPercent(result.roi)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 거래 내역 */}
              {selectedSession.trades.length > 0 && (
                <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                  <h3 className="mb-4 text-lg font-semibold text-zinc-100">거래 내역</h3>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {selectedSession.trades.map((trade) => (
                      <div
                        key={trade.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-zinc-100">{trade.symbol}</span>
                            <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                              trade.side === 'LONG'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}>
                              {trade.side}
                            </span>
                            <span className="text-xs text-zinc-500">{trade.action}</span>
                          </div>
                          {trade.pnl !== null && (
                            <div className={`font-semibold ${
                              trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(trade.pnl)}
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-zinc-400">
                          {trade.entryPrice && (
                            <div>진입가: {formatCurrency(trade.entryPrice)}</div>
                          )}
                          {trade.exitPrice && (
                            <div>청산가: {formatCurrency(trade.exitPrice)}</div>
                          )}
                          <div>수량: {trade.quantity.toFixed(4)}</div>
                          {trade.holdingTimeMinutes && (
                            <div>보유시간: {trade.holdingTimeMinutes}분</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 에러 로그 */}
              {selectedSession.errors.length > 0 && (
                <div className="rounded-lg border border-red-800 bg-red-950/30 p-4">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-400">
                    <AlertCircle className="h-5 w-5" />
                    에러 로그
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {selectedSession.errors.map((error) => (
                      <div
                        key={error.id}
                        className="rounded-lg border border-red-800/50 bg-red-950/20 p-3"
                      >
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium text-red-300">{error.errorType}</span>
                          <span className="text-xs text-red-400">
                            {new Date(error.occurredAt).toLocaleString('ko-KR')}
                          </span>
                        </div>
                        <div className="text-sm text-red-200">{error.errorMessage}</div>
                        {error.symbol && (
                          <div className="mt-1 text-xs text-red-400">종목: {error.symbol}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
              <div className="py-12 text-center text-zinc-400">
                세션을 선택하여 상세 결과를 확인하세요
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
