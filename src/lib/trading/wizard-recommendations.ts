/**
 * 위저드 추천 설정 로직
 */

import type { ExperienceLevel, RiskPreference, RecommendedSettings } from '@/types/trading/setup-wizard';

/**
 * 경험 수준과 리스크 선호도에 따른 추천 설정 생성
 */
export function getRecommendedSettings(
  experience: ExperienceLevel,
  risk: RiskPreference
): RecommendedSettings {
  // 기본 설정 매트릭스
  const settingsMatrix: Record<ExperienceLevel, Record<RiskPreference, RecommendedSettings>> = {
    beginner: {
      conservative: {
        leverage: 3,
        buyAmountPercent: 5,
        stopLossPercent: 3,
        takeProfitPercent: 5,
        enableScaleIn: false,
        maxScaleInCount: 0,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT'],
        description: '가장 안전한 설정입니다. BTC/ETH 주요 코인만 거래하며 낮은 레버리지로 시작합니다.'
      },
      moderate: {
        leverage: 5,
        buyAmountPercent: 10,
        stopLossPercent: 5,
        takeProfitPercent: 8,
        enableScaleIn: true,
        maxScaleInCount: 1,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'],
        description: '균형 잡힌 설정입니다. 주요 코인 중심으로 적절한 리스크를 감수합니다.'
      },
      aggressive: {
        leverage: 8,
        buyAmountPercent: 15,
        stopLossPercent: 8,
        takeProfitPercent: 12,
        enableScaleIn: true,
        maxScaleInCount: 2,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT'],
        description: '초보자 중 공격적 투자 성향. 약간 더 높은 레버리지로 시작하되 주의가 필요합니다.'
      }
    },
    intermediate: {
      conservative: {
        leverage: 5,
        buyAmountPercent: 8,
        stopLossPercent: 4,
        takeProfitPercent: 6,
        enableScaleIn: true,
        maxScaleInCount: 1,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'],
        description: '중급 안전형. 경험을 바탕으로 안정적인 수익을 추구합니다.'
      },
      moderate: {
        leverage: 10,
        buyAmountPercent: 12,
        stopLossPercent: 6,
        takeProfitPercent: 10,
        enableScaleIn: true,
        maxScaleInCount: 2,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'ADAUSDT', 'MATICUSDT'],
        description: '중급 균형형. 다양한 종목으로 포트폴리오를 구성합니다.'
      },
      aggressive: {
        leverage: 15,
        buyAmountPercent: 18,
        stopLossPercent: 10,
        takeProfitPercent: 15,
        enableScaleIn: true,
        maxScaleInCount: 3,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'],
        description: '중급 공격형. 높은 레버리지로 단기 수익을 추구합니다.'
      }
    },
    advanced: {
      conservative: {
        leverage: 10,
        buyAmountPercent: 10,
        stopLossPercent: 5,
        takeProfitPercent: 8,
        enableScaleIn: true,
        maxScaleInCount: 2,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT'],
        description: '고급 안전형. 높은 레버리지를 활용하되 리스크 관리에 중점을 둡니다.'
      },
      moderate: {
        leverage: 15,
        buyAmountPercent: 15,
        stopLossPercent: 8,
        takeProfitPercent: 12,
        enableScaleIn: true,
        maxScaleInCount: 3,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT', 'DOTUSDT'],
        description: '고급 균형형. 다양한 전략을 복합적으로 활용합니다.'
      },
      aggressive: {
        leverage: 20,
        buyAmountPercent: 20,
        stopLossPercent: 12,
        takeProfitPercent: 18,
        enableScaleIn: true,
        maxScaleInCount: 5,
        recommendedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'AVAXUSDT', 'MATICUSDT', 'LINKUSDT', 'DOTUSDT', 'ATOMUSDT', 'NEARUSDT'],
        description: '고급 공격형. 최대 레버리지로 적극적인 수익 추구. 높은 리스크 관리 능력 필요.'
      }
    }
  };

  return settingsMatrix[experience][risk];
}

/**
 * 경험 수준 설명
 */
export const experienceLevelDescriptions: Record<ExperienceLevel, { title: string; description: string; examples: string[] }> = {
  beginner: {
    title: '초보자',
    description: '선물 거래가 처음이거나 경험이 적은 분',
    examples: [
      '레버리지 거래 경험 없음',
      '기본 지표(MA, RSI) 이해 필요',
      '리스크 관리 개념 학습 중'
    ]
  },
  intermediate: {
    title: '중급자',
    description: '어느 정도 거래 경험이 있는 분',
    examples: [
      '6개월 이상 선물 거래 경험',
      '기본 지표 활용 가능',
      '손절/익절 개념 이해'
    ]
  },
  advanced: {
    title: '고급자',
    description: '풍부한 거래 경험과 전략이 있는 분',
    examples: [
      '1년 이상 활발한 선물 거래',
      '복합 지표 전략 수립 가능',
      '리스크 관리 및 자금 관리 능숙'
    ]
  }
};

/**
 * 리스크 선호도 설명
 */
export const riskPreferenceDescriptions: Record<RiskPreference, { title: string; description: string; characteristics: string[] }> = {
  conservative: {
    title: '안전 추구형',
    description: '안정적인 수익을 선호하며 리스크를 최소화',
    characteristics: [
      '낮은 레버리지 (3~10배)',
      '주요 코인 중심 거래',
      '보수적인 손절 기준'
    ]
  },
  moderate: {
    title: '균형 추구형',
    description: '리스크와 수익의 균형을 추구',
    characteristics: [
      '중간 레버리지 (5~15배)',
      '다양한 종목 포트폴리오',
      '유연한 전략 조합'
    ]
  },
  aggressive: {
    title: '공격 추구형',
    description: '높은 수익을 위해 리스크 감수',
    characteristics: [
      '높은 레버리지 (8~20배)',
      '트렌딩 종목 적극 활용',
      '공격적인 추가매수'
    ]
  }
};
