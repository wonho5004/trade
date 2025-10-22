import type {
  AutoTradingSettings,
  AdditionalEntryConditions,
  CapitalSettings,
  EntryConditions,
  EntryDirectionSettings,
  ExitConditions,
  ExitDirectionSettings,
  HedgeActivationSettings,
  IndicatorConditions,
  IndicatorConfigMap,
  IndicatorEntry,
  IndicatorKey,
  AggregatorOperator,
  ConditionGroupNode,
  ConditionNode,
  IndicatorLeafNode,
  CandleLeafNode,
  InitialMarginSetting,
  PositionDirection,
  ProfitCondition,
  ScaleInBudget,
  ScaleInDirectionSettings,
  ScaleInLimit,
  StopLossConditions,
  StopLossLineSettings,
  SymbolSelection,
  ThresholdCondition,
  IndicatorComparisonLeaf,
  CandleCondition,
  ComparisonOperator,
  CandleFieldOption,
  CandleReference
} from '@/types/trading/auto-trading';

export const createProfitCondition = (): ProfitCondition => ({
  enabled: false,
  comparator: 'over',
  value: 0
});

export const createThresholdCondition = (): ThresholdCondition => ({
  enabled: false,
  comparator: 'over',
  value: 0
});

const createIndicatorEntryId = () => `ind-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createConditionNodeId = () => `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const createCandleCondition = (): CandleCondition => ({
  enabled: false,
  field: 'close',
  comparator: 'over',
  targetValue: 0,
  reference: 'current'
});

export const createCandleLeaf = (candle?: CandleCondition): CandleLeafNode => ({
  kind: 'candle',
  id: createConditionNodeId(),
  candle: candle ? { ...candle } : createCandleCondition()
});

export const createBollingerCondition = (): IndicatorConfigMap['bollinger'] => ({
  enabled: false,
  length: 20,
  standardDeviation: 2,
  offset: 0,
  band: 'middle',
  action: 'touch',
  touchTolerancePct: 0.2
});

export const createMaCondition = (): IndicatorConfigMap['ma'] => ({
  enabled: false,
  period: 20,
  actions: []
});

export const createRsiCondition = (): IndicatorConfigMap['rsi'] => ({
  enabled: false,
  period: 14,
  smoothing: 'sma',
  threshold: 50,
  actions: []
});

export const createDmiCondition = (): IndicatorConfigMap['dmi'] => ({
  enabled: false,
  diPeriod: 14,
  adxPeriod: 14,
  adx: createThresholdCondition(),
  diComparison: null,
  diPlus: createThresholdCondition(),
  diMinus: createThresholdCondition(),
  adxVsDi: null
});

export const createMacdCondition = (): IndicatorConfigMap['macd'] => ({
  enabled: false,
  fast: 12,
  slow: 26,
  signal: 9,
  source: 'close',
  method: 'EMA',
  comparison: null,
  histogramAction: null
});

export const createIndicatorConfig = <T extends IndicatorKey>(indicator: T): IndicatorConfigMap[T] => {
  switch (indicator) {
    case 'bollinger':
      return createBollingerCondition() as IndicatorConfigMap[T];
    case 'ma':
      return createMaCondition() as IndicatorConfigMap[T];
    case 'rsi':
      return createRsiCondition() as IndicatorConfigMap[T];
    case 'dmi':
      return createDmiCondition() as IndicatorConfigMap[T];
    case 'macd':
      return createMacdCondition() as IndicatorConfigMap[T];
    default:
      return createBollingerCondition() as IndicatorConfigMap[T];
  }
};

export const createIndicatorEntry = <T extends IndicatorKey>(indicator: T): IndicatorEntry<T> => ({
  id: createIndicatorEntryId(),
  type: indicator,
  config: createIndicatorConfig(indicator)
});

