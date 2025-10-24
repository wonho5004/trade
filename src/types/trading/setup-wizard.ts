/**
 * 설정 마법사 관련 타입 정의
 */

/**
 * 투자 경험 수준
 */
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * 리스크 선호도
 */
export type RiskPreference = 'conservative' | 'moderate' | 'aggressive';

/**
 * 위저드 단계
 */
export type WizardStep = 'welcome' | 'experience' | 'recommendation' | 'symbols' | 'review' | 'complete';

/**
 * 사용자 프로필 (위저드 수집 정보)
 */
export interface UserProfile {
  /** 투자 경험 수준 */
  experienceLevel: ExperienceLevel;
  /** 리스크 선호도 */
  riskPreference: RiskPreference;
  /** 선호하는 종목 카테고리 */
  preferredSymbols: 'major' | 'top-volume' | 'trending';
}

/**
 * 추천 설정 (경험/리스크 기반)
 */
export interface RecommendedSettings {
  /** 레버리지 */
  leverage: number;
  /** 매수 금액 (지갑 대비 %) */
  buyAmountPercent: number;
  /** 손절 기준 (%) */
  stopLossPercent: number;
  /** 익절 기준 (%) */
  takeProfitPercent: number;
  /** 추가매수 활성화 여부 */
  enableScaleIn: boolean;
  /** 추가매수 횟수 */
  maxScaleInCount: number;
  /** 추천 종목 */
  recommendedSymbols: string[];
  /** 설명 */
  description: string;
}

/**
 * 위저드 상태
 */
export interface WizardState {
  /** 현재 단계 */
  currentStep: WizardStep;
  /** 완료된 단계들 */
  completedSteps: WizardStep[];
  /** 사용자 프로필 */
  userProfile: UserProfile | null;
  /** 추천 설정 */
  recommendedSettings: RecommendedSettings | null;
  /** 설정 적용 여부 */
  settingsApplied: boolean;
}
