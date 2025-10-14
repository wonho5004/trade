export const defaultIntervals = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;

export type Interval = (typeof defaultIntervals)[number];

export function isSupportedInterval(value: string): value is Interval {
  return defaultIntervals.includes(value as Interval);
}

export function normalizeInterval(value: string): Interval {
  return isSupportedInterval(value) ? value : '1m';
}
