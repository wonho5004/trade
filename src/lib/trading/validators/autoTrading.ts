import type {
  AggregatorOperator,
  AutoTradingSettings,
  ConditionNode,
  IndicatorConditions,
  IndicatorLeafNode,
  MaCondition,
  RsiCondition,
  StatusLeafNode
} from '@/types/trading/auto-trading';

function hasAnyIndicator(conditions: IndicatorConditions | undefined): boolean {
  if (!conditions) return false;
  const root = conditions.root as unknown as ConditionNode;
  const hasAny = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false;
    if (node.kind === 'indicator' || node.kind === 'status') return true;
    if (node.kind === 'group') return node.children?.some((c: any) => hasAny(c)) ?? false;
    return false;
  };
  try {
    return hasAny(root);
  } catch {
    return false;
  }
}

export function assertSectionReady(section: 'basic' | 'entry' | 'scaleIn' | 'exit', settings: AutoTradingSettings) {
  if (section === 'basic') {
    if (!settings.logicName.trim()) {
      throw new Error('전략 이름을 입력하세요.');
    }
    if (!(settings.leverage >= 1 && settings.leverage <= 125)) {
      throw new Error('레버리지는 1~125 사이여야 합니다.');
    }
  }

  if (section === 'entry') {
    const longOk = !settings.entry.long.enabled || settings.entry.long.immediate || hasAnyIndicator(settings.entry.long.indicators);
    const shortOk = !settings.entry.short.enabled || settings.entry.short.immediate || hasAnyIndicator(settings.entry.short.indicators);
    if (!longOk || !shortOk) throw new Error('매수 조건이 비어 있습니다. 즉시 매수 또는 지표 조건을 설정하세요.');
    const errors: string[] = [];
    if (settings.entry.long.enabled && !settings.entry.long.immediate) errors.push(...validateIndicatorConditions(settings.entry.long.indicators, '롱 매수'));
    if (settings.entry.short.enabled && !settings.entry.short.immediate) errors.push(...validateIndicatorConditions(settings.entry.short.indicators, '숏 매수'));
    if (errors.length > 0) throw new Error(errors.join('\n'));
  }

  if (section === 'scaleIn') {
    // optional; only validate if enabled in either direction
    const enabled = settings.scaleIn.long.enabled || settings.scaleIn.short.enabled;
    if (enabled) {
      const ok = hasAnyIndicator(settings.scaleIn.long.indicators) || hasAnyIndicator(settings.scaleIn.short.indicators);
      if (!ok) throw new Error('추가 매수 조건이 설정되지 않았습니다.');
      const errors: string[] = [];
      if (settings.scaleIn.long.enabled) errors.push(...validateIndicatorConditions(settings.scaleIn.long.indicators, '롱 추가 매수'));
      if (settings.scaleIn.short.enabled) errors.push(...validateIndicatorConditions(settings.scaleIn.short.indicators, '숏 추가 매수'));
      if (errors.length > 0) throw new Error(errors.join('\n'));
    }
  }

  if (section === 'exit') {
    // allow profit-only exits; no strict indicator requirement
    const oneEnabled = settings.exit.long.enabled || settings.exit.short.enabled;
    if (!oneEnabled) {
      throw new Error('매도(청산) 섹션에서 최소 한 방향을 활성화하세요.');
    }
    const errors: string[] = [];
    if (settings.exit.long.enabled) errors.push(...validateIndicatorConditions(settings.exit.long.indicators, '롱 청산', { requireIndicator: false }));
    if (settings.exit.short.enabled) errors.push(...validateIndicatorConditions(settings.exit.short.indicators, '숏 청산', { requireIndicator: false }));
    if (errors.length > 0) throw new Error(errors.join('\n'));
  }
}

export function assertAllSectionsReady(settings: AutoTradingSettings) {
  assertSectionReady('basic', settings);
  assertSectionReady('entry', settings);
  // scaleIn and exit are optional but we still call to surface basic errors
  assertSectionReady('scaleIn', settings);
  assertSectionReady('exit', settings);
}

// ---- Detailed indicator tree validations ----

function collectIndicatorNodes(node: ConditionNode, acc: IndicatorLeafNode[] = []): IndicatorLeafNode[] {
  if ((node as any).kind === 'indicator') {
    acc.push(node as IndicatorLeafNode);
    return acc;
  }
  if ((node as any).kind === 'group') {
    (node as any).children.forEach((child: ConditionNode) => collectIndicatorNodes(child, acc));
  }
  return acc;
}

