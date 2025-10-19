import { createDefaultAutoTradingSettings, createIndicatorConfig } from '@/lib/trading/autoTradingDefaults';
import type {
  AggregatorOperator,
  AutoTradingSettings,
  IndicatorComparison,
  IndicatorConfigMap,
  IndicatorEntry,
  IndicatorKey
} from '@/types/trading/auto-trading';

let indicatorSequence = 0;
const nextIndicatorId = () => `fixture-indicator-${indicatorSequence++}`;

const createIndicatorFixture = <T extends IndicatorKey>(
  type: T,
  config: Partial<IndicatorConfigMap[T]>,
  aggregator: AggregatorOperator = 'and',
  comparison: IndicatorComparison = { mode: 'none' }
): any => ({
  id: nextIndicatorId(),
  type,
  aggregator,
  config: {
    ...createIndicatorConfig(type),
    ...config
  },
  comparison
});

const withIndicators = <T extends AutoTradingSettings>(settings: T, options: { direction: 'long' | 'short' }) => {
  const { direction } = options;
  const entry = settings.entry[direction];
  entry.enabled = true;
  entry.immediate = false;
  entry.indicators.defaultAggregator = 'and';
  entry.indicators.candle!.enabled = true;
  entry.indicators.candle!.field = 'close';
  entry.indicators.candle!.comparator = direction === 'long' ? 'over' : 'under';
  entry.indicators.candle!.targetValue = direction === 'long' ? 0.2 : -0.2;
  entry.indicators.candle!.reference = 'previous';
  entry.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: direction === 'long' ? 20 : 34,
      actions: [direction === 'long' ? 'break_above' : 'break_below']
    }),
    createIndicatorFixture(
      'rsi',
      {
        enabled: true,
        period: 14,
        threshold: direction === 'long' ? 55 : 45,
        actions: [direction === 'long' ? 'stay_above' : 'stay_below']
      },
      'and'
    )
  ];

  const scaleIn = settings.scaleIn[direction];
  scaleIn.enabled = true;
  scaleIn.profitTarget.enabled = true;
  scaleIn.profitTarget.comparator = 'over';
  scaleIn.profitTarget.value = direction === 'long' ? 2.5 : 1.5;
  scaleIn.indicators.defaultAggregator = 'and';
  scaleIn.indicators.candle!.enabled = false;
  scaleIn.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: direction === 'long' ? 30 : 40,
      actions: [direction === 'long' ? 'stay_above' : 'stay_below']
    })
  ];

  const exit = settings.exit[direction];
  exit.enabled = true;
  exit.profitTarget.enabled = true;
  exit.profitTarget.value = direction === 'long' ? 6 : 4;
  exit.indicators.defaultAggregator = 'and';
  exit.indicators.candle!.enabled = false;
  exit.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: direction === 'long' ? 12 : 18,
      actions: [direction === 'long' ? 'break_below' : 'break_above']
    })
  ];

  return settings;
};

const disableDirection = (settings: AutoTradingSettings, direction: 'long' | 'short') => {
  settings.entry[direction].enabled = false;
  settings.scaleIn[direction].enabled = false;
  settings.exit[direction].enabled = false;
};

export const createLongOnlySettings = (): AutoTradingSettings => {
  const settings = createDefaultAutoTradingSettings();

  settings.logicName = 'Long Momentum Scalper';
  settings.positionMode = 'one_way';
  settings.metadata.lastValidatedAt = new Date().toISOString();
  settings.capital.estimatedBalance = 15000;
  settings.capital.maxMargin.percentage = 30;
  settings.capital.initialMargin.mode = 'per_symbol_percentage';
  settings.capital.initialMargin.percentage = 7;
  settings.capital.scaleInBudget.mode = 'balance_percentage';
  settings.capital.scaleInBudget.percentage = 5;
  settings.hedgeActivation.enabled = false;
  settings.symbolSelection.manualSymbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
  settings.symbolSelection.respectDefaultExclusions = true;

  withIndicators(settings, { direction: 'long' });
  disableDirection(settings, 'short');

  settings.stopLoss.stopLossLine.enabled = true;
  settings.stopLoss.stopLossLine.profitTarget.enabled = true;
  settings.stopLoss.stopLossLine.profitTarget.value = 3;
  settings.stopLoss.stopLossLine.indicators.defaultAggregator = 'and';
  settings.stopLoss.stopLossLine.indicators.candle!.enabled = false;
  settings.stopLoss.stopLossLine.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: 21,
      actions: ['break_below']
    })
  ];

  return settings;
};

