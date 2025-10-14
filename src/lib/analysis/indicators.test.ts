import type { Candle } from '@/types/chart';
import {
  calculateSMA,
  calculateBollingerBands,
  calculateRSI,
  calculateMACD,
  calculateDMI
} from './indicators';

const sample: Candle[] = [
  { timestamp: 1, open: 10, high: 11, low: 9, close: 10, volume: 100 },
  { timestamp: 2, open: 10, high: 12, low: 9, close: 11, volume: 110 },
  { timestamp: 3, open: 11, high: 12, low: 10, close: 11, volume: 120 },
  { timestamp: 4, open: 11, high: 13, low: 10, close: 12, volume: 130 },
  { timestamp: 5, open: 12, high: 13, low: 11, close: 12, volume: 140 }
];

describe('calculateSMA', () => {
  it('주어진 기간의 단순 이동평균을 계산한다', () => {
    const sma = calculateSMA(sample, 3);
    expect(sma).toEqual([null, null, 32 / 3, 34 / 3, 35 / 3]);
  });
});

describe('calculateBollingerBands', () => {
  it('상단/중앙/하단 밴드를 반환한다', () => {
    const { mid, upper, lower } = calculateBollingerBands(sample, 3, 2);
    expect(mid.slice(0, 2)).toEqual([null, null]);
    expect(upper[3]).toBeGreaterThan(mid[3] ?? 0);
    expect(lower[3]).toBeLessThan(mid[3] ?? 0);
  });
});

describe('calculateRSI', () => {
  it('RSI 값을 0-100 범위로 계산한다', () => {
    const rsi = calculateRSI(sample, 3);
    expect(rsi.filter((value) => value != null).every((value) => value! >= 0 && value! <= 100)).toBe(
      true
    );
  });
});

describe('calculateMACD', () => {
  it('MACD, 시그널, 히스토그램을 반환한다', () => {
    const { macdLine, signalLine, histogram } = calculateMACD(sample, 2, 3, 2);
    expect(macdLine.length).toBe(sample.length);
    expect(signalLine.length).toBe(sample.length);
    expect(histogram.length).toBe(sample.length);
  });
});

describe('calculateDMI', () => {
  it('플러스/마이너스 DI와 ADX를 반환한다', () => {
    const { plusDI, minusDI, adx } = calculateDMI(sample, 2);
    expect(plusDI.length).toBe(sample.length);
    expect(minusDI.length).toBe(sample.length);
    expect(adx.length).toBe(sample.length);
  });
});
