/**
 * ExecutionEngine Logger
 *
 * 엔진 실행 로그를 메모리에 저장하고 관리합니다.
 */

export interface EngineLog {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'success' | 'warning' | 'error';
  category: string;
  message: string;
  details?: {
    symbol?: string;
    price?: number;
    indicators?: Record<string, number>;
    conditions?: Array<{name: string; result: boolean; value?: string}>;
    action?: string;
    error?: string;
    stackTrace?: string;
  };
}

// 메모리 내 로그 저장소 (최대 500개)
const logStore: EngineLog[] = [];
const MAX_LOGS = 500;

/**
 * 로그 추가
 */
export function addEngineLog(log: Omit<EngineLog, 'id' | 'timestamp'>) {
  const newLog: EngineLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    timestamp: Date.now(),
    ...log
  };

  logStore.push(newLog);

  // 콘솔에도 출력
  const emoji = {
    debug: '🔍',
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌'
  }[log.level];

  console.log(`${emoji} [${log.category}] ${log.message}`);

  if (log.details) {
    console.log('  Details:', log.details);
  }

  // 최대 개수 초과 시 오래된 로그 제거
  if (logStore.length > MAX_LOGS) {
    logStore.splice(0, logStore.length - MAX_LOGS);
  }
}

/**
 * 모든 로그 조회
 */
export function getAllLogs(): EngineLog[] {
  return [...logStore];
}

/**
 * 타임스탬프 이후의 로그만 조회
 */
export function getLogsSince(timestamp: number): EngineLog[] {
  return logStore.filter(log => log.timestamp > timestamp);
}

/**
 * 로그 레벨별 필터링
 */
export function getLogsByLevel(level: EngineLog['level']): EngineLog[] {
  return logStore.filter(log => log.level === level);
}

/**
 * 모든 로그 삭제
 */
export function clearLogs() {
  logStore.length = 0;
  addEngineLog({
    level: 'info',
    category: '시스템',
    message: '로그가 초기화되었습니다.'
  });
}

/**
 * 로그 통계
 */
export function getLogStats() {
  return {
    total: logStore.length,
    debug: logStore.filter(l => l.level === 'debug').length,
    info: logStore.filter(l => l.level === 'info').length,
    success: logStore.filter(l => l.level === 'success').length,
    warning: logStore.filter(l => l.level === 'warning').length,
    error: logStore.filter(l => l.level === 'error').length
  };
}
