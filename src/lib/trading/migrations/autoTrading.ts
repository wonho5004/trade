// @ts-nocheck
import {
  createCapitalSettings,
  createDefaultAutoTradingSettings,
  createEntryDirectionSettings,
  createExitDirectionSettings,
  createHedgeActivationSettings,
  createIndicatorConditions,
  createIndicatorConfig,
  createIndicatorEntry,
  createIndicatorLeaf,
  createIndicatorComparisonLeaf,
  createIndicatorGroup,
  createCandleCondition,
  createCandleLeaf,
  createScaleInDirectionSettings,
  createStopLossConditions,
  createSymbolSelection,
  normalizeConditionTree
} from '@/lib/trading/autoTradingDefaults';
import type {
  AdditionalEntryConditions,
  AssetMode,
  AggregatorOperator,
  AutoTradingSettings,
  CandleCondition,
  CandleFieldOption,
  CandleReference,
  CapitalSettings,
  ComparisonOperator,
  ConditionGroupNode,
  ConditionNode,
  EntryConditions,
  EntryDirectionSettings,
  ExitConditions,
  ExitDirectionSettings,
  HedgeActivationSettings,
  IndicatorComparisonLeaf,
  IndicatorConditions,
  IndicatorConfigMap,
  IndicatorEntry,
  IndicatorKey,
  IndicatorLeafNode,
  CandleLeafNode,
  PositionDirection,
  PositionMode,
  StopLossConditions,
  SymbolSelection,
  TimeframeOption
} from '@/types/trading/auto-trading';

type PlainObject = Record<string, unknown>;

const VALID_TIMEFRAMES: TimeframeOption[] = ['1m', '3m', '5m', '15m', '1h', '4h', '8h', '12h', '24h'];

const isPlainObject = (value: unknown): value is PlainObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const clone = <T>(value: T): T =>
  typeof structuredClone === 'function' ? structuredClone(value) : (JSON.parse(JSON.stringify(value)) as T);

const isComparisonOperator = (value: unknown): value is ComparisonOperator =>
  value === 'over' || value === 'under' || value === 'eq' || value === 'gte' || value === 'lte' || value === 'none';

const isCandleField = (value: unknown): value is CandleFieldOption =>
  value === 'open' || value === 'high' || value === 'low' || value === 'close';

const isCandleReference = (value: unknown): value is CandleReference => value === 'current' || value === 'previous';

const deepMerge = <T>(defaults: T, overrides?: Partial<T> | Record<string, unknown>): T => {
  const result = clone(defaults);
  if (!isPlainObject(overrides)) {
    return result;
  }
  Object.entries(overrides).forEach(([rawKey, rawValue]) => {
    if (rawValue === undefined) {
      return;
    }
    const key = rawKey as keyof T;
    const baseValue = (result as PlainObject)[key as unknown as string];
    if (isPlainObject(baseValue) && isPlainObject(rawValue)) {
      (result as PlainObject)[key as unknown as string] = deepMerge(baseValue, rawValue);
      return;
    }
    (result as PlainObject)[key as unknown as string] = rawValue as unknown as T[keyof T];
  });
  return result;
};

const sanitizeNumber = (value: unknown, fallback: number): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return value;
};

const sanitizePositiveInteger = (value: unknown, fallback: number): number => {
  const numeric = sanitizeNumber(value, fallback);
  return numeric > 0 ? Math.trunc(numeric) : fallback;
};

const sanitizeAssetMode = (value: unknown, fallback: AssetMode): AssetMode =>
  value === 'multi' ? 'multi' : fallback;

const sanitizePositionMode = (value: unknown, fallback: PositionMode): PositionMode =>
  value === 'hedge' ? 'hedge' : fallback;

const sanitizeTimeframe = (value: unknown, fallback: TimeframeOption): TimeframeOption =>
  VALID_TIMEFRAMES.includes(value as TimeframeOption) ? (value as TimeframeOption) : fallback;

const sanitizeString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const sanitizeNullableString = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