export const createIndicatorComparisonLeaf = (
  legacy: unknown = { kind: 'none' },
  fallbackId: string
): IndicatorComparisonLeaf | { kind: 'none' } => {
  if (!legacy || typeof legacy !== 'object') {
    return { kind: 'none' };
  }
  const candidate = legacy as any;
  if (candidate.kind === 'candle' && candidate.field && candidate.reference && candidate.comparator) {
    return {
      kind: 'candle',
      comparator: candidate.comparator,
      field: candidate.field,
      reference: candidate.reference
    };
  }
  if (candidate.kind === 'value' && typeof candidate.value === 'number' && candidate.comparator) {
    return {
      kind: 'value',
      comparator: candidate.comparator,
      value: candidate.value
    };
  }
  if (candidate.kind === 'indicator' && candidate.comparator) {
    return {
      kind: 'indicator',
      comparator: candidate.comparator,
      targetIndicatorId: candidate.targetIndicatorId ?? fallbackId
    };
  }
  return { kind: 'none' };
};

export const createIndicatorLeaf = (
  indicator: IndicatorEntry,
  comparison: IndicatorComparisonLeaf | { kind: 'none' } = { kind: 'none' }
): IndicatorLeafNode => ({
  kind: 'indicator',
  id: createConditionNodeId(),
  indicator,
  comparison
});

export const createIndicatorGroup = (
  operator: AggregatorOperator = 'and',
  children: ConditionNode[] = []
): ConditionGroupNode => ({
  kind: 'group',
  id: createConditionNodeId(),
  operator,
  children
});

export const createIndicatorConditions = (operator: AggregatorOperator = 'or'): IndicatorConditions => {
  // Stable default tree with deterministic IDs for test equality
  const candle = createCandleCondition();
  const root: ConditionGroupNode = {
    kind: 'group',
    id: 'cond-root',
    operator,
    children: []
  };

  // Return a legacy-compatible shape for transitional tests
  return {
    root,
    candle,
    entries: [],
    defaultAggregator: root.operator
  } as unknown as IndicatorConditions;
};

export const normalizeConditionTree = (root: ConditionNode): ConditionGroupNode => {
  // Defensive: tolerate unexpected/legacy shapes where `root` may be missing or malformed
  const isValidNode = (n: any) => n && typeof n === 'object' && typeof n.kind === 'string';
  const base: ConditionNode = isValidNode(root)
    ? (root as ConditionNode)
    : createIndicatorGroup('and', []);

  const collectIndicatorIds = (node: ConditionNode, acc: Set<string>) => {
    if (node.kind === 'indicator') {
      acc.add(node.id);
      return;
    }
    if (node.kind === 'group') {
      node.children.forEach((child) => collectIndicatorIds(child, acc));
    }
  };

  const sanitizeComparisons = (node: ConditionNode, indicatorIds: Set<string>): ConditionNode => {
    if (node.kind === 'indicator') {
      if (node.comparison.kind === 'indicator' && !indicatorIds.has(node.comparison.targetIndicatorId)) {
        return { ...node, comparison: { kind: 'none' } };
      }
      return node;
    }
    if (node.kind === 'group') {
      return {
        ...node,
        children: node.children.map((child) => sanitizeComparisons(child, indicatorIds))
      };
    }
    return node;
  };

  const ensureGroupRoot = (node: ConditionNode): ConditionGroupNode => {
    if (node.kind === 'group') return { ...node };
    return createIndicatorGroup('and', [node]);
  };

  const indicatorIds = new Set<string>();
  collectIndicatorIds(base, indicatorIds);
  const sanitized = sanitizeComparisons(base, indicatorIds);
  return ensureGroupRoot(sanitized);
};

const createInitialMarginSetting = (): InitialMarginSetting => ({
  basis: 'wallet',
  mode: 'per_symbol_percentage',
  percentage: 5,
  minNotional: 0,
  usdtAmount: 0,
  asset: 'USDT'
});

const createScaleInBudget = (): ScaleInBudget => ({
  mode: 'balance_percentage',
  basis: 'wallet',
  percentage: 5,
  minNotional: 0,
  usdtAmount: 0,
  asset: 'USDT'
});

const createScaleInLimit = (): ScaleInLimit => ({
  balance: {
    enabled: false,
    basis: 'wallet',
    percentage: 10
  },
  initialMargin: {
    enabled: false,
    percentage: 100
  },
  purchaseCount: {
    enabled: false,
    comparator: 'over',
    value: 1
  },
  profitRate: createProfitCondition(),
  unlimited: true
});

