/**
 * 종목 선택 관련 타입 정의
 * - 종목 검색, 필터링, 정렬을 위한 타입
 */

/**
 * 종목별 설정
 * - 기본 설정을 Override하는 종목별 옵션
 */
export type SymbolConfig = {
  symbol: string; // "BTCUSDT"
  quote: 'USDT' | 'USDC';

  // Override 설정 (undefined = 기본값 사용)
  leverage?: number; // 레버리지 (undefined = 기본값 사용)
  positionMode?: 'long' | 'short' | 'both'; // 포지션 방향 (undefined = 기본값)
  enableScaleIn?: boolean; // 추가매수 활성화 (undefined = 기본값)
  enableExit?: boolean; // 매도 활성화 (undefined = 기본값)
  enableStopLoss?: boolean; // 손절 활성화 (undefined = 기본값)
};

/**
 * 종목 정렬 기준
 */
export type SymbolSortCriteria = 'alpha' | 'volume' | 'marketcap' | 'gainers' | 'losers';

/**
 * 종목 데이터 (FuturesSymbolMeta 확장)
 * - API 응답 + 계산된 필드
 */
export type EnrichedSymbolData = {
  symbol: string;
  base: string;
  quote: string;
  lastPrice: number | null;
  quoteVolume: number | null; // 24h 거래량 (USDT)
  baseVolume: number | null; // 24h 거래량 (기준통화)
  marketCapEstimate: number | null; // 시가총액 추정치
  openInterest: number | null;
  minNotional: number | null;
  pricePrecision: number | null;
  quantityPrecision: number | null;
  leverageBrackets: any[];

  // 계산 필드
  dailyChange?: number; // 일일 변동률 (%)
  listingDate?: string; // 상장일 (ISO 8601)
  listingAgeDays?: number; // 상장 후 경과 일수
};
