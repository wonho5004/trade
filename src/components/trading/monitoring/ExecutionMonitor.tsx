'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, AlertCircle, CheckCircle, XCircle, Activity, Clock, Zap } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface ExecutionLog {
  id: string;
  timestamp: number;
  level: 'info' | 'warning' | 'error' | 'success';
  category: 'engine' | 'condition' | 'order' | 'market' | 'system';
  message: string;
  details?: any;
}

interface ExecutionStats {
  totalEvaluations: number;
  successfulOrders: number;
  failedOrders: number;
  activePositions: number;
  lastEvaluation: number | null;
  engineRunning: boolean;
  engineMode: string;
  avgEvaluationTime: number;
}

export function ExecutionMonitor() {
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [stats, setStats] = useState<ExecutionStats>({
    totalEvaluations: 0,
    successfulOrders: 0,
    failedOrders: 0,
    activePositions: 0,
    lastEvaluation: null,
    engineRunning: false,
    engineMode: 'idle',
    avgEvaluationTime: 0
  });
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [authError, setAuthError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // SSE로 실시간 로그 스트리밍
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let eventSource: EventSource | null = null;
    let isComponentMounted = true;

    const connectToLogs = async () => {
      if (!isComponentMounted) return;

      try {
        setRetryCount(prev => prev + 1);

        // 서버에서 SSE 연결용 토큰 가져오기
        console.log(`SSE 토큰 요청 중... (시도 ${retryCount + 1})`);
        const tokenResponse = await fetch('/api/trading/engine/logs/token');

        if (!tokenResponse.ok) {
          console.log(`토큰 요청 실패: ${tokenResponse.status}`);

          // 로그인 상태 확인
          const supabase = getSupabaseBrowserClient();
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            console.log('사용자는 로그인 상태이지만 토큰을 가져올 수 없음:', userData.user.email);

            // 세션 리프레시 시도
            const { data: refreshData } = await supabase.auth.refreshSession();
            if (refreshData?.session) {
              console.log('세션 리프레시 성공, 다시 시도...');
            }
          }

          setAuthError(true);
          setIsConnected(false);
          // 점진적으로 재시도 간격 증가 (최대 10초)
          const delay = Math.min(3000 + (retryCount * 1000), 10000);
          reconnectTimeout = setTimeout(() => {
            if (isComponentMounted) {
              connectToLogs();
            }
          }, delay);
          return;
        }

        const { token } = await tokenResponse.json();

        if (!token) {
          console.log('토큰이 응답에 없습니다');
          setAuthError(true);
          setIsConnected(false);
          // 재시도
          const delay = Math.min(3000 + (retryCount * 1000), 10000);
          reconnectTimeout = setTimeout(() => {
            if (isComponentMounted) {
              connectToLogs();
            }
          }, delay);
          return;
        }

        console.log('SSE 토큰 획득 성공');

        // 인증 성공 시 에러 상태 초기화
        setAuthError(false);
        setRetryCount(0); // 재시도 카운터 리셋

        // 토큰을 쿼리 파라미터로 전달 - URL 인코딩 적용
        const encodedToken = encodeURIComponent(token);
        console.log('인코딩된 토큰으로 SSE 연결 시도 중...');
        const es = new EventSource(`/api/trading/engine/logs/stream?token=${encodedToken}`);
        eventSource = es;
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
          console.log('로그 스트림 연결됨');
        };

        es.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            if (data.type === 'log') {
              const newLog: ExecutionLog = {
                id: `${Date.now()}-${Math.random()}`,
                timestamp: Date.now(),
                level: data.level || 'info',
                category: data.category || 'system',
                message: data.message,
                details: data.details
              };

              setLogs(prev => [...prev, newLog].slice(-500)); // 최대 500개 로그 유지
            } else if (data.type === 'stats') {
              setStats(data.stats);
            }
          } catch (err) {
            console.error('로그 파싱 오류:', err);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          console.error('로그 스트림 연결 오류');
          es.close();

          // 5초 후 재연결 시도
          if (isComponentMounted) {
            reconnectTimeout = setTimeout(() => {
              if (isComponentMounted) {
                connectToLogs();
              }
            }, 5000);
          }
        };
      } catch (err) {
        console.error('로그 스트림 생성 오류:', err);
        setIsConnected(false);
      }
    };

    // Supabase auth 상태 변화 구독
    const supabase = getSupabaseBrowserClient();

    // 컴포넌트 마운트 후 짧은 지연 후 연결 시도 (Supabase 클라이언트 초기화 대기)
    const initialConnectTimeout = setTimeout(() => {
      if (isComponentMounted) {
        connectToLogs();
      }
    }, 100);

    // Auth 상태 변화 감지
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth 상태 변경:', event, '세션 있음:', !!session);

      if (event === 'SIGNED_IN' && session) {
        // 로그인 시 재연결
        if (eventSource) {
          eventSource.close();
        }
        setAuthError(false);
        connectToLogs();
      } else if (event === 'SIGNED_OUT') {
        // 로그아웃 시 연결 해제
        if (eventSource) {
          eventSource.close();
        }
        setIsConnected(false);
        setAuthError(true);
        setLogs([]);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // 토큰 갱신 시 재연결
        console.log('토큰이 갱신되었습니다. 재연결 중...');
        if (eventSource) {
          eventSource.close();
        }
        connectToLogs();
      }
    });

    return () => {
      isComponentMounted = false;
      clearTimeout(initialConnectTimeout);
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (eventSource) {
        eventSource.close();
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // 통계 정기 업데이트
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // 쿠키를 통해 인증된 요청 (서버에서 쿠키 확인)
        const response = await fetch('/api/trading/engine/stats', {
          credentials: 'include' // 쿠키 포함
        });

        if (response.ok) {
          const data = await response.json();
          setStats(data);
        } else if (response.status === 401) {
          // 인증 실패 시 토큰 방식 시도
          const tokenResponse = await fetch('/api/trading/engine/logs/token');
          if (tokenResponse.ok) {
            const { token } = await tokenResponse.json();
            if (token) {
              const statsResponse = await fetch('/api/trading/engine/stats', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              if (statsResponse.ok) {
                const data = await statsResponse.json();
                setStats(data);
              }
            }
          }
        }
      } catch (err) {
        console.error('통계 조회 오류:', err);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // 자동 스크롤
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    return log.level === filter;
  });

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-emerald-400" />;
      default:
        return <Activity className="w-4 h-4 text-blue-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'success':
        return 'text-emerald-400';
      default:
        return 'text-blue-400';
    }
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* 상태 바 */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">실행 모니터</h2>
          <div className="flex items-center gap-2 ml-4">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm text-zinc-400">
              {isConnected ? '실시간 연결됨' : '연결 끊김'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-3 py-1 text-sm rounded ${
              autoScroll
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
            }`}
          >
            자동 스크롤
          </button>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="px-3 py-1 text-sm bg-zinc-800 text-zinc-300 rounded border border-zinc-700"
          >
            <option value="all">모든 로그</option>
            <option value="error">에러</option>
            <option value="warning">경고</option>
            <option value="info">정보</option>
          </select>
        </div>
      </div>

      {/* 통계 패널 */}
      <div className="grid grid-cols-6 gap-4 p-4 border-b border-zinc-800">
        <div className="bg-zinc-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-zinc-500">총 평가</span>
          </div>
          <div className="text-lg font-semibold text-zinc-100">
            {stats.totalEvaluations.toLocaleString()}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-zinc-500">성공 주문</span>
          </div>
          <div className="text-lg font-semibold text-emerald-400">
            {stats.successfulOrders}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="w-4 h-4 text-red-400" />
            <span className="text-xs text-zinc-500">실패 주문</span>
          </div>
          <div className="text-lg font-semibold text-red-400">
            {stats.failedOrders}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-zinc-500">활성 포지션</span>
          </div>
          <div className="text-lg font-semibold text-blue-400">
            {stats.activePositions}
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span className="text-xs text-zinc-500">엔진 상태</span>
          </div>
          <div className="text-lg font-semibold text-zinc-100">
            <span className={stats.engineRunning ? 'text-emerald-400' : 'text-zinc-500'}>
              {stats.engineRunning ? '실행 중' : '중지'}
            </span>
            <span className="text-xs text-zinc-400 ml-2">
              ({stats.engineMode})
            </span>
          </div>
        </div>

        <div className="bg-zinc-900 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-zinc-500">평균 평가시간</span>
          </div>
          <div className="text-lg font-semibold text-zinc-100">
            {stats.avgEvaluationTime.toFixed(0)}ms
          </div>
        </div>
      </div>

      {/* 로그 패널 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-sm">
        {authError ? (
          <div className="text-center py-8">
            <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
            <div className="text-zinc-300 font-medium mb-2">
              인증 세션 확인 중...
              {retryCount > 0 && (
                <span className="text-zinc-400 text-sm ml-2">(시도 {retryCount})</span>
              )}
            </div>
            <div className="text-zinc-500 text-sm">
              실시간 로그 연결을 위해 인증 상태를 확인하고 있습니다.
              <br />
              이미 로그인된 상태라면 잠시 후 자동으로 연결됩니다.
              <br />
              {Math.min(3 + retryCount, 10)}초 후 자동으로 재연결을 시도합니다.
            </div>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded-md transition-colors"
            >
              페이지 새로고침
            </button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            로그가 없습니다. 실행 엔진이 작동하면 여기에 로그가 표시됩니다.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-3 py-1 px-2 hover:bg-zinc-900/50 rounded"
            >
              <div className="flex-shrink-0 mt-0.5">
                {getLevelIcon(log.level)}
              </div>
              <div className="flex-shrink-0 text-zinc-600 text-xs">
                {new Date(log.timestamp).toLocaleTimeString()}
              </div>
              <div className="flex-shrink-0">
                <span className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                  {log.category}
                </span>
              </div>
              <div className={`flex-1 ${getLevelColor(log.level)}`}>
                {log.message}
                {log.details && (
                  <div className="mt-1 text-xs text-zinc-600">
                    {JSON.stringify(log.details, null, 2)}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
}