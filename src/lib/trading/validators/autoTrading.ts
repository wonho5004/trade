import type {
  AggregatorOperator,
  AutoTradingSettings,
  ConditionNode,
  IndicatorConditions,
  IndicatorLeafNode,
  MaCondition,
  RsiCondition
} from '@/types/trading/auto-trading';

function hasAnyIndicator(conditions: IndicatorConditions | undefined): boolean {
  if (!conditions) return false;
  const root = conditions.root as unknown as ConditionNode;
  try {
    return collectIndicatorNodes(root).length > 0;
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

function validateMaCombination(config: MaCondition): string[] {
  const a = new Set(config.actions);
  const errs: string[] = [];
  if (a.has('break_above') && (a.has('break_below') || a.has('stay_below'))) errs.push('MA: 상단 돌파는 하단 관련 액션과 함께 사용할 수 없습니다.');
  if (a.has('break_below') && (a.has('break_above') || a.has('stay_above'))) errs.push('MA: 하단 돌파는 상단 관련 액션과 함께 사용할 수 없습니다.');
  if (a.has('stay_above') && (a.has('stay_below') || a.has('break_below'))) errs.push('MA: 상단 유지는 하단 관련 액션과 함께 사용할 수 없습니다.');
  if (a.has('stay_below') && (a.has('stay_above') || a.has('break_above'))) errs.push('MA: 하단 유지는 상단 관련 액션과 함께 사용할 수 없습니다.');
  return errs;
}

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
  const ids = collectIndicatorIds(root);
  const errs: string[] = [];
  if (options.requireIndicator && indicators.length === 0) errs.push(`${label}: 최소 1개의 지표가 필요합니다.`);
  for (const node of indicators) {
    const type = node.indicator.type;
    const config: any = node.indicator.config;
    if (type === 'ma') errs.push(...validateMaCombination(config as MaCondition));
    if (type === 'rsi') errs.push(...validateRsiCombination(config as RsiCondition));
    if (node.comparison.kind === 'indicator' && !ids.has(node.comparison.targetIndicatorId)) {
      errs.push(`${label}: 비교 대상을 찾을 수 없습니다.`);
    }
  }
  return errs;
}
