/**
 * 조건 노드를 사람이 읽을 수 있는 텍스트로 변환하는 유틸리티 함수들
 */

import type {
  ConditionNode,
  IndicatorLeafNode,
  StatusLeafNode,
  CandleLeafNode,
  ActionLeafNode,
  ComparisonOperator,
  StatusMetric,
  IndicatorEntry,
  BollingerCondition,
  MaCondition,
  RsiCondition,
  MacdCondition
} from '@/types/trading/auto-trading';

/**
 * 비교 연산자를 기호로 변환
 */
export function formatComparator(comp: ComparisonOperator): string {
  const map: Record<ComparisonOperator, string> = {
    over: '>',
    under: '<',
    eq: '=',
    gte: '≥',
    lte: '≤',
    none: ''
  };
  return map[comp] || comp;
}

/**
 * 비교 연산자를 한글로 변환
 */
export function formatComparatorKorean(comp: ComparisonOperator): string {
  const map: Record<ComparisonOperator, string> = {
    over: '초과',
    under: '미만',
    eq: '같음',
    gte: '이상',
    lte: '이하',
    none: '선택안함'
  };
  return map[comp] || comp;
}

/**
 * 지표 엔트리를 텍스트로 변환
 */
export function formatIndicatorEntry(indicator: IndicatorEntry): string {
  switch (indicator.type) {
    case 'bollinger': {
      const config = indicator.config as BollingerCondition;
      return `볼린저밴드(${config.length}, ${config.standardDeviation}σ) ${config.band === 'upper' ? '상단' : config.band === 'lower' ? '하단' : '중간'}`;
    }

    case 'ma': {
      const config = indicator.config as MaCondition;
      return `MA(${config.period})`;
    }

    case 'rsi': {
      const config = indicator.config as RsiCondition;
      return `RSI(${config.period})`;
    }

    case 'dmi':
      return 'DMI';

    case 'macd': {
      const config = indicator.config as MacdCondition;
      return `MACD(${config.fast}, ${config.slow}, ${config.signal})`;
    }

    default:
      return indicator.type;
  }
}

/**
 * 지표 세부값을 한글로 변환
 */
function formatMetric(type: string, metric?: string): string {
  if (!metric) return '';

  const metricMap: Record<string, Record<string, string>> = {
    bollinger: {
      upper: '상단',
      middle: '중간',
      lower: '하단'
    },
    macd: {
      macd: 'MACD',
      signal: 'Signal',
      histogram: 'Histogram'
    },
    dmi: {
      diplus: 'DI+',
      diminus: 'DI-',
      adx: 'ADX'
    }
  };

  return metricMap[type]?.[metric] || metric;
}

/**
 * 지표 조건 노드를 읽기 쉬운 텍스트로 변환
 */
export function formatIndicatorCondition(node: IndicatorLeafNode): string {
  let indicatorText = formatIndicatorEntry(node.indicator);

  // 지표 세부값 추가 (예: 볼린저밴드 상단)
  if (node.metric) {
    const metricText = formatMetric(node.indicator.type, node.metric);
    if (metricText) {
      indicatorText += ` ${metricText}`;
    }
  }

  // 캔들 참조 추가 (현재/이전)
  if (node.reference) {
    const refMap = { current: '현재', previous: '이전' };
    indicatorText = `${refMap[node.reference] || node.reference} ${indicatorText}`;
  }

  if (node.comparison.kind === 'none') {
    return indicatorText;
  }

  if (node.comparison.kind === 'value') {
    return `${indicatorText} ${formatComparator(node.comparison.comparator)} ${node.comparison.value}`;
  }

  if (node.comparison.kind === 'candle') {
    const fieldMap = {
      open: '시가',
      high: '고가',
      low: '저가',
      close: '종가'
    };
    const refMap = {
      current: '현재',
      previous: '이전'
    };
    const field = fieldMap[node.comparison.field] || node.comparison.field;
    const ref = refMap[node.comparison.reference] || node.comparison.reference;
    return `${indicatorText} ${formatComparator(node.comparison.comparator)} ${ref} ${field}`;
  }

  if (node.comparison.kind === 'indicator') {
    // 비교 대상 지표의 metric도 표시
    let targetText = '[다른 지표]';
    if (node.comparison.metric) {
      // 대상 지표 타입을 알 수 없으므로 일단 원본 표시
      targetText = `[지표 ${node.comparison.metric}]`;
    }
    if (node.comparison.reference) {
      const refMap = { current: '현재', previous: '이전' };
      targetText = `${refMap[node.comparison.reference] || node.comparison.reference} ${targetText}`;
    }
    return `${indicatorText} ${formatComparator(node.comparison.comparator)} ${targetText}`;
  }

  return indicatorText;
}

/**
 * 상태 조건 노드를 읽기 쉬운 텍스트로 변환
 */
export function formatStatusCondition(node: StatusLeafNode): string {
  const labels: Record<StatusMetric, string> = {
    profitRate: '현재 수익률',
    margin: '현재 마진',
    buyCount: '매수 횟수',
    entryAge: '진입 경과시간'
  };

  const label = labels[node.metric] || node.metric;
  const comp = formatComparator(node.comparator);

  // unit에 따라 표시 형식 변경
  let valueText = '';
  if (node.unit === 'percent') {
    valueText = `${node.value}%`;
  } else if (node.unit === 'USDT' || node.unit === 'USDC') {
    valueText = `${node.value} ${node.unit}`;
  } else if (node.unit === 'count') {
    valueText = `${node.value}회`;
  } else if (node.unit === 'days') {
    valueText = `${node.value}일`;
  } else {
    valueText = String(node.value);
  }

  return `${label} ${comp} ${valueText}`;
}

/**
 * 캔들 조건 노드를 읽기 쉬운 텍스트로 변환
 */
export function formatCandleCondition(node: CandleLeafNode): string {
  const fieldMap = {
    open: '시가',
    high: '고가',
    low: '저가',
    close: '종가'
  };

  const refMap = {
    current: '현재',
    previous: '이전'
  };

  const field = fieldMap[node.candle.field] || node.candle.field;
  const ref = refMap[node.candle.reference] || node.candle.reference;
  const comp = formatComparator(node.candle.comparator);

  return `${ref} ${field} ${comp} ${node.candle.targetValue}`;
}

/**
 * 액션 노드를 읽기 쉬운 텍스트로 변환
 */
export function formatActionCondition(node: ActionLeafNode): string {
  const { action } = node;

  if (action.kind === 'buy') {
    let amountText = '';
    if (action.amountMode === 'usdt') {
      amountText = `${action.usdt}${action.asset || 'USDT'}`;
    } else if (action.amountMode === 'position_percent') {
      amountText = `현재 포지션의 ${action.positionPercent}%`;
    } else if (action.amountMode === 'wallet_percent') {
      amountText = `지갑의 ${action.walletPercent}%`;
    } else {
      amountText = '최소 주문단위';
    }

    return `매수 ${amountText}`;
  }

  if (action.kind === 'sell') {
    let amountText = '';
    if (action.amountMode === 'usdt') {
      amountText = `${action.usdt}${action.asset || 'USDT'}`;
    } else if (action.amountMode === 'position_percent') {
      amountText = `포지션의 ${action.positionPercent}%`;
    } else {
      amountText = '최소 주문단위';
    }

    return `매도 ${amountText}`;
  }

  if (action.kind === 'stoploss') {
    if (action.priceMode === 'input' && action.price) {
      return `손절 (${action.price})`;
    } else if (action.priceMode === 'indicator') {
      return '손절 (지표 기준)';
    } else {
      return '손절 (조건 기준)';
    }
  }

  return '액션';
}

/**
 * 조건 노드를 읽기 쉬운 텍스트로 변환 (통합 함수)
 */
export function formatConditionToReadable(condition: ConditionNode): string {
  switch (condition.kind) {
    case 'indicator':
      return formatIndicatorCondition(condition);

    case 'status':
      return formatStatusCondition(condition);

    case 'candle':
      return formatCandleCondition(condition);

    case 'action':
      return formatActionCondition(condition);

    case 'group':
      return `그룹 (${condition.operator.toUpperCase()})`;

    default:
      return '조건';
  }
}

/**
 * 조건 종류에 맞는 아이콘 반환
 */
export function getConditionIcon(condition: ConditionNode): string {
  switch (condition.kind) {
    case 'indicator':
      return '📊';
    case 'status':
      return '💰';
    case 'candle':
      return '📈';
    case 'action':
      return '⚡';
    case 'group':
      return '📁';
    default:
      return '📌';
  }
}

/**
 * 조건 종류에 맞는 색상 클래스 반환
 */
export function getConditionColorClass(condition: ConditionNode): string {
  switch (condition.kind) {
    case 'indicator':
      return 'border-blue-500/30 bg-blue-500/5';
    case 'status':
      return 'border-green-500/30 bg-green-500/5';
    case 'candle':
      return 'border-purple-500/30 bg-purple-500/5';
    case 'action':
      return 'border-orange-500/30 bg-orange-500/5';
    case 'group':
      return 'border-zinc-600 bg-zinc-800/50';
    default:
      return 'border-zinc-700 bg-zinc-900/50';
  }
}
