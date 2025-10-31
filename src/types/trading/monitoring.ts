/**
 * Trading Monitoring Types
 *
 * 실시간 거래 모니터링을 위한 타입 정의
 */

/**
 * 거래 액션 타입
 */
export type TradeAction = 'ENTRY_LONG' | 'ENTRY_SHORT' | 'EXIT' | 'SCALE_IN' | 'HEDGE';

/**
 * 거래 상태
 */
export type TradeStatus = 'PENDING' | 'FILLED' | 'FAILED' | 'CANCELLED';

/**
 * 포지션 방향
 */
export type PositionSide = 'LONG' | 'SHORT';

/**
 * 포지션 상태
 */
export type PositionStatus = 'OPEN' | 'CLOSED';

/**
 * 조건 평가 타입
 */
export type ConditionType = 'ENTRY' | 'EXIT' | 'SCALE_IN' | 'HEDGE';

/**
 * 거래 로그 (데이터베이스 모델)
 */
export interface TradingLog {
  id: string;
  user_id: string;
  strategy_id: string | null;
  symbol: string;
  action: TradeAction;
  price: number;
  quantity: number;
  order_id: string | null;
  status: TradeStatus;
  reason: unknown; // JSONB - condition evaluation results
  error_message: string | null;
  created_at: string;
}

/**
 * 포지션 (데이터베이스 모델)
 */
export interface Position {
  id: string;
  user_id: string;
  strategy_id: string | null;
  symbol: string;
  side: PositionSide;
  entry_price: number;
  current_price: number;
  quantity: number;
  leverage: number;
  unrealized_pnl: number;
  realized_pnl: number;
  status: PositionStatus;
  opened_at: string;
  closed_at: string | null;
  updated_at: string;
}

/**
 * 조건 평가 결과 (데이터베이스 모델)
 */
export interface ConditionEvaluation {
  id: string;
  user_id: string;
  strategy_id: string;
  symbol: string;
  condition_type: ConditionType;
  evaluation_result: boolean;
  details: unknown; // JSONB - detailed evaluation for each condition
  evaluated_at: string;
}

/**
 * 최근 거래 활동 (뷰)
 */
export interface RecentTradingActivity {
  id: string;
  user_id: string;
  strategy_id: string | null;
  strategy_name: string | null;
  symbol: string;
  action: TradeAction;
  price: number;
  quantity: number;
  status: TradeStatus;
  created_at: string;
}

/**
 * 활성 포지션 요약 (뷰)
 */
export interface ActivePositionSummary {
  user_id: string;
  strategy_id: string | null;
  strategy_name: string | null;
  symbol: string;
  side: PositionSide;
  entry_price: number;
  current_price: number;
  quantity: number;
  leverage: number;
  unrealized_pnl: number;
  opened_at: string;
  updated_at: string;
}

/**
 * 모니터링 대시보드 데이터
 */
export interface MonitoringDashboardData {
  activePositions: ActivePositionSummary[];
  recentTrades: RecentTradingActivity[];
  recentEvaluations: ConditionEvaluation[];
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  openPositionsCount: number;
  todayTradesCount: number;
}

/**
 * 실시간 가격 업데이트
 */
export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

/**
 * 조건 평가 상세 결과
 */
export interface ConditionEvaluationDetail {
  condition_id: string;
  condition_name: string;
  result: boolean;
  current_value: number;
  threshold: number;
  operator: string;
}

/**
 * PnL 추적 데이터
 */
export interface PnLTrackingData {
  hourly: { timestamp: string; pnl: number }[];
  daily: { date: string; pnl: number }[];
  weekly: { week: string; pnl: number }[];
  monthly: { month: string; pnl: number }[];
}