export const createShortOnlySettings = (): AutoTradingSettings => {
  const settings = createDefaultAutoTradingSettings();

  settings.logicName = 'Short Exhaustion Hunter';
  settings.positionMode = 'one_way';
  settings.metadata.lastValidatedAt = new Date().toISOString();
  settings.capital.estimatedBalance = 12000;
  settings.capital.maxMargin.percentage = 25;
  settings.capital.initialMargin.mode = 'per_symbol_percentage';
  settings.capital.initialMargin.percentage = 6;
  settings.capital.scaleInBudget.mode = 'balance_percentage';
  settings.capital.scaleInBudget.percentage = 4;
  settings.symbolSelection.manualSymbols = ['BNBUSDT', 'DOGEUSDT', 'XRPUSDT'];
  settings.symbolSelection.respectDefaultExclusions = false;

  withIndicators(settings, { direction: 'short' });
  disableDirection(settings, 'long');

  settings.stopLoss.stopLossLine.enabled = true;
  settings.stopLoss.stopLossLine.profitTarget.enabled = true;
  settings.stopLoss.stopLossLine.profitTarget.comparator = 'under';
  settings.stopLoss.stopLossLine.profitTarget.value = -2.5;
  settings.stopLoss.stopLossLine.indicators.defaultAggregator = 'and';
  settings.stopLoss.stopLossLine.indicators.candle!.enabled = false;
  settings.stopLoss.stopLossLine.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: 55,
      actions: ['break_above']
    })
  ];

  return settings;
};

export const createHedgeBalancedSettings = (): AutoTradingSettings => {
  const settings = createDefaultAutoTradingSettings();

  settings.logicName = 'Balanced Hedge Grid';
  settings.positionMode = 'hedge';
  settings.metadata.lastValidatedAt = new Date().toISOString();
  settings.capital.estimatedBalance = 20000;
  settings.capital.maxMargin.percentage = 35;
  settings.capital.initialMargin.mode = 'usdt_amount';
  settings.capital.initialMargin.usdtAmount = 1500;
  settings.capital.scaleInBudget.mode = 'min_notional';
  settings.capital.scaleInBudget.minNotional = 250;
  settings.capital.scaleInLimit.balance.enabled = true;
  settings.capital.scaleInLimit.balance.percentage = 40;
  settings.capital.scaleInLimit.initialMargin.enabled = true;
  settings.capital.scaleInLimit.initialMargin.percentage = 250;
  settings.capital.scaleInLimit.unlimited = false;
  settings.symbolSelection.manualSymbols = ['ETHUSDT', 'AVAXUSDT', 'LINKUSDT'];
  settings.symbolSelection.respectDefaultExclusions = false;

  settings.hedgeActivation.enabled = true;
  settings.hedgeActivation.directions = ['long', 'short'];
  settings.hedgeActivation.indicators.candle!.enabled = true;
  settings.hedgeActivation.indicators.candle!.comparator = 'over';
  settings.hedgeActivation.indicators.candle!.targetValue = 0.5;
  settings.hedgeActivation.indicators.candle!.reference = 'current';
  settings.hedgeActivation.indicators.defaultAggregator = 'and';
  settings.hedgeActivation.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: 34,
      actions: ['stay_above', 'stay_below']
    })
  ];

  withIndicators(settings, { direction: 'long' });
  withIndicators(settings, { direction: 'short' });

  settings.scaleIn.long.profitTarget.value = 1.5;
  settings.scaleIn.short.profitTarget.value = 1.5;
  settings.exit.long.profitTarget.value = 5;
  settings.exit.short.profitTarget.value = 5;

  settings.stopLoss.stopLossLine.enabled = true;
  settings.stopLoss.stopLossLine.profitTarget.enabled = true;
  settings.stopLoss.stopLossLine.profitTarget.value = 2;
  settings.stopLoss.stopLossLine.indicators.defaultAggregator = 'and';
  settings.stopLoss.stopLossLine.indicators.entries = [
    createIndicatorFixture('ma', {
      enabled: true,
      period: 34,
      actions: ['stay_above', 'stay_below']
    })
  ];

  return settings;
};
