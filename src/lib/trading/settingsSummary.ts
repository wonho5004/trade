import type { AutoTradingSettings } from '@/types/trading/auto-trading';

/**
 * 설정값을 한글로 표시하는 유틸리티 함수들
 */

// 지표 조건을 한글로 변환
export function formatIndicatorCondition(indicator: any): string {
  if (!indicator || !indicator.type) return '';

  const { type, params } = indicator;

  switch (type) {
    case 'rsi':
      if (params?.below !== undefined) {
        return `RSI < ${params.below}`;
      } else if (params?.above !== undefined) {
        return `RSI > ${params.above}`;
      }
      return 'RSI';

    case 'macd':
      if (params?.signal === 'bullish') {
        return 'MACD 골든크로스';
      } else if (params?.signal === 'bearish') {
        return 'MACD 데드크로스';
      }
      return 'MACD';

    case 'bb':
      if (params?.position === 'below_lower') {
        return '볼린저밴드 하단 이탈';
      } else if (params?.position === 'above_upper') {
        return '볼린저밴드 상단 돌파';
      }
      return '볼린저밴드';

    case 'ema':
      if (params?.cross === 'above') {
        return `EMA(${params?.fast || 12}/${params?.slow || 26}) 골든크로스`;
      } else if (params?.cross === 'below') {
        return `EMA(${params?.fast || 12}/${params?.slow || 26}) 데드크로스`;
      }
      return `EMA`;

    case 'sma':
      if (params?.cross === 'above') {
        return `SMA(${params?.fast || 20}/${params?.slow || 50}) 골든크로스`;
      } else if (params?.cross === 'below') {
        return `SMA(${params?.fast || 20}/${params?.slow || 50}) 데드크로스`;
      }
      return `SMA`;

    case 'volume':
      if (params?.spike !== undefined) {
        return `거래량 급증 ${params.spike}배`;
      }
      return '거래량';

    case 'price':
      if (params?.change24h) {
        if (params.change24h > 0) {
          return `24시간 상승 > ${params.change24h}%`;
        } else {
          return `24시간 하락 < ${params.change24h}%`;
        }
      }
      return '가격';

    default:
      return type.toUpperCase();
  }
}

// 조건 트리를 한글로 변환
export function formatConditionTree(tree: any): string {
  if (!tree) return '조건 없음';

  if (tree.type === 'indicator') {
    return formatIndicatorCondition(tree);
  }

  if (tree.type === 'and') {
    const children = (tree.children || []).map(formatConditionTree).filter(Boolean);
    if (children.length === 0) return '';
    if (children.length === 1) return children[0];
    return children.join(' AND ');
  }

  if (tree.type === 'or') {
    const children = (tree.children || []).map(formatConditionTree).filter(Boolean);
    if (children.length === 0) return '';
    if (children.length === 1) return children[0];
    return `(${children.join(' OR ')})`;
  }

  return '';
}

// 기본 설정 요약
export function formatBasicSettings(settings: AutoTradingSettings): string[] {
  const summary: string[] = [];

  summary.push(`종목 수: ${settings.symbolCount}개`);
  summary.push(`레버리지: ${settings.leverage}배`);
  summary.push(`마진 타입: ${settings.marginType === 'ISOLATED' ? '격리' : '교차'}`);

  if (settings.positionMode === 'HEDGE') {
    summary.push('포지션 모드: 양방향(헤지)');
  } else {
    summary.push('포지션 모드: 단방향');
  }

  return summary;
}

// 자본 설정 요약
export function formatCapitalSettings(capital: any, quote: string = 'USDT'): string[] {
  const summary: string[] = [];

  if (!capital) return ['설정 없음'];

  // 초기 매수 금액
  if (capital.initial) {
    const { mode, fixedAmount, walletPct } = capital.initial;
    if (mode === 'fixed') {
      summary.push(`초기 매수: ${fixedAmount || 0} ${quote} (고정)`);
    } else if (mode === 'wallet_pct') {
      summary.push(`초기 매수: 지갑의 ${walletPct || 0}%`);
    }
  }

  // 추가 매수 금액
  if (capital.scaleIn) {
    const { mode, fixedAmount, walletPct, limitEnabled, limitAmount } = capital.scaleIn;
    if (mode === 'fixed') {
      summary.push(`추가 매수: ${fixedAmount || 0} ${quote} (고정)`);
    } else if (mode === 'wallet_pct') {
      summary.push(`추가 매수: 지갑의 ${walletPct || 0}%`);
    }

    if (limitEnabled && limitAmount) {
      summary.push(`추가 매수 한도: ${limitAmount} ${quote}`);
    }
  }

  // 예외 조건
  const exc = capital.exceptions || {};
  const exceptions: string[] = [];
  if (exc.totalVsWalletEnabled) {
    exceptions.push(`Total≤Wallet ${exc.totalVsWalletPct || 0}%`);
  }
  if (exc.freeVsWalletEnabled) {
    exceptions.push(`Free≤Wallet ${exc.freeVsWalletPct || 0}%`);
  }
  if (exc.totalBelowEnabled) {
    exceptions.push(`Total≤${exc.totalBelowAmount || 0} ${quote}`);
  }
  if (exc.freeBelowEnabled) {
    exceptions.push(`Free≤${exc.freeBelowAmount || 0} ${quote}`);
  }

  if (exceptions.length > 0) {
    summary.push(`예외: ${exceptions.join(', ')}`);
  }

  return summary;
}