export const createCapitalSettings = (): CapitalSettings => ({
  estimatedBalance: 10000,
  maxMargin: {
    basis: 'wallet',
    percentage: 20
  },
  initialMargin: createInitialMarginSetting(),
  scaleInBudget: createScaleInBudget(),
  scaleInLimit: createScaleInLimit(),
  useMinNotionalFallback: true,
  hedgeBudget: {
    separateByDirection: false,
    long: { mode: 'position_percent', percentage: 100 },
    short: { mode: 'position_percent', percentage: 100 }
  }
});

export const createEntryDirectionSettings = (direction: PositionDirection): EntryDirectionSettings => ({
  enabled: false,
  immediate: false,
  indicators: createIndicatorConditions()
});

export const createEntryConditions = (): EntryConditions => ({
  long: createEntryDirectionSettings('long'),
  short: createEntryDirectionSettings('short')
});

export const createScaleInDirectionSettings = (direction: PositionDirection): ScaleInDirectionSettings => ({
  enabled: direction === 'long',
  profitTarget: createProfitCondition(),
  currentProfitRate: createProfitCondition(),
  indicators: createIndicatorConditions(),
  currentBuyNotional: { enabled: false, asset: 'USDT', comparator: 'none', value: 0 },
  initialBuyChange: { enabled: false, comparator: 'none', value: 0 }
});

export const createScaleInConditions = (): AdditionalEntryConditions => ({
  long: createScaleInDirectionSettings('long'),
  short: createScaleInDirectionSettings('short')
});

export const createExitDirectionSettings = (direction: PositionDirection): ExitDirectionSettings => ({
  enabled: direction === 'long',
  profitTarget: createProfitCondition(),
  currentProfitRate: createProfitCondition(),
  indicators: createIndicatorConditions(),
  includeFeesFunding: false,
  currentBuyNotional: { enabled: false, asset: 'USDT', comparator: 'none', value: 0 },
  initialBuyChange: { enabled: false, comparator: 'none', value: 0 },
  sellAmount: { mode: 'percent', value: 0 }
});

export const createExitConditions = (): ExitConditions => ({
  long: createExitDirectionSettings('long'),
  short: createExitDirectionSettings('short')
});

export const createStopLossLineSettings = (): StopLossLineSettings => ({
  enabled: false,
  autoRecreate: true,
  profitTarget: createProfitCondition(),
  indicators: createIndicatorConditions()
});

export const createStopLossConditions = (): StopLossConditions => ({
  profitTarget: createProfitCondition(),
  currentProfitRate: createProfitCondition(),
  purchaseCount: {
    enabled: false,
    comparator: 'over',
    value: 1
  },
  stopLossLine: createStopLossLineSettings(),
  indicators: createIndicatorConditions()
});

export const createSymbolSelection = (): SymbolSelection => ({
  manualSymbols: [],
  ranking: {
    market_cap: null,
    volume: null,
    top_gainers: null,
    top_losers: null
  },
  excludedSymbols: [],
  excludedReasons: {},
  respectDefaultExclusions: true,
  leverageMode: 'uniform',
  leverageOverrides: {},
  positionOverrides: {},
  featureOverrides: {},
  maxListingAgeDays: null,
  rankingSort: 'alphabet',
  autoFillRecheck: false,
  excludeTopGainers: null,
  excludeTopLosers: null,
  excludeBottomVolume: null,
  excludeBottomMarketCap: null
});

export const createHedgeActivationSettings = (): HedgeActivationSettings => ({
  enabled: false,
  directions: ['long', 'short'],
  currentProfitRate: createProfitCondition(),
  indicators: createIndicatorConditions()
});

export const createDefaultAutoTradingSettings = (): AutoTradingSettings => ({
  logicName: '',
  leverage: 5,
  symbolCount: 1,
  assetMode: 'single',
  positionMode: 'one_way',
  capital: createCapitalSettings(),
  timeframe: '3m',
  symbolSelection: createSymbolSelection(),
  entry: createEntryConditions(),
  scaleIn: createScaleInConditions(),
  exit: createExitConditions(),
  stopLoss: createStopLossConditions(),
  hedgeActivation: createHedgeActivationSettings(),
  metadata: {
    lastSavedAt: null,
    lastValidatedAt: null
  }
});