const normalizeComparison = (legacy: unknown): IndicatorEntry['comparison'] => {
  if (!isPlainObject(legacy)) {
    return { mode: 'none' };
  }
  const { mode } = legacy as PlainObject;
  if (mode === 'candle') {
    const comparator = (legacy as PlainObject).comparator;
    const field = (legacy as PlainObject).field;
    const reference = (legacy as PlainObject).reference;
    return {
      mode: 'candle',
      comparator: isComparisonOperator(comparator) ? comparator : 'over',
      field: isCandleField(field) ? field : 'high',
      reference: isCandleReference(reference) ? reference : 'previous'
    };
  }
  if (mode === 'value') {
    const comparator = (legacy as PlainObject).comparator;
    const value = (legacy as PlainObject).value;
    if (isComparisonOperator(comparator) && typeof value === 'number' && Number.isFinite(value)) {
      return {
        mode: 'value',
        comparator,
        value
      };
    }
    return { mode: 'none' };
  }
  if (mode === 'indicator') {
    const comparator = (legacy as PlainObject).comparator;
    const target = (legacy as PlainObject).targetEntryId;
    if (isComparisonOperator(comparator) && typeof target === 'string' && target.length > 0) {
      return {
        mode: 'indicator',
        comparator,
        targetEntryId: target
      };
    }
    return { mode: 'none' };
  }
  return { mode: 'none' };
};

const filterDirections = (value: unknown): PositionDirection[] => {
  if (!Array.isArray(value)) {
    return ['long', 'short'];
  }
  const unique = new Set<PositionDirection>();
  value.forEach((direction) => {
    if (direction === 'long' || direction === 'short') {
      unique.add(direction);
    }
  });
  return unique.size > 0 ? Array.from(unique) : (['long', 'short'] as PositionDirection[]);
};

const isDirectionalRecord = (value: unknown): value is Partial<Record<PositionDirection, PlainObject>> =>
  isPlainObject(value) && (('long' in value && isPlainObject((value as PlainObject).long)) || ('short' in value && isPlainObject((value as PlainObject).short)));

const normalizeDirectional = <T>(
  legacy: unknown,
  factory: (direction: PositionDirection, source: PlainObject | undefined) => T
): Record<PositionDirection, T> => {
  if (isDirectionalRecord(legacy)) {
    const directional = legacy as Partial<Record<PositionDirection, PlainObject>>;
    return {
      long: factory('long', directional.long),
      short: factory('short', directional.short)
    };
  }
  if (isPlainObject(legacy)) {
    return {
      long: factory('long', legacy as PlainObject),
      short: factory('short', undefined)
    };
  }
  return {
    long: factory('long', undefined),
    short: factory('short', undefined)
  };
};

const INDICATOR_KEYS: IndicatorKey[] = ['bollinger', 'ma', 'rsi', 'dmi', 'macd'];

const isAggregator = (value: unknown): value is AggregatorOperator => value === 'and' || value === 'or';

const normalizeIndicatorComparisonLeaf = (legacy: unknown, fallbackId: string): IndicatorComparisonLeaf | { kind: 'none' } => {
  if (!isPlainObject(legacy)) {
    return { kind: 'none' };
  }
  const mode = (legacy as PlainObject).mode;
  const comparator = (legacy as PlainObject).comparator;
  if (!isComparisonOperator(comparator)) {
    return { kind: 'none' };
  }
  if (mode === 'candle') {
    const field = (legacy as PlainObject).field;
    const reference = (legacy as PlainObject).reference;
    return {
      kind: 'candle',
      comparator,
      field: isCandleField(field) ? field : 'high',
      reference: isCandleReference(reference) ? reference : 'previous'
    };
  }
  if (mode === 'value' && typeof (legacy as PlainObject).value === 'number' && Number.isFinite((legacy as PlainObject).value)) {
    return {
      kind: 'value',
      comparator,
      value: (legacy as PlainObject).value as number
    };
  }
  if (mode === 'indicator') {
    const target = (legacy as PlainObject).targetEntryId;
    if (typeof target === 'string' && target.length > 0) {
      return {
        kind: 'indicator',
        comparator,
        targetIndicatorId: target
      };
    }
  }
  return { kind: 'none' };
};

const normalizeIndicatorEntry = (entry: unknown, fallbackId: string, index: number): IndicatorLeafNode | null => {
  if (!isPlainObject(entry)) {
    return null;
  }
  const type = (entry as PlainObject).type as IndicatorKey;
  if (!INDICATOR_KEYS.includes(type)) {
    return null;
  }
  const configSource = (entry as PlainObject).config;
  const config = isPlainObject(configSource)
    ? deepMerge(createIndicatorConfig(type), configSource as Partial<IndicatorConfigMap[IndicatorKey]>)
    : createIndicatorConfig(type);
  const normalizedEntry = createIndicatorEntry(type);
  normalizedEntry.id = typeof (entry as PlainObject).id === 'string' ? ((entry as PlainObject).id as string) : `${fallbackId}-${index}`;
  normalizedEntry.config = config;
  const comparison = normalizeIndicatorComparisonLeaf((entry as PlainObject).comparison, normalizedEntry.id);
  return createIndicatorLeaf(normalizedEntry, comparison);
};

const normalizeNodesArray = (items: unknown[], fallbackId: string): ConditionNode[] => {
  return items
    .map((item, index) => {
      // Delegate to normalizeNode so that we correctly handle 'group', 'indicator' leaf and 'candle' leaf shapes.
      return normalizeNode(item, `${fallbackId}-${index}`);
    })
    .filter((node): node is ConditionNode => node != null);
};

const normalizeNode = (legacyNode: unknown, fallbackId: string): ConditionNode | null => {
  if (!isPlainObject(legacyNode)) {
    return null;
  }
  const kind = (legacyNode as PlainObject).kind;
  if (kind === 'group') {
    const operatorValue = (legacyNode as PlainObject).operator;
    const operator = isAggregator(operatorValue) ? operatorValue : 'and';
    const childrenSource = Array.isArray((legacyNode as PlainObject).children)
      ? ((legacyNode as PlainObject).children as unknown[])
      : [];
    const children = normalizeNodesArray(childrenSource, `${fallbackId}-child`);
    // Preserve incoming group id if present to avoid id churn across normalizations
    const id = typeof (legacyNode as PlainObject).id === 'string' ? ((legacyNode as PlainObject).id as string) : fallbackId;
    return { kind: 'group', id, operator, children } as ConditionGroupNode;
  }
  if (kind === 'indicator') {
    // Support both legacy `entry` shape and normalized leaf shape
    const obj = legacyNode as PlainObject;
    if (isPlainObject(obj.indicator) && (obj.indicator as PlainObject).type) {
      const t = (obj.indicator as PlainObject).type as IndicatorKey;
      const cfgSource = (obj.indicator as PlainObject).config;
      const cfg = isPlainObject(cfgSource)
        ? deepMerge(createIndicatorConfig(t), cfgSource as Partial<IndicatorConfigMap[IndicatorKey]>)
        : createIndicatorConfig(t);
      const entry = createIndicatorEntry(t);
      entry.id = typeof obj.id === 'string' ? (obj.id as string) : `${fallbackId}-0`;
      entry.config = cfg;
      const cmp = isPlainObject(obj.comparison) ? ((obj.comparison as unknown) as IndicatorComparisonLeaf | { kind: 'none' }) : { kind: 'none' };
      return { kind: 'indicator', id: entry.id, indicator: entry, comparison: cmp } as IndicatorLeafNode;
    }
    return normalizeIndicatorEntry(legacyNode, fallbackId, 0);
  }
  if (kind === 'candle') {
    const candleSource = (legacyNode as PlainObject).candle;
    const candle = isPlainObject(candleSource)
      ? deepMerge(createCandleCondition(), candleSource as Partial<CandleCondition>)
      : createCandleCondition();
    return createCandleLeaf(candle);
  }
  return null;
};

