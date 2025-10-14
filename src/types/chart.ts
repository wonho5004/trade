export interface Candle {
  timestamp: number; // ms 단위
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type IntervalOption = '1m' | '3m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

export const intervalToMs: Record<IntervalOption, number> = {
  '1m': 60 * 1000,
  '3m': 3 * 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
  '1w': 7 * 24 * 60 * 60 * 1000
};
