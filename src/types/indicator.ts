export type LineStyleOption = 'solid' | 'dashed' | 'dotted';
export type CandleFieldOption = 'open' | 'high' | 'low' | 'close';
export type MarkerShapeOption = 'arrowUp' | 'arrowDown' | 'circle' | 'square';

export interface LineStyleSetting {
  color: string;
  lineWidth: number;
  lineStyle: LineStyleOption;
}

export interface HighlightThresholdSetting {
  enabled: boolean;
  color: string;
  label: string;
  markerShape: MarkerShapeOption;
}

export interface ValueHighlightSetting extends HighlightThresholdSetting {
  threshold: number;
}

export interface MaHighlightConfig {
  candleField: CandleFieldOption;
  opacity: number;
  over: HighlightThresholdSetting;
  under: HighlightThresholdSetting;
}

export interface MaConfig extends LineStyleSetting {
  id: string;
  length: number;
  highlight: MaHighlightConfig;
}

export interface BollingerHighlightConfig {
  candleField: CandleFieldOption;
  upper: HighlightThresholdSetting;
  lower: HighlightThresholdSetting;
}

export interface BollingerConfig {
  period: number;
  multiplier: number;
  offset: number;
  median: LineStyleSetting;
  upper: LineStyleSetting;
  lower: LineStyleSetting;
  backgroundOpacity: number;
  highlight: BollingerHighlightConfig;
}

export interface RsiHighlightConfig {
  overbought: HighlightThresholdSetting;
  oversold: HighlightThresholdSetting;
}

export interface RsiConfig {
  period: number;
  upperLimit: number;
  middleLimit: number;
  lowerLimit: number;
  plot: LineStyleSetting;
  upper: LineStyleSetting;
  middle: LineStyleSetting;
  lower: LineStyleSetting;
  backgroundOpacity: number;
  highlight: RsiHighlightConfig;
}

export interface MacdConfig {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  source: 'close';
  oscillatorType: 'ema';
  signalType: 'ema';
  histogram: {
    colors: [string, string, string, string];
  };
  macdLine: LineStyleSetting;
  signalLine: LineStyleSetting;
  highlight: MacdHighlightConfig;
  visibility: MacdVisibilityConfig;
}

export interface MacdHighlightConfig {
  histogram: {
    turnUp: HighlightThresholdSetting;
    turnDown: HighlightThresholdSetting;
  };
  crossover: {
    bullish: HighlightThresholdSetting;
    bearish: HighlightThresholdSetting;
  };
}

export interface MacdVisibilityConfig {
  macdLine: boolean;
  signalLine: boolean;
  histogram: boolean;
}

export interface DmiDominanceHighlightConfig {
  candleField: CandleFieldOption;
  plusOverMinus: HighlightThresholdSetting;
  minusOverPlus: HighlightThresholdSetting;
}

export interface DmiValueHighlightConfig {
  over: ValueHighlightSetting;
  under: ValueHighlightSetting;
}

export interface DmiHighlightConfig {
  dominance: DmiDominanceHighlightConfig;
  adx: DmiValueHighlightConfig;
  adxr: DmiValueHighlightConfig;
}

export interface DmiVisibilityConfig {
  plusDI: boolean;
  minusDI: boolean;
  dx: boolean;
  adx: boolean;
  adxr: boolean;
}

export interface DmiConfig {
  diLength: number;
  adxSmoothing: number;
  plusDI: LineStyleSetting;
  minusDI: LineStyleSetting;
  dx: LineStyleSetting;
  adx: LineStyleSetting;
  adxr: LineStyleSetting;
  highlight: DmiHighlightConfig;
  visibility: DmiVisibilityConfig;
}

export interface IndicatorConfigState {
  ma: MaConfig[];
  bollinger: BollingerConfig;
  rsi: RsiConfig;
  macd: MacdConfig;
  dmi: DmiConfig;
  addMa: () => void;
  updateMa: (id: string, partial: Partial<MaConfig>) => void;
  removeMa: (id: string) => void;
  updateMaHighlight: (id: string, partial: Partial<MaHighlightConfig>) => void;
  updateMaHighlightThreshold: (
    id: string,
    key: 'over' | 'under',
    partial: Partial<HighlightThresholdSetting>
  ) => void;
  updateBollinger: (partial: Partial<BollingerConfig>) => void;
  updateBollingerStyle: (key: 'median' | 'upper' | 'lower', partial: Partial<LineStyleSetting>) => void;
  updateBollingerHighlight: (partial: Partial<BollingerHighlightConfig>) => void;
  updateBollingerHighlightThreshold: (
    key: 'upper' | 'lower',
    partial: Partial<HighlightThresholdSetting>
  ) => void;
  updateRsi: (partial: Partial<RsiConfig>) => void;
  updateRsiStyle: (key: 'plot' | 'upper' | 'middle' | 'lower', partial: Partial<LineStyleSetting>) => void;
  updateRsiHighlight: (partial: Partial<RsiHighlightConfig>) => void;
  updateRsiHighlightThreshold: (
    key: 'overbought' | 'oversold',
    partial: Partial<HighlightThresholdSetting>
  ) => void;
  updateMacd: (partial: Partial<MacdConfig>) => void;
  updateMacdLine: (key: 'macdLine' | 'signalLine', partial: Partial<LineStyleSetting>) => void;
  updateMacdHighlightThreshold: (
    section: 'histogram' | 'crossover',
    key: 'turnUp' | 'turnDown' | 'bullish' | 'bearish',
    partial: Partial<HighlightThresholdSetting>
  ) => void;
  updateMacdHistogramColor: (index: 0 | 1 | 2 | 3, color: string) => void;
  updateMacdVisibility: (partial: Partial<MacdVisibilityConfig>) => void;
  updateDmi: (partial: Partial<DmiConfig>) => void;
  updateDmiStyle: (key: 'plusDI' | 'minusDI' | 'dx' | 'adx' | 'adxr', partial: Partial<LineStyleSetting>) => void;
  updateDmiVisibility: (partial: Partial<DmiVisibilityConfig>) => void;
  updateDmiHighlight: (partial: Partial<DmiHighlightConfig>) => void;
  updateDmiDominanceHighlight: (partial: Partial<DmiDominanceHighlightConfig>) => void;
  updateDmiDominanceThreshold: (
    key: 'plusOverMinus' | 'minusOverPlus',
    partial: Partial<HighlightThresholdSetting>
  ) => void;
  updateDmiValueHighlight: (
    key: 'adx' | 'adxr',
    target: 'over' | 'under',
    partial: Partial<ValueHighlightSetting>
  ) => void;
  refreshMa: () => void;
  resetMa: () => void;
  resetBollinger: () => void;
  resetRsi: () => void;
  resetMacd: () => void;
  resetDmi: () => void;
  resetHighlights: () => void;
  reset: () => void;
}