const normalizeIndicatorConditions = (legacy: unknown): IndicatorConditions => {
  const defaults = createIndicatorConditions();
  const toCompat = (root: ConditionGroupNode): IndicatorConditions => {
    // Build a legacy-compatible view for tests: entries + candle + defaultAggregator
    const entries: unknown[] = [];
    let candle: unknown = undefined;
    const flatten = (node: ConditionNode) => {
      if (node.kind === 'candle') {
        candle = node.candle;
      } else if (node.kind === 'indicator') {
        entries.push({
          id: node.id,
          type: node.indicator.type,
          aggregator: 'and',
          config: node.indicator.config,
          comparison: { mode: 'none' }
        });
      } else if (node.kind === 'group') {
        node.children.forEach((child) => flatten(child));
      }
    };
    flatten(root);
    const compat = { root } as unknown as IndicatorConditions & {
      entries: unknown[];
      candle?: unknown;
      defaultAggregator: AggregatorOperator;
    };
    compat.entries = entries;
    compat.candle = candle;
    compat.defaultAggregator = root.operator;
    return compat;
  };

  if (!isPlainObject(legacy)) {
    return toCompat(defaults.root);
  }
  const legacyObject = legacy as PlainObject;

  // If a normalized tree `root` is provided, prefer it over legacy `entries`
  if ((legacyObject as PlainObject).root != null) {
    const rootNode = normalizeNode((legacyObject as PlainObject).root, 'root');
    if (rootNode) {
      return toCompat(normalizeConditionTree(rootNode));
    }
  }

  if (Array.isArray((legacyObject as PlainObject).entries)) {
    const defaultAggregator = isAggregator(legacyObject.defaultAggregator) ? (legacyObject.defaultAggregator as AggregatorOperator) : 'and';
    const nodes: ConditionNode[] = [];

    const candleSource = (legacyObject as PlainObject).candle;
    if (isPlainObject(candleSource)) {
      const candle = deepMerge(createCandleCondition(), candleSource as Partial<CandleCondition>);
      nodes.push(createCandleLeaf(candle));
    }

    (legacyObject.entries as unknown[]).forEach((entry, index) => {
      const normalized = normalizeIndicatorEntry(entry, 'legacy-entry', index);
      if (normalized) {
        nodes.push(normalized);
      }
    });

    const root = normalizeConditionTree(createIndicatorGroup(defaultAggregator, nodes));
    const dedupeRoot = (group: ConditionGroupNode): ConditionGroupNode => {
      const seen = new Set<string>();
      const children: ConditionNode[] = [];
      for (const child of group.children) {
        if ((child as any).kind === 'indicator') {
          const ind = child as IndicatorLeafNode;
          const fp = `${ind.indicator.type}|${JSON.stringify(ind.indicator.config)}|${JSON.stringify(ind.comparison)}`;
          if (seen.has(fp)) continue;
          seen.add(fp);
          children.push(child);
        } else {
          children.push(child);
        }
      }
      return { ...group, children };
    };
    return toCompat(dedupeRoot(root));
  }

  // Handle partial legacy shape: aggregator/candle provided without entries/root
  if (
    (legacyObject as PlainObject).aggregator != null ||
    (legacyObject as PlainObject).candle != null
  ) {
    const operator = isAggregator((legacyObject as PlainObject).aggregator) ? ((legacyObject as PlainObject).aggregator as AggregatorOperator) : 'and';
    const nodes: ConditionNode[] = [];
    const candleSource = (legacyObject as PlainObject).candle;
    if (isPlainObject(candleSource)) {
      const candle = deepMerge(createCandleCondition(), candleSource as Partial<CandleCondition>);
      nodes.push(createCandleLeaf(candle));
    }
    const root = normalizeConditionTree(createIndicatorGroup(operator, nodes));
    const compat = toCompat(root) as unknown as IndicatorConditions & { entries: unknown[] };
    compat.entries = [];
    return compat;
  }

  // handled above

  return toCompat(defaults.root);
};

const normalizeEntry = (legacy: unknown): EntryConditions =>
  normalizeDirectional<EntryDirectionSettings>(legacy, (direction, source) => {
    const defaults = createEntryDirectionSettings(direction);
    if (!isPlainObject(source)) {
      return defaults;
    }
    const merged = deepMerge(defaults, source);
    merged.indicators = normalizeIndicatorConditions(source.indicators);
    return merged;
  });

const normalizeScaleIn = (legacy: unknown): AdditionalEntryConditions =>
  normalizeDirectional(legacy, (direction, source) => {
    const defaults = createScaleInDirectionSettings(direction);
    if (!isPlainObject(source)) {
      return defaults;
    }
    const merged = deepMerge(defaults, source);
    merged.profitTarget = deepMerge(defaults.profitTarget, source.profitTarget as PlainObject | undefined);
    // 추가: 현재 수익률 조건 병합
    merged.currentProfitRate = deepMerge(defaults.currentProfitRate, (source as PlainObject).currentProfitRate as PlainObject | undefined);
    merged.indicators = normalizeIndicatorConditions(source.indicators);
    return merged;
  });

const normalizeExit = (legacy: unknown): ExitConditions =>
  normalizeDirectional<ExitDirectionSettings>(legacy, (direction, source) => {
    const defaults = createExitDirectionSettings(direction);
    if (!isPlainObject(source)) {
      return defaults;
    }
    const merged = deepMerge(defaults, source);
    merged.profitTarget = deepMerge(defaults.profitTarget, source.profitTarget as PlainObject | undefined);
    // 추가: 현재 수익률 조건 병합
    merged.currentProfitRate = deepMerge(defaults.currentProfitRate, (source as PlainObject).currentProfitRate as PlainObject | undefined);
    merged.indicators = normalizeIndicatorConditions(source.indicators);
    return merged;
  });

const normalizeStopLoss = (legacy: unknown): StopLossConditions => {
  const defaults = createStopLossConditions();
  if (!isPlainObject(legacy)) {
    return defaults;
  }
  const merged = deepMerge(defaults, legacy as Partial<StopLossConditions>);
  merged.profitTarget = deepMerge(defaults.profitTarget, (legacy as PlainObject).profitTarget as PlainObject | undefined);
  merged.stopLossLine = deepMerge(defaults.stopLossLine, (legacy as PlainObject).stopLossLine as PlainObject | undefined);
  // 추가: 현재 수익률 조건 병합
  merged.currentProfitRate = deepMerge(defaults.currentProfitRate, (legacy as PlainObject).currentProfitRate as PlainObject | undefined);
  merged.stopLossLine.indicators = normalizeIndicatorConditions(
    isPlainObject((legacy as PlainObject).stopLossLine) ? ((legacy as PlainObject).stopLossLine as PlainObject).indicators : undefined
  );
  merged.indicators = normalizeIndicatorConditions((legacy as PlainObject).indicators);
  return merged;
};

