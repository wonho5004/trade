import type { AutoTradingSettings } from '@/types/trading/auto-trading';

/**
 * 설정값을 한글로 표시하는 유틸리티 함수들
 */

// 비교 연산자를 한글 기호로 변환
function formatComparator(comp: string): string {
  switch (comp) {
    case 'over': return '>';
    case 'under': return '<';
    case 'eq': return '=';
    case 'gte': return '≥';
    case 'lte': return '≤';
    default: return comp;
  }
}

// 지표 이름을 한글로 변환
function formatIndicatorName(type: string, metric?: string): string {
  switch (type) {
    case 'rsi':
      return 'RSI';
    case 'macd':
      if (metric === 'macd') return 'MACD';
      if (metric === 'signal') return 'MACD Signal';
      if (metric === 'histogram') return 'MACD Histogram';
      return 'MACD';
    case 'bollinger':
      if (metric === 'upper') return 'BB 상단';
      if (metric === 'lower') return 'BB 하단';
      if (metric === 'middle') return 'BB 중간';
      return 'BB';
    case 'ma':
      return 'MA';
    case 'dmi':
      if (metric === 'diplus') return 'DI+';
      if (metric === 'diminus') return 'DI-';
      if (metric === 'adx') return 'ADX';
      return 'DMI';
    default:
      return type.toUpperCase();
  }
}

// DMI 설정을 상세하게 포맷
function formatDMIConfig(config: any): string[] {
  const details: string[] = [];

  if (!config) return details;

  // ADX 조건
  if (config.adx && config.adx.enabled) {
    const comp = formatComparator(config.adx.comparator || 'over');
    details.push(`ADX ${comp} ${config.adx.value || 25}`);
  }

  // DI 비교
  if (config.diComparison) {
    if (config.diComparison === 'plus_over_minus') {
      details.push('DI+ > DI-');
    } else if (config.diComparison === 'minus_over_plus') {
      details.push('DI- > DI+');
    }
  }

  // ADX vs DI 비교
  if (config.adxVsDi) {
    if (config.adxVsDi === 'adx_gt_di_plus') {
      details.push('ADX > DI+');
    } else if (config.adxVsDi === 'adx_lt_di_plus') {
      details.push('DI+ > ADX');
    } else if (config.adxVsDi === 'adx_gt_di_minus') {
      details.push('ADX > DI-');
    } else if (config.adxVsDi === 'adx_lt_di_minus') {
      details.push('DI- > ADX');
    }
  }

  return details;
}

// IndicatorLeafNode를 한글로 변환
function formatIndicatorLeaf(node: any, indicatorsMap: Map<string, any>): string {
  if (!node || node.kind !== 'indicator') return '';

  const indicator = node.indicator;
  if (!indicator) return '';

  const indicatorName = formatIndicatorName(indicator.type, node.metric);
  const comparison = node.comparison;

  // DMI인 경우 상세 정보 추가
  if (indicator.type === 'dmi' && indicator.config) {
    const dmiDetails = formatDMIConfig(indicator.config);
    if (dmiDetails.length > 0) {
      return `${indicatorName} (${dmiDetails.join(' AND ')})`;
    }
  }

  // comparison이 없거나 none인 경우
  if (!comparison || comparison.kind === 'none') {
    // 디버그: 실제 구조 확인
    console.log('[formatIndicatorLeaf] No comparison or none:', {
      indicatorType: indicator.type,
      metric: node.metric,
      comparison: comparison,
      fullNode: JSON.stringify(node, null, 2)
    });
    return indicatorName;
  }

  if (comparison.kind === 'value') {
    return `${indicatorName} ${formatComparator(comparison.comparator)} ${comparison.value}`;
  }

  if (comparison.kind === 'candle') {
    const field = comparison.field === 'close' ? '종가' : comparison.field === 'open' ? '시가' : comparison.field === 'high' ? '고가' : '저가';
    return `${indicatorName} ${formatComparator(comparison.comparator)} ${field}`;
  }

  if (comparison.kind === 'indicator') {
    const targetIndicator = indicatorsMap.get(comparison.targetIndicatorId);
    if (targetIndicator) {
      const targetName = formatIndicatorName(targetIndicator.type, comparison.metric);
      return `${indicatorName} ${formatComparator(comparison.comparator)} ${targetName}`;
    }
    return `${indicatorName} ${formatComparator(comparison.comparator)} [지표]`;
  }

  // 디버그: 알 수 없는 comparison kind
  console.log('[formatIndicatorLeaf] Unknown comparison kind:', comparison);
  return indicatorName;
}

