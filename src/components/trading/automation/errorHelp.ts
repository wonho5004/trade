export type ErrorHelp = { label: string };

// 서버 errorHints 코드 → UI 라벨 매핑
export const ERROR_HELP: Record<string, ErrorHelp> = {
  FILTER_NOTIONAL: { label: '최소 주문 금액 미달' },
  INSUFFICIENT_MARGIN: { label: '증거금 부족' },
  REDUCE_ONLY_REJECTED: { label: 'Reduce-Only 거부' },
  POSITION_MODE_MISMATCH: { label: '포지션 모드 불일치' },
  INVALID_PRECISION: { label: '가격/수량 정밀도 오류' },
  INVALID_WORKING_TYPE: { label: '스탑 기준(WorkingType) 오류' },
  SAFETY_LIMIT: { label: '안전장치 한도 초과' },
  INVALID_INPUT: { label: '입력값 오류' },
  UNSUPPORTED_TYPE: { label: '미지원 주문 타입' }
};