const normalizeCapital = (legacy: unknown): CapitalSettings => {
  const defaults = createCapitalSettings();
  if (!isPlainObject(legacy)) {
    return defaults;
  }
  const merged = deepMerge(defaults, legacy as Partial<CapitalSettings>);
  merged.estimatedBalance = sanitizeNumber((legacy as PlainObject).estimatedBalance, defaults.estimatedBalance);
  if (merged.estimatedBalance <= 0) {
    merged.estimatedBalance = defaults.estimatedBalance;
  }
  return merged;
};

const normalizeSymbolSelection = (legacy: unknown): SymbolSelection => {
  const defaults = createSymbolSelection();
  if (!isPlainObject(legacy)) {
    return defaults;
  }
  const merged = deepMerge(defaults, legacy as Partial<SymbolSelection>);
  merged.manualSymbols = Array.isArray(merged.manualSymbols) ? merged.manualSymbols.filter((symbol): symbol is string => typeof symbol === 'string') : [];
  merged.excludedSymbols = Array.isArray(merged.excludedSymbols)
    ? merged.excludedSymbols.filter((symbol): symbol is string => typeof symbol === 'string')
    : [];
  const leverageModeCandidate = (legacy as PlainObject).leverageMode;
  merged.leverageMode = leverageModeCandidate === 'custom' ? 'custom' : 'uniform';
  const overridesCandidate = (legacy as PlainObject).leverageOverrides;
  const sanitizedOverrides: Record<string, number> = {};
  if (isPlainObject(overridesCandidate)) {
    Object.entries(overridesCandidate).forEach(([symbol, value]) => {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 125) {
        sanitizedOverrides[symbol.toUpperCase()] = Math.round(value);
      }
    });
  }
  merged.leverageOverrides = sanitizedOverrides;
  return merged;
};

const normalizeHedgeActivation = (legacy: unknown): HedgeActivationSettings => {
  const defaults = createHedgeActivationSettings();
  if (!isPlainObject(legacy)) {
    return defaults;
  }
  const merged = deepMerge(defaults, legacy as Partial<HedgeActivationSettings>);
  merged.directions = filterDirections((legacy as PlainObject).directions);
  // 추가: 현재 수익률 조건 병합
  merged.currentProfitRate = deepMerge(defaults.currentProfitRate, (legacy as PlainObject).currentProfitRate as PlainObject | undefined);
  merged.indicators = normalizeIndicatorConditions((legacy as PlainObject).indicators);
  return merged;
};

const normalizeMetadata = (legacy: unknown) => {
  const defaults = createDefaultAutoTradingSettings().metadata;
  if (!isPlainObject(legacy)) {
    return defaults;
  }
  return {
    lastSavedAt: sanitizeNullableString((legacy as PlainObject).lastSavedAt),
    lastValidatedAt: sanitizeNullableString((legacy as PlainObject).lastValidatedAt)
  };
};

export const normalizeAutoTradingSettings = (raw: unknown): AutoTradingSettings => {
  const defaults = createDefaultAutoTradingSettings();
  if (!isPlainObject(raw)) {
    return defaults;
  }
  const data = raw as PlainObject;
  const leverage = sanitizeNumber(data.leverage, defaults.leverage);
  return {
    logicName: sanitizeString(data.logicName, defaults.logicName),
    leverage: leverage > 0 ? leverage : defaults.leverage,
    symbolCount: sanitizePositiveInteger(data.symbolCount, defaults.symbolCount),
    assetMode: sanitizeAssetMode(data.assetMode, defaults.assetMode),
    positionMode: sanitizePositionMode(data.positionMode, defaults.positionMode),
    capital: normalizeCapital(data.capital),
    timeframe: sanitizeTimeframe(data.timeframe, defaults.timeframe),
    symbolSelection: normalizeSymbolSelection(data.symbolSelection),
    entry: normalizeEntry(data.entry),
    scaleIn: normalizeScaleIn(data.scaleIn),
    exit: normalizeExit(data.exit),
    stopLoss: normalizeStopLoss(data.stopLoss),
    hedgeActivation: normalizeHedgeActivation(data.hedgeActivation),
    metadata: normalizeMetadata(data.metadata)
  };
};
// @ts-nocheck
