'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { FileText, CheckCircle, XCircle, AlertTriangle, Info, ChevronDown, ChevronRight } from 'lucide-react';
import type { EngineLog } from '@/lib/trading/execution/logger';

export function ActivityLogPanel() {
  const [logs, setLogs] = useState<EngineLog[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [filterLevel, setFilterLevel] = useState<'all' | 'debug' | 'info' | 'warning' | 'error'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [lastTimestamp, setLastTimestamp] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    try {
      // 마지막 타임스탬프 이후의 로그만 가져오기 (폴링 최적화)
      const url = lastTimestamp > 0
        ? `/api/trading/engine/logs?since=${lastTimestamp}&limit=100`
        : `/api/trading/engine/logs?limit=100`;

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 401) {
          setIsLoading(false);
          return;
        }
        throw new Error('로그 조회 실패');
      }

      const data = await response.json();

      if (data.logs && data.logs.length > 0) {
        setLogs(prev => {
          // 기존 로그와 새 로그 병합 (중복 제거)
          const combined = [...prev, ...data.logs];
          const uniqueLogs = Array.from(
            new Map(combined.map(log => [log.id, log])).values()
          );

          // 타임스탬프순 정렬
          uniqueLogs.sort((a, b) => a.timestamp - b.timestamp);

          // 최대 500개만 유지
          return uniqueLogs.slice(-500);
        });

        // 마지막 타임스탬프 업데이트
        const latest = data.logs[data.logs.length - 1];
        if (latest) {
          setLastTimestamp(latest.timestamp);
        }
      }

      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
      setIsLoading(false);
    }
  }, [lastTimestamp]);

  // 초기 로드 및 주기적 업데이트
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000); // 3초마다 새 로그 확인
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const toggleExpand = (logId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const getLevelIcon = (level: EngineLog['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-500" />;
      case 'debug':
        return <Info className="h-4 w-4 text-purple-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelColor = (level: EngineLog['level']) => {
    switch (level) {
      case 'success':
        return 'text-emerald-300';
      case 'error':
        return 'text-red-300';
      case 'warning':
        return 'text-amber-300';
      case 'debug':
        return 'text-purple-300';
      default:
        return 'text-zinc-300';
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      '시스템': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      '전략': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      '가격': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      '조건': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      '주문': 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      '엔진': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    };
    return colors[category] || 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30';
  };

  const clearLogs = async () => {
    try {
      const response = await fetch('/api/trading/engine/logs', {
        method: 'DELETE'
      });

      if (response.ok) {
        setLogs([]);
        setLastTimestamp(0);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const filteredLogs = filterLevel === 'all'
    ? logs
    : logs.filter(log => log.level === filterLevel);

  if (isLoading && logs.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
        <div className="py-12 text-center text-zinc-500">
          활동 로그를 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">활동 로그</h2>
          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300">
            {filteredLogs.length}/{logs.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value as any)}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="debug">디버그</option>
            <option value="info">정보</option>
            <option value="warning">경고</option>
            <option value="error">오류</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500"
            />
            <span>자동 스크롤</span>
          </label>
          <button
            onClick={clearLogs}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
          >
            로그 지우기
          </button>
        </div>
      </div>

      <div
        ref={logContainerRef}
        className="h-[600px] overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 font-mono text-sm"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            {logs.length === 0 ? '엔진을 시작하여 로그를 확인하세요' : '필터링된 로그가 없습니다'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => {
              const isExpanded = expandedLogs.has(log.id);
              const hasDetails = log.details && Object.keys(log.details).length > 0;

              return (
                <div
                  key={log.id}
                  className="rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800/50 transition-colors"
                >
                  <div
                    className="flex items-start gap-3 p-3 cursor-pointer"
                    onClick={() => hasDetails && toggleExpand(log.id)}
                  >
                    <div className="flex-shrink-0 pt-0.5">
                      {getLevelIcon(log.level)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-zinc-500 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString('ko-KR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            fractionalSecondDigits: 3
                          })}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium border ${getCategoryColor(log.category)}`}>
                          {log.category}
                        </span>
                        <span className="text-xs text-zinc-600 uppercase">[{log.level}]</span>
                      </div>
                      <div className={`text-sm ${getLevelColor(log.level)} font-mono`}>
                        {log.message}
                      </div>
                    </div>
                    {hasDetails && (
                      <div className="flex-shrink-0 pt-0.5">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-zinc-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-zinc-400" />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && log.details && (
                    <div className="border-t border-zinc-800 bg-zinc-950 p-3">
                      <div className="space-y-2">
                        {log.details.symbol && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-24">Symbol:</span>
                            <span className="text-xs text-blue-300 font-mono">{log.details.symbol}</span>
                          </div>
                        )}
                        {log.details.price && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-24">Price:</span>
                            <span className="text-xs text-emerald-300 font-mono">${log.details.price.toFixed(2)}</span>
                          </div>
                        )}
                        {log.details.action && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-500 w-24">Action:</span>
                            <span className="text-xs text-purple-300 font-mono">{log.details.action}</span>
                          </div>
                        )}
                        {/* 지표 상세 정보 표시 (새로운 형식) */}
                        {log.details.indicatorDetails && log.details.indicatorDetails.length > 0 && (
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">지표 평가 상세:</div>
                            <div className="rounded bg-zinc-900 p-2 space-y-2">
                              {log.details.indicatorDetails.map((indicator: any, idx: number) => (
                                <div key={idx} className="border border-zinc-800 rounded p-2 space-y-1">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-blue-400">{indicator.type?.toUpperCase()}</span>
                                        <span className={`text-xs ${indicator.signal ? 'text-emerald-400' : 'text-red-400'}`}>
                                          {indicator.signal ? '✅ 충족' : '❌ 미충족'}
                                        </span>
                                      </div>
                                      <div className="text-xs text-zinc-400 space-y-0.5">
                                        <div>설정: {JSON.stringify(indicator.config)}</div>
                                        <div>계산값: <span className="text-cyan-300 font-mono">{indicator.value?.toFixed(4)}</span></div>
                                        <div>비교: <span className="text-yellow-300">{indicator.value?.toFixed(4)} {indicator.comparison?.operator} {indicator.comparison?.value || indicator.comparison?.target || 'N/A'}</span></div>
                                        {indicator.metric && <div>메트릭: {indicator.metric}</div>}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-zinc-500 font-mono mt-1 pt-1 border-t border-zinc-800">
                                    {indicator.description}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 기존 지표 정보 (하위 호환성) */}
                        {!log.details.indicatorDetails && log.details.indicators && Object.keys(log.details.indicators).length > 0 && (
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Indicators:</div>
                            <div className="rounded bg-zinc-900 p-2 space-y-1">
                              {Object.entries(log.details.indicators).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between text-xs font-mono">
                                  <span className="text-zinc-400">{key}:</span>
                                  <span className="text-cyan-300">{typeof value === 'number' ? value.toFixed(2) : value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {log.details.conditions && log.details.conditions.length > 0 && (
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Conditions:</div>
                            <div className="rounded bg-zinc-900 p-2 space-y-1">
                              {log.details.conditions.map((cond, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs font-mono">
                                  <span className={cond.result ? 'text-emerald-400' : 'text-red-400'}>
                                    {cond.result ? '✓' : '✗'}
                                  </span>
                                  <span className="text-zinc-400">{cond.name}:</span>
                                  <span className={cond.result ? 'text-emerald-300' : 'text-red-300'}>
                                    {cond.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {log.details.error && (
                          <div>
                            <div className="text-xs text-red-400 mb-1">Error:</div>
                            <div className="rounded bg-red-900/20 p-2 text-xs text-red-300 font-mono whitespace-pre-wrap">
                              {log.details.error}
                            </div>
                          </div>
                        )}
                        {log.details.stackTrace && (
                          <div>
                            <div className="text-xs text-zinc-500 mb-1">Stack Trace:</div>
                            <div className="rounded bg-zinc-900 p-2 text-xs text-zinc-400 font-mono whitespace-pre overflow-x-auto max-h-32">
                              {log.details.stackTrace}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
        <span>실시간 업데이트 • 3초마다 갱신 • 최근 500개 로그 표시</span>
        <span>클릭하여 상세 정보 확인</span>
      </div>
    </div>
  );
}