// ConditionNode를 한글로 변환 (재귀)
function formatConditionNode(node: any, indicatorsMap: Map<string, any>): string {
  if (!node) return '';

  if (node.kind === 'indicator') {
    return formatIndicatorLeaf(node, indicatorsMap);
  }

  if (node.kind === 'status') {
    // 상태 조건 (수익률 등)
    const metricName = node.metric === 'profitRate' ? '수익률' : node.metric;
    if (node.comparison && node.comparison.kind === 'value') {
      return `${metricName} ${formatComparator(node.comparison.comparator)} ${node.comparison.value}${node.unit === 'percent' ? '%' : ''}`;
    }
    return metricName;
  }

  if (node.kind === 'group') {
    const children = (node.children || []).map((child: any) => formatConditionNode(child, indicatorsMap)).filter(Boolean);
    if (children.length === 0) return '';
    if (children.length === 1) return children[0];

    const op = node.operator === 'and' ? ' & ' : ' | ';
    return children.join(op);
  }

  return '';
}

// IndicatorConditions 전체를 한글로 변환
function formatIndicatorConditions(indicators: any): string[] {
  if (!indicators || !indicators.root) return [];

  // 디버그: root 구조 확인
  console.log('[formatIndicatorConditions] Root structure:', JSON.stringify(indicators.root, null, 2));

  // 모든 indicator를 맵으로 수집
  const indicatorsMap = new Map<string, any>();
  const collectIndicators = (node: any) => {
    if (node.kind === 'indicator' && node.indicator) {
      indicatorsMap.set(node.indicator.id, node.indicator);
    }
    if (node.kind === 'group' && node.children) {
      node.children.forEach(collectIndicators);
    }
  };
  collectIndicators(indicators.root);

  console.log('[formatIndicatorConditions] Collected indicators:', Array.from(indicatorsMap.entries()));

  // root의 children을 그룹별로 변환
  const groups: string[] = [];
  const rootChildren = indicators.root.children || [];

  rootChildren.forEach((child: any, index: number) => {
    console.log(`[formatIndicatorConditions] Processing child ${index}:`, JSON.stringify(child, null, 2));
    const formatted = formatConditionNode(child, indicatorsMap);
    console.log(`[formatIndicatorConditions] Formatted result:`, formatted);
    if (formatted) {
      groups.push(`조건그룹${index + 1}: ${formatted}`);
    }
  });

  return groups;
}

// 지표 조건을 한글로 변환 (레거시, 사용 안함)
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
  if (!entry || !entry[direction]) return ['조건 없음'];

  const config = entry[direction];

  if (config.enabled === false) {
    return ['비활성화'];
  }

  // indicators 구조 확인
  const groups = formatIndicatorConditions(config.indicators);

  if (config.immediate && groups.length === 0) {
    return ['즉시 진입'];
  }

  if (groups.length > 0) {
    if (config.immediate) {
      return ['즉시 진입', ...groups];
    }
    return groups;
  }

  return ['조건 없음'];
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

  const groups = formatIndicatorConditions(config.indicators);
  summary.push(...groups);

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

  // 현재 수익률 조건
  if (config.currentProfitRate && config.currentProfitRate.enabled) {
    const comp = config.currentProfitRate.comparator;
    const val = config.currentProfitRate.value;
    const compText = formatComparator(comp);
    if (compText) {
      summary.push(`수익률 ${compText} ${val}%`);
    }
  }

  const groups = formatIndicatorConditions(config.indicators);
  summary.push(...groups);

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

  // 현재 수익률 조건
  if (hedge.currentProfitRate && hedge.currentProfitRate.enabled) {
    const comp = hedge.currentProfitRate.comparator;
    const val = hedge.currentProfitRate.value;
    const compText = formatComparator(comp);
    if (compText) {
      summary.push(`수익률 ${compText} ${val}%`);
    }
  }

  const groups = formatIndicatorConditions(hedge.indicators);
  summary.push(...groups);

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

  // 현재 수익률 조건
  if (config.currentProfitRate && config.currentProfitRate.enabled) {
    const comp = config.currentProfitRate.comparator;
    const val = config.currentProfitRate.value;
    const compText = formatComparator(comp);
    if (compText) {
      summary.push(`수익률 ${compText} ${val}%`);
    }
  }

  const groups = formatIndicatorConditions(config.indicators);
  summary.push(...groups);

  return summary.length > 0 ? summary : ['조건 없음'];
}