function collectIndicatorIds(root: ConditionNode): Set<string> {
  const ids = new Set<string>();
  collectIndicatorNodes(root).forEach((n) => ids.add(n.id));
  return ids;
}

function collectStatusNodes(node: ConditionNode, acc: StatusLeafNode[] = []): StatusLeafNode[] {
  if ((node as any).kind === 'status') {
    acc.push(node as any);
    return acc;
  }
  if ((node as any).kind === 'group') {
    (node as any).children.forEach((c: any) => collectStatusNodes(c, acc));
  }
  return acc;
}

function validateStatusNode(node: StatusLeafNode, label: string): string[] {
  const errs: string[] = [];
  const cmp = node.comparator;
  if (!cmp || cmp === 'none') errs.push(`${label}: 상태(${node.metric}) 비교연산자를 선택하세요.`);
  const v = Number(node.value);
  if (!Number.isFinite(v)) errs.push(`${label}: 상태(${node.metric}) 값이 올바르지 않습니다.`);
  if (node.metric === 'profitRate') {
    if (node.unit !== 'percent') errs.push(`${label}: 상태(수익률) 단위가 잘못되었습니다.`);
    if (!(v >= -10000 && v <= 10000)) errs.push(`${label}: 상태(수익률) 값은 -10000~10000 범위여야 합니다.`);
  } else if (node.metric === 'margin') {
    if (!(node.unit === 'USDT' || node.unit === 'USDC')) errs.push(`${label}: 상태(마진) 단위는 USDT/USDC 이어야 합니다.`);
    if (!(v >= 0)) errs.push(`${label}: 상태(마진) 값은 0 이상이어야 합니다.`);
  } else if (node.metric === 'buyCount') {
    if (node.unit !== 'count') errs.push(`${label}: 상태(매수횟수) 단위는 count 이어야 합니다.`);
    if (!(Number.isInteger(v) && v >= 1)) errs.push(`${label}: 상태(매수횟수) 값은 1 이상의 정수여야 합니다.`);
  } else if (node.metric === 'entryAge') {
    if (node.unit !== 'days') errs.push(`${label}: 상태(진입경과) 단위는 days 이어야 합니다.`);
    if (!(v >= 0)) errs.push(`${label}: 상태(진입경과) 값은 0 이상이어야 합니다.`);
  }
  return errs;
}

// MA validation removed - now using comparison operators instead of actions

function validateRsiCombination(config: RsiCondition): string[] {
  const a = new Set(config.actions);
  const errs: string[] = [];
  if (a.has('cross_above') && (a.has('cross_below') || a.has('stay_below'))) errs.push('RSI: 상향 교차는 하향 교차/하단 유지와 함께 사용할 수 없습니다.');
  if (a.has('cross_below') && (a.has('cross_above') || a.has('stay_above'))) errs.push('RSI: 하향 교차는 상향 교차/상단 유지와 함께 사용할 수 없습니다.');
  if (a.has('stay_above') && (a.has('stay_below') || a.has('cross_below'))) errs.push('RSI: 상단 유지는 하단 유지/하향 교차와 함께 사용할 수 없습니다.');
  if (a.has('stay_below') && (a.has('stay_above') || a.has('cross_above'))) errs.push('RSI: 하단 유지는 상단 유지/상향 교차와 함께 사용할 수 없습니다.');
  return errs;
}

export function validateIndicatorConditions(
  conditions: IndicatorConditions | undefined,
  label: string,
  options: { requireIndicator?: boolean } = { requireIndicator: true }
): string[] {
  if (!conditions) return options.requireIndicator ? [`${label}: 지표 조건이 필요합니다.`] : [];
  const root = conditions.root as unknown as ConditionNode;
  const indicators = collectIndicatorNodes(root);
  const statuses = collectStatusNodes(root);
  const ids = collectIndicatorIds(root);
  const errs: string[] = [];
  if (options.requireIndicator && indicators.length === 0 && statuses.length === 0) errs.push(`${label}: 최소 1개의 조건(지표/상태)이 필요합니다.`);
  for (const node of indicators) {
    const type = node.indicator.type;
    const config: any = node.indicator.config;
    // MA validation removed - now using comparison operators
    if (type === 'rsi') errs.push(...validateRsiCombination(config as RsiCondition));
    if (node.comparison.kind === 'indicator' && !ids.has(node.comparison.targetIndicatorId)) {
      errs.push(`${label}: 비교 대상을 찾을 수 없습니다.`);
    }
  }
  for (const s of statuses) {
    errs.push(...validateStatusNode(s, label));
  }
  return errs;
}
