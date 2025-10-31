/**
 * Trading Strategy Types
 *
 * 자동매매 전략 저장/불러오기를 위한 타입 정의
 */

import type { AutoTradingSettings } from './auto-trading';

/**
 * 저장된 전략 (데이터베이스 모델)
 */
export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  settings: AutoTradingSettings;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * 전략 생성 요청
 */
export interface CreateStrategyRequest {
  name: string;
  description?: string;
  settings: AutoTradingSettings;
  is_active?: boolean;
}

/**
 * 전략 수정 요청
 */
export interface UpdateStrategyRequest {
  name?: string;
  description?: string;
  settings?: AutoTradingSettings;
  is_active?: boolean;
}

/**
 * 전략 목록 응답
 */
export interface StrategyListResponse {
  strategies: Strategy[];
  total: number;
}

/**
 * 전략 상세 응답
 */
export interface StrategyResponse {
  strategy: Strategy;
}

/**
 * 전략 삭제 응답
 */
export interface DeleteStrategyResponse {
  success: boolean;
  message: string;
}

/**
 * 전략 활성화/비활성화 요청
 */
export interface ToggleStrategyActiveRequest {
  is_active: boolean;
}

/**
 * API 에러 응답
 */
export interface StrategyErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}
