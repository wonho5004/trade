export type AssetMode = 'single' | 'multi';
export type PositionMode = 'one_way' | 'hedge';
export type PositionPreference = 'long' | 'short' | 'both';
export type MarginBasis = 'wallet' | 'total' | 'free' | 'tree';
export type InitialMarginMode = 'per_symbol_percentage' | 'all_symbols_percentage' | 'min_notional' | 'usdt_amount';
export type ScaleInBudgetMode = 'usdt_amount' | 'balance_percentage' | 'per_symbol_percentage' | 'position_percent' | 'min_notional';
export type TimeframeOption =
  | '1m'
  | '3m'
  | '5m'
  | '15m'
  | '1h'
  | '4h'
  | '8h'
  | '12h'
  | '24h';

export type CandleFieldOption = 'open' | 'high' | 'low' | 'close';
export type ComparisonOperator = 'over' | 'under' | 'eq' | 'lte' | 'gte' | 'none';
export type AggregatorOperator = 'and' | 'or';
export type IndicatorKey = 'bollinger' | 'ma' | 'rsi' | 'dmi' | 'macd';
export type LeverageMode = 'uniform' | 'custom';
export type CandleReference = 'current' | 'previous';

export type ProfitCondition = {
  enabled: boolean;
  comparator: ComparisonOperator;
  value: number;
};

export type CandleCondition = {
  enabled: boolean;
  field: CandleFieldOption;
  comparator: ComparisonOperator;
  targetValue: number;
  reference: CandleReference;
};

export type BollingerBand = 'upper' | 'middle' | 'lower' | 'none';

export type BollingerCondition = {
  enabled: boolean;
  length: number;
  standardDeviation: number;
  offset: number;
  band: BollingerBand;
};

export type MaCondition = {
  enabled: boolean;
  period: number;
};

export type RsiSmoothing = 'sma' | 'ema';
export type RsiAction = 'cross_above' | 'cross_below' | 'stay_above' | 'stay_below';

export type RsiCondition = {
  enabled: boolean;
  period: number;
  smoothing: RsiSmoothing;
  threshold: number;
  actions: RsiAction[];
};

export type DmiComparison = 'plus_over_minus' | 'minus_over_plus' | null;

export type ThresholdCondition = {
  enabled: boolean;
  comparator: ComparisonOperator;
  value: number;
};

export type DmiAdxVsDi = 'adx_gt_di_plus' | 'adx_lt_di_plus' | 'adx_gt_di_minus' | 'adx_lt_di_minus' | null;

export type DmiCondition = {
  enabled: boolean;
  diPeriod: number;
  adxPeriod: number;
  adx: ThresholdCondition;
  diComparison: DmiComparison;
  diPlus: ThresholdCondition;
  diMinus: ThresholdCondition;
  adxVsDi?: DmiAdxVsDi;
};

export type MacdComparison = 'macd_over_signal' | 'macd_under_signal' | null;
export type MacdHistogramAction = 'increasing' | 'decreasing' | null;
export type SourcePrice = 'open' | 'high' | 'low' | 'close';
export type MovingAverageMethod = 'EMA' | 'SMA';

export type MacdCondition = {
  enabled: boolean;
  fast: number;
  slow: number;
  signal: number;
  source: SourcePrice;
  method: MovingAverageMethod;
  comparison: MacdComparison;
  histogramAction: MacdHistogramAction;
};

export type IndicatorComparisonNone = { mode: 'none' };
export type IndicatorComparisonCandle = {
  mode: 'candle';
  comparator: ComparisonOperator;
  field: CandleFieldOption;
  reference: CandleReference;
};
export type IndicatorComparisonValue = {
  mode: 'value';
  comparator: ComparisonOperator;
  value: number;
};
export type IndicatorComparisonIndicator = {
  mode: 'indicator';
  comparator: ComparisonOperator;
  targetEntryId: string;
  reference?: CandleReference; // current | previous
  metric?: string; // e.g., bollinger band: upper/middle/lower, etc.
};

export type IndicatorComparison =
  | IndicatorComparisonNone
  | IndicatorComparisonCandle
  | IndicatorComparisonValue
  | IndicatorComparisonIndicator;

export type IndicatorConfigMap = {
  bollinger: BollingerCondition;
  ma: MaCondition;
  rsi: RsiCondition;
  dmi: DmiCondition;
  macd: MacdCondition;
};

export type IndicatorEntry<T extends IndicatorKey = IndicatorKey> = {
  id: string;
  type: T;
  config: IndicatorConfigMap[T];
};

export type IndicatorComparisonLeaf =
  | { kind: 'candle'; comparator: ComparisonOperator; field: CandleFieldOption; reference: CandleReference }
  | { kind: 'value'; comparator: ComparisonOperator; value: number }
  | { kind: 'indicator'; comparator: ComparisonOperator; targetIndicatorId: string };

