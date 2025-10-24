/**
 * 도움말 컨텐츠 정의
 * - 모든 주요 기능에 대한 도움말 제공
 * - HelpTooltip 컴포넌트에서 사용
 */

export interface HelpContent {
  id: string;
  title: string;
  summary: string;
  details?: string;
  examples?: string[];
  warnings?: string[];
  relatedTopics?: Array<{ id: string; label: string }>;
}

export const helpContent: Record<string, HelpContent> = {
  // 레버리지
  'leverage-setting': {
    id: 'leverage-setting',
    title: '레버리지',
    summary: '적은 자금으로 큰 포지션을 거래할 수 있는 배율입니다.',
    details: `레버리지는 증거금(마진)의 몇 배에 해당하는 포지션을 개설할 수 있는지를 나타냅니다.
예를 들어 10배 레버리지로 $100를 투자하면 $1,000 규모의 포지션을 거래할 수 있습니다.`,
    examples: [
      '10배 레버리지 + $100 투자 = $1,000 포지션',
      '가격 1% 상승 시 수익: $10 (10%)',
      '가격 1% 하락 시 손실: $10 (10%)'
    ],
    warnings: [
      '높은 레버리지는 수익과 손실을 모두 확대시킵니다',
      '청산 위험이 증가하므로 신중하게 설정하세요',
      '초보자는 5-10배 이하 권장'
    ],
    relatedTopics: [
      { id: 'margin', label: '마진' },
      { id: 'liquidation', label: '청산' }
    ]
  },

  // 마진
  'margin': {
    id: 'margin',
    title: '마진 (증거금)',
    summary: '포지션을 유지하기 위해 필요한 담보 금액입니다.',
    details: `마진은 레버리지 거래 시 거래소에 예치하는 담보금입니다.
Initial Margin (초기 증거금)은 포지션 진입 시 필요한 금액이며, Maintenance Margin (유지 증거금)은 포지션을 유지하기 위한 최소 금액입니다.`,
    examples: [
      '$1,000 포지션 ÷ 10배 레버리지 = $100 초기 마진',
      '마진율이 유지 마진 아래로 떨어지면 청산됩니다'
    ],
    warnings: [
      '마진이 부족하면 자동으로 청산될 수 있습니다',
      '추가 마진을 예치하여 청산을 방지할 수 있습니다'
    ],
    relatedTopics: [
      { id: 'leverage-setting', label: '레버리지' },
      { id: 'liquidation', label: '청산' }
    ]
  },

  // 청산
  'liquidation': {
    id: 'liquidation',
    title: '청산 (Liquidation)',
    summary: '마진이 부족하여 포지션이 강제로 종료되는 것입니다.',
    details: `시장 가격이 불리한 방향으로 움직여 마진율이 유지 마진 수준 이하로 떨어지면,
거래소가 자동으로 포지션을 청산합니다. 청산 시 투자금의 대부분 또는 전부를 잃을 수 있습니다.`,
    examples: [
      'Long 포지션: 가격이 크게 하락하면 청산',
      'Short 포지션: 가격이 크게 상승하면 청산'
    ],
    warnings: [
      '청산되면 투자금을 잃게 됩니다',
      '높은 레버리지일수록 청산 위험이 높습니다',
      '손절 설정으로 청산 전에 손실을 제한하세요'
    ],
    relatedTopics: [
      { id: 'leverage-setting', label: '레버리지' },
      { id: 'margin', label: '마진' },
      { id: 'stop-loss', label: '손절' }
    ]
  },

  // 롱/숏
  'position-direction': {
    id: 'position-direction',
    title: '롱 / 숏',
    summary: '가격 상승 또는 하락에 베팅하는 거래 방향입니다.',
    details: `롱(Long)은 가격이 오를 것으로 예상하고 매수하는 것이며,
숏(Short)은 가격이 떨어질 것으로 예상하고 매도(공매도)하는 것입니다.`,
    examples: [
      '롱: BTC를 $50,000에 매수 → $55,000에 매도 = +$5,000 수익',
      '숏: BTC를 $50,000에 매도 → $45,000에 매수 = +$5,000 수익'
    ],
    warnings: [
      '롱은 가격 하락 시 손실, 숏은 가격 상승 시 손실',
      '숏 포지션은 이론상 무한 손실 가능 (가격 상승 제한 없음)'
    ]
  },

  // 조건 그룹
  'condition-group': {
    id: 'condition-group',
    title: '조건 그룹',
    summary: '여러 지표 조건을 묶어서 설정하는 단위입니다.',
    details: `조건 그룹 내부의 조건들은 모두 만족해야 하며(AND),
다른 그룹 중 하나만 만족하면 됩니다(OR).
예: (그룹1: RSI>70 AND MA돌파) OR (그룹2: 볼린저밴드 상단돌파 AND 거래량 급증)`,
    examples: [
      '그룹 1: RSI > 70 AND MA(20) 상단돌파',
      '그룹 2: 볼린저밴드 상단돌파 AND 거래량 급증',
      '→ 그룹 1 또는 그룹 2 중 하나가 만족되면 매수 신호'
    ],
    warnings: [
      '너무 많은 조건을 추가하면 신호가 거의 발생하지 않을 수 있습니다',
      '백테스트로 조건의 효과를 검증하세요'
    ],
    relatedTopics: [
      { id: 'indicators', label: '지표' },
      { id: 'comparator', label: '비교 연산자' }
    ]
  },

  // 비교 연산자
  'comparator': {
    id: 'comparator',
    title: '비교 연산자',
    summary: '지표 값을 비교하는 방법입니다.',
    details: `값을 비교하여 조건의 참/거짓을 판단합니다.
캔들 가격, 다른 지표, 또는 고정값과 비교할 수 있습니다.`,
    examples: [
      '>: 종가 > MA(20) → 이동평균선 위에서 거래',
      '<: RSI < 30 → 과매도 구간',
      '>=: 현재 수익률 >= 5% → 5% 이상 수익',
      '선택안함: 값만 참조, 비교하지 않음'
    ],
    warnings: [
      '적절한 기준값 설정이 중요합니다',
      '과거 데이터로 최적값을 찾으세요 (백테스트)'
    ],
    relatedTopics: [
      { id: 'indicators', label: '지표' },
      { id: 'condition-group', label: '조건 그룹' }
    ]
  },

  // 지표
  'indicators': {
    id: 'indicators',
    title: '기술적 지표',
    summary: '과거 가격 데이터를 기반으로 계산된 값입니다.',
    details: `기술적 지표는 가격의 추세, 모멘텀, 변동성 등을 분석하여
매수/매도 시점을 판단하는 데 사용됩니다.`,
    examples: [
      'MA (이동평균선): 추세 파악',
      'RSI (상대강도지수): 과매수/과매도 판단',
      '볼린저밴드: 변동성 및 지지/저항 확인',
      'MACD: 추세 전환 시점 포착'
    ],
    relatedTopics: [
      { id: 'ma-indicator', label: 'MA' },
      { id: 'rsi-indicator', label: 'RSI' },
      { id: 'bollinger-indicator', label: '볼린저밴드' },
      { id: 'macd-indicator', label: 'MACD' }
    ]
  },

  // 추가매수
  'scale-in': {
    id: 'scale-in',
    title: '추가매수 (물타기)',
    summary: '기존 포지션에 추가로 매수하여 평균 단가를 조정하는 전략입니다.',
    details: `가격이 하락하여 손실이 발생했을 때 추가 매수하여 평균 매수 단가를 낮춥니다.
이후 가격이 반등하면 더 빨리 손익분기점에 도달할 수 있습니다.`,
    examples: [
      '1차: $50,000에 $100 매수',
      '2차: $45,000에 $100 추가매수 → 평균 단가 $47,500',
      '가격이 $47,500 이상으로 회복하면 수익'
    ],
    warnings: [
      '무분별한 추가매수는 손실을 확대시킬 수 있습니다',
      '명확한 추가매수 횟수 제한을 설정하세요 (예: 최대 3회)',
      '추가매수 조건을 신중하게 설정하세요'
    ],
    relatedTopics: [
      { id: 'status-conditions', label: '현재 상태 조건' },
      { id: 'stop-loss', label: '손절' }
    ]
  },

  // 손절
  'stop-loss': {
    id: 'stop-loss',
    title: '손절 (Stop Loss)',
    summary: '손실이 일정 수준에 도달하면 자동으로 포지션을 청산하는 안전장치입니다.',
    details: `미리 설정한 손실률에 도달하면 자동으로 매도하여 더 큰 손실을 방지합니다.
모든 거래에 반드시 손절을 설정하는 것이 권장됩니다.`,
    examples: [
      '손절 -5% 설정: 5% 손실 시 자동 청산',
      '손절 -10% + 시간 조건: 10% 손실 또는 24시간 경과 시 청산'
    ],
    warnings: [
      '손절 없이 거래하면 청산 위험이 높습니다',
      '손절률은 레버리지를 고려하여 설정하세요',
      '초보자는 -5% ~ -10% 권장'
    ],
    relatedTopics: [
      { id: 'liquidation', label: '청산' },
      { id: 'take-profit', label: '익절' }
    ]
  },

  // 익절
  'take-profit': {
    id: 'take-profit',
    title: '익절 (Take Profit)',
    summary: '목표 수익률에 도달하면 자동으로 포지션을 청산하여 수익을 확정합니다.',
    details: `미리 설정한 수익률에 도달하면 자동으로 매도하여 수익을 실현합니다.
욕심을 부리지 않고 안정적으로 수익을 확보하는 방법입니다.`,
    examples: [
      '익절 +10% 설정: 10% 수익 시 자동 청산',
      '부분 익절: 50% 포지션은 +5%에, 나머지는 +10%에 청산'
    ],
    warnings: [
      '익절률이 너무 낮으면 작은 수익만 얻게 됩니다',
      '익절률이 너무 높으면 목표 달성이 어려울 수 있습니다',
      '시장 상황에 따라 유연하게 조정하세요'
    ],
    relatedTopics: [
      { id: 'stop-loss', label: '손절' }
    ]
  },

  // 현재 상태 조건
  'status-conditions': {
    id: 'status-conditions',
    title: '현재 상태 조건',
    summary: '포지션의 실시간 상태(수익률, 매수횟수 등)를 기준으로 조건을 설정합니다.',
    details: `거래 중인 포지션의 현재 상태를 기반으로 추가 액션을 결정합니다.
추가매수, 손절, 익절 조건에 활용됩니다.`,
    examples: [
      '현재 수익률 < -3% AND 매수 횟수 < 3회 → 추가 매수',
      '현재 수익률 < -10% OR 진입 경과시간 > 2일 → 손절',
      '초기 마진 비율 > 150% → 반대 포지션 헤지'
    ],
    warnings: [
      '너무 공격적인 조건은 위험합니다',
      '백테스트로 조건을 검증하세요'
    ],
    relatedTopics: [
      { id: 'scale-in', label: '추가매수' },
      { id: 'stop-loss', label: '손절' }
    ]
  },

  // 종목 선택
  'symbol-selection': {
    id: 'symbol-selection',
    title: '종목 선택',
    summary: '거래할 암호화폐 종목을 선택합니다.',
    details: `수동으로 종목을 선택하거나, 거래량/시가총액 기준으로 자동 선택할 수 있습니다.
제외 규칙을 설정하여 특정 종목을 자동으로 제외할 수도 있습니다.`,
    examples: [
      '수동 선택: BTC, ETH, SOL 직접 선택',
      '자동 선택: 거래량 상위 10위',
      '제외 규칙: 상장 30일 이하, 거래량 하위 50% 제외'
    ],
    warnings: [
      '너무 많은 종목을 선택하면 자금이 분산됩니다',
      '신규 상장 종목은 변동성이 매우 큽니다',
      '유동성이 낮은 종목은 체결이 어려울 수 있습니다'
    ],
    relatedTopics: [
      { id: 'leverage-setting', label: '레버리지' }
    ]
  },

  // 매수 금액
  'buy-amount': {
    id: 'buy-amount',
    title: '매수 금액 설정',
    summary: '각 종목에 투자할 금액을 설정합니다.',
    details: `USDT 고정 금액, 잔고 기준 퍼센트, 전체 잔고 기준 퍼센트 등
다양한 방식으로 매수 금액을 설정할 수 있습니다.`,
    examples: [
      'USDT 고정: 종목당 $100씩 투자',
      '종목별 잔고 비율: 각 종목에 잔고의 10%씩 배분',
      '전체 잔고 비율: 전체 잔고의 5%만 사용'
    ],
    warnings: [
      '높은 레버리지 + 큰 금액 = 청산 위험 증가',
      '초보자는 전체 잔고의 1-5% 권장',
      '여러 종목 동시 진입 시 자금 부족에 주의하세요'
    ],
    relatedTopics: [
      { id: 'leverage-setting', label: '레버리지' },
      { id: 'margin', label: '마진' }
    ]
  }
};

/**
 * ID로 도움말 컨텐츠 가져오기
 */
export function getHelpContent(id: string): HelpContent | undefined {
  return helpContent[id];
}

/**
 * 모든 도움말 ID 목록
 */
export function getAllHelpIds(): string[] {
  return Object.keys(helpContent);
}