// indicators에서 조건 개수 확인
function countIndicators(indicators: any): number {
  if (!indicators || !indicators.root) return 0;

  const root = indicators.root;
  if (!root.children || !Array.isArray(root.children)) return 0;

  let count = 0;
  const traverse = (node: any) => {
    if (node.type === 'indicator') {
      count++;
    } else if (node.children && Array.isArray(node.children)) {
      node.children.forEach(traverse);
    }
  };

  root.children.forEach(traverse);
  return count;
}

// 진입 조건 요약
export function formatEntrySettings(entry: any, direction: 'long' | 'short'): string[] {
  const summary: string[] = [];

  if (!entry || !entry[direction]) return ['조건 없음'];

  const config = entry[direction];

  if (config.enabled === false) {
    return ['비활성화'];
  }

  // indicators 구조 확인
  const indicatorCount = countIndicators(config.indicators);
  if (indicatorCount > 0) {
    summary.push(`지표 조건 ${indicatorCount}개 설정됨`);
  }

  if (config.immediate) {
    summary.push('즉시 진입');
  }

  return summary.length > 0 ? summary : ['조건 없음'];
}

// 추가 매수 조건 요약
export function formatScaleInSettings(scaleIn: any, direction: 'long' | 'short'): string[] {
  const summary: string[] = [];

  if (!scaleIn || !scaleIn[direction]) return ['조건 없음'];

  const config = scaleIn[direction];

  if (config.enabled === false) {
    return ['비활성화'];
  }

  if (config.priceDropPct) {
    summary.push(`가격 하락: ${config.priceDropPct}%`);
  }

  if (config.maxCount) {
    summary.push(`최대 횟수: ${config.maxCount}회`);
  }

  const indicatorCount = countIndicators(config.indicators);
  if (indicatorCount > 0) {
    summary.push(`지표 조건 ${indicatorCount}개 설정됨`);
  }

  return summary.length > 0 ? summary : ['조건 없음'];
}

// 청산 조건 요약
export function formatExitSettings(exit: any, direction: 'long' | 'short'): string[] {
  const summary: string[] = [];

  if (!exit || !exit[direction]) return ['조건 없음'];

  const config = exit[direction];

  if (config.enabled === false) {
    return ['비활성화'];
  }

  if (config.takeProfitPct) {
    summary.push(`익절: +${config.takeProfitPct}%`);
  }

  if (config.stopLossPct) {
    summary.push(`손절: -${config.stopLossPct}%`);
  }

  const indicatorCount = countIndicators(config.indicators);
  if (indicatorCount > 0) {
    summary.push(`지표 조건 ${indicatorCount}개 설정됨`);
  }

  // 현재 수익률 조건
  if (config.currentProfitRate && config.currentProfitRate.enabled) {
    const comp = config.currentProfitRate.comparator;
    const val = config.currentProfitRate.value;
    const compText = comp === 'over' ? '>' : comp === 'under' ? '<' : comp === 'eq' ? '=' : comp === 'gte' ? '≥' : comp === 'lte' ? '≤' : '';
    if (compText) {
      summary.push(`수익률 ${compText} ${val}%`);
    }
  }

  return summary.length > 0 ? summary : ['조건 없음'];
}

// 헤지 조건 요약
export function formatHedgeSettings(hedge: any): string[] {
  const summary: string[] = [];

  if (!hedge) return ['조건 없음'];

  if (hedge.enabled === false) {
    return ['비활성화'];
  }

  if (hedge.triggerPct) {
    summary.push(`발동 조건: ${hedge.triggerPct}% 손실`);
  }

  if (hedge.size) {
    summary.push(`헤지 크기: ${hedge.size}%`);
  }

  const indicatorCount = countIndicators(hedge.indicators);
  if (indicatorCount > 0) {
    summary.push(`지표 조건 ${indicatorCount}개 설정됨`);
  }

  // 현재 수익률 조건
  if (hedge.currentProfitRate && hedge.currentProfitRate.enabled) {
    const comp = hedge.currentProfitRate.comparator;
    const val = hedge.currentProfitRate.value;
    const compText = comp === 'over' ? '>' : comp === 'under' ? '<' : comp === 'eq' ? '=' : comp === 'gte' ? '≥' : comp === 'lte' ? '≤' : '';
    if (compText) {
      summary.push(`수익률 ${compText} ${val}%`);
    }
  }

  return summary.length > 0 ? summary : ['조건 없음'];
}

// 손절선 조건 요약
export function formatStopLossLineSettings(stopLoss: any): string[] {
  const summary: string[] = [];

  if (!stopLoss || !stopLoss.stopLossLine) return ['조건 없음'];

  const config = stopLoss.stopLossLine;

  if (config.enabled === false) {
    return ['비활성화'];
  }

  if (config.pct) {
    summary.push(`손절선: -${config.pct}%`);
  }

  if (config.autoRecreate) {
    summary.push('자동 재생성');
  }

  const indicatorCount = countIndicators(config.indicators);
  if (indicatorCount > 0) {
    summary.push(`지표 조건 ${indicatorCount}개 설정됨`);
  }

  // 현재 수익률 조건
  if (config.currentProfitRate && config.currentProfitRate.enabled) {
    const comp = config.currentProfitRate.comparator;
    const val = config.currentProfitRate.value;
    const compText = comp === 'over' ? '>' : comp === 'under' ? '<' : comp === 'eq' ? '=' : comp === 'gte' ? '≥' : comp === 'lte' ? '≤' : '';
    if (compText) {
      summary.push(`수익률 ${compText} ${val}%`);
    }
  }

  return summary.length > 0 ? summary : ['조건 없음'];
}