export type IndicatorLeafNode = {
  kind: 'indicator';
  id: string;
  indicator: IndicatorEntry;
  comparison: IndicatorComparisonLeaf | { kind: 'none' };
};

export type CandleLeafNode = {
  kind: 'candle';
  id: string;
  candle: CandleCondition;
};

// Status condition leaf: describes runtime position/account metrics
export type StatusMetric = 'profitRate' | 'margin' | 'buyCount' | 'entryAge';
export type StatusUnit = 'percent' | 'USDT' | 'USDC' | 'count' | 'days';

export type StatusLeafNode = {
  kind: 'status';
  id: string;
  metric: StatusMetric;
  comparator: ComparisonOperator;
  value: number;
  unit?: StatusUnit;
};

// Action nodes: describe executable trading actions attached to a condition group
export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type WalletBasisPref = 'wallet' | 'total' | 'free';

export type BuyOrderConfig = {
  kind: 'buy';
  orderType: OrderType;
  amountMode: 'usdt' | 'position_percent' | 'wallet_percent' | 'initial_percent' | 'min_notional';
  asset?: 'USDT' | 'USDC';
  usdt?: number;
  positionPercent?: number; // 1~2000
  walletBasis?: WalletBasisPref;
  walletPercent?: number; // 0.01~100
  initialPercent?: number; // 1~2000
  limitPriceMode?: 'input' | 'indicator';
  limitPrice?: number;
  indicatorRefId?: string; // link to indicator node id
  // optional execution flags (override UI)
  reduceOnly?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

export type SellOrderConfig = {
  kind: 'sell';
  orderType: OrderType;
  amountMode: 'usdt' | 'position_percent' | 'min_notional';
  asset?: 'USDT' | 'USDC';
  usdt?: number;
  positionPercent?: number; // 1~100
  limitPriceMode?: 'input' | 'indicator';
  limitPrice?: number;
  indicatorRefId?: string;
  reduceOnly?: boolean;
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

export type StopLossConfig = {
  kind: 'stoploss';
  priceMode: 'input' | 'indicator' | 'condition';
  price?: number;
  indicatorRefId?: string;
  recreateOnMissing?: boolean; // 재생성 플래그
  reduceOnly?: boolean;
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
  positionSide?: 'BOTH' | 'LONG' | 'SHORT';
};

export type ActionLeafNode = {
  kind: 'action';
  id: string;
  action: BuyOrderConfig | SellOrderConfig | StopLossConfig;
};

export type ConditionGroupNode = {
  kind: 'group';
  id: string;
  operator: AggregatorOperator;
  children: ConditionNode[];
};

export type ConditionNode = ConditionGroupNode | IndicatorLeafNode | CandleLeafNode | StatusLeafNode | ActionLeafNode;

export type IndicatorConditions = {
  root: ConditionGroupNode;
  // Legacy optional fields to ease migration of tests/fixtures
  defaultAggregator?: AggregatorOperator;
  entries?: unknown[];
  candle?: CandleCondition;
};

export type DirectionalSettings<T> = Record<PositionDirection, T>;

export type EntryDirectionSettings = {
  enabled: boolean;
  immediate: boolean;
  indicators: IndicatorConditions;
};

export type EntryConditions = DirectionalSettings<EntryDirectionSettings>;

export type ScaleInLimit = {
  balance: {
    enabled: boolean;
    basis: MarginBasis;
    percentage: number;
  };
  initialMargin: {
    enabled: boolean;
    percentage: number;
  };
  purchaseCount: {
    enabled: boolean;
    comparator: ComparisonOperator;
    value: number;
  };
  /** 직접 입력 한도(정액) */
  notional?: {
    enabled: boolean;
    asset: 'USDT' | 'USDC';
    amount: number;
  };
  profitRate: ProfitCondition;
  unlimited: boolean;
};

export type ScaleInBudget = {
  mode: ScaleInBudgetMode;
  basis: MarginBasis;
  percentage: number;
  minNotional: number;
  usdtAmount?: number;
  asset?: 'USDT' | 'USDC';
};

export type InitialMarginSetting = {
  basis: MarginBasis;
  mode: InitialMarginMode;
  percentage: number;
  minNotional: number;
  usdtAmount: number;
  asset?: 'USDT' | 'USDC';
};

export type CapitalSettings = {
  estimatedBalance: number;
  maxMargin: {
    basis: MarginBasis;
    percentage: number;
  };
  initialMargin: InitialMarginSetting;
  scaleInBudget: ScaleInBudget;
  scaleInLimit: ScaleInLimit;
  useMinNotionalFallback?: boolean;
  hedgeBudget?: {
    separateByDirection: boolean;
    long: HedgeBudgetDirection;
    short: HedgeBudgetDirection;
  };
};

export type HedgeBudgetDirection = {
  mode: 'usdt' | 'balance_percentage' | 'per_symbol_percentage' | 'position_percent' | 'initial_percent' | 'min_notional';
  asset?: 'USDT' | 'USDC';
  amount?: number; // for usdt
  basis?: MarginBasis; // for balance_percentage/per_symbol_percentage
  percentage?: number; // percent value
  perSymbol?: boolean; // when basis percentage is per-symbol
  minNotional?: number; // for min_notional
};

export type ScaleInDirectionSettings = {
  enabled: boolean;
  profitTarget: ProfitCondition;
  /** 현재 포지션의 실시간 수익률(%) 조건 */
  currentProfitRate?: ProfitCondition;
  indicators: IndicatorConditions;
  currentBuyNotional?: {
    enabled: boolean;
    asset: 'USDT' | 'USDC';
    comparator: ComparisonOperator;
    value: number;
  };
  initialBuyChange?: {
    enabled: boolean;
    comparator: ComparisonOperator;
    value: number; // percent
  };
};

export type AdditionalEntryConditions = DirectionalSettings<ScaleInDirectionSettings>;

export type ExitDirectionSettings = {
  enabled: boolean;
  profitTarget: ProfitCondition;
  /** 현재 포지션의 실시간 수익률(%) 조건 */
  currentProfitRate?: ProfitCondition;
  indicators: IndicatorConditions;
  includeFeesFunding?: boolean;
  currentBuyNotional?: {
    enabled: boolean;
    asset: 'USDT' | 'USDC';
    comparator: ComparisonOperator;
    value: number;
  };
  initialBuyChange?: {
    enabled: boolean;
    comparator: ComparisonOperator;
    value: number; // percent
  };
  sellAmount?: {
    mode: 'notional' | 'percent';
    asset?: 'USDT' | 'USDC';
    value: number;
  };
};

export type ExitConditions = DirectionalSettings<ExitDirectionSettings>;

export type PositionDirection = 'long' | 'short';

export type HedgeActivationSettings = {
  enabled: boolean;
  directions: PositionDirection[];
  /** 현재 포지션의 실시간 수익률(%) 조건 */
  currentProfitRate?: ProfitCondition;
  indicators: IndicatorConditions;
};

export type StopLossLineSettings = {
  enabled: boolean;
  autoRecreate: boolean;
  profitTarget: ProfitCondition;
  indicators: IndicatorConditions;
};

export type StopLossConditions = {
  profitTarget: ProfitCondition;
  /** 현재 포지션의 실시간 수익률(%) 조건 */
  currentProfitRate?: ProfitCondition;
  purchaseCount: {
    enabled: boolean;
    comparator: ComparisonOperator;
    value: number;
  };
  stopLossLine: StopLossLineSettings;
  indicators: IndicatorConditions;
};

export type RankingMode = 'market_cap' | 'volume' | 'top_gainers' | 'top_losers';
export type RankingSort = 'alphabet' | 'volume' | 'tradeValue' | 'changeUp' | 'changeDown';

export type RankingCriteria = Record<RankingMode, number | null>;

export type SymbolSelection = {
  manualSymbols: string[];
  ranking: RankingCriteria;
  excludedSymbols: string[];
  /** 제외 사유(자동선택/필터 등) 저장용 */
  excludedReasons?: Record<string, string>;
  respectDefaultExclusions: boolean;
  leverageMode: LeverageMode;
  leverageOverrides: Record<string, number>;
  positionOverrides?: Record<string, PositionPreference>;
  featureOverrides?: Record<string, { scaleIn?: boolean; exit?: boolean; stopLoss?: boolean }>;
  maxListingAgeDays?: number | null;
  rankingSort?: RankingSort;
  autoFillRecheck?: boolean;
  excludeTopGainers?: number | null;
  excludeTopLosers?: number | null;
  /** 거래량 하위 N 제외 */
  excludeBottomVolume?: number | null;
  /** 거래금액(시총 프록시) 하위 N 제외 */
  excludeBottomMarketCap?: number | null;
};

export type AutoTradingSettingsMetadata = {
  lastSavedAt: string | null;
  lastValidatedAt: string | null;
};

export type AutoTradingSettings = {
  logicName: string;
  leverage: number;
  symbolCount: number;
  assetMode: AssetMode;
  positionMode: PositionMode;
  capital: CapitalSettings;
  timeframe: TimeframeOption;
  symbolSelection: SymbolSelection;
  entry: EntryConditions;
  scaleIn: AdditionalEntryConditions;
  exit: ExitConditions;
  stopLoss: StopLossConditions;
  hedgeActivation: HedgeActivationSettings;
  metadata: AutoTradingSettingsMetadata;
};

export const DEFAULT_EXCLUDED_SYMBOLS = ['USDT/USDC', 'USDC/USDT', 'BUSD/USDT'];
