import type { Candle } from '@/types/chart';

function average(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function calculateSMA(candles: Candle[], period: number) {
  const result: Array<number | null> = Array(candles.length).fill(null);

  for (let i = period - 1; i < candles.length; i += 1) {
    const slice = candles.slice(i - period + 1, i + 1).map((candle) => candle.close);
    result[i] = average(slice);
  }

  return result;
}

export function calculateEMA(values: number[], period: number) {
  const result: Array<number | null> = Array(values.length).fill(null);
  const multiplier = 2 / (period + 1);
  let prevEma: number | null = null;

  for (let i = 0; i < values.length; i += 1) {
    const price = values[i];
    if (price == null) {
      result[i] = null;
      continue;
    }

    if (prevEma == null) {
      const recent = values.slice(0, i + 1).filter((value) => value != null);
      if (recent.length < period) {
        result[i] = null;
        continue;
      }
      prevEma = average(recent.slice(-period));
    }

    prevEma = (price - prevEma) * multiplier + prevEma;
    result[i] = prevEma;
  }

  return result;
}

export function calculateBollingerBands(candles: Candle[], period: number, multiplier: number) {
  const mid = calculateSMA(candles, period);
  const upper: Array<number | null> = Array(candles.length).fill(null);
  const lower: Array<number | null> = Array(candles.length).fill(null);

  for (let i = period - 1; i < candles.length; i += 1) {
    const slice = candles.slice(i - period + 1, i + 1).map((candle) => candle.close);
    const mean = mid[i];
    if (mean == null) {
      continue;
    }
    const variance = slice.reduce((acc, value) => acc + (value - mean) ** 2, 0) / slice.length;
    const deviation = Math.sqrt(variance);
    upper[i] = mean + deviation * multiplier;
    lower[i] = mean - deviation * multiplier;
  }

  return { mid, upper, lower };
}

export function calculateRSI(candles: Candle[], period: number) {
  const result: Array<number | null> = Array(candles.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;

  for (let i = 1; i < candles.length; i += 1) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (i < period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period - 1) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
        result[i] = 100 - 100 / (1 + rs);
      }
      continue;
    }

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? 0 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }

  return result;
}

export function calculateMACD(candles: Candle[], shortPeriod = 12, longPeriod = 26, signalPeriod = 9) {
  const closes = candles.map((candle) => candle.close);
  const shortEma = calculateEMA(closes, shortPeriod);
  const longEma = calculateEMA(closes, longPeriod);

  const macdLine: Array<number | null> = closes.map((_, index) => {
    const shortValue = shortEma[index];
    const longValue = longEma[index];
    if (shortValue == null || longValue == null) {
      return null;
    }
    return shortValue - longValue;
  });

  const macdValues = macdLine.map((value) => (value == null ? null : value));
  const signalLine = calculateEMA(macdValues, signalPeriod);
  const histogram = macdLine.map((value, index) => {
    const signal = signalLine[index];
    if (value == null || signal == null) {
      return null;
    }
    return value - signal;
  });

  return { macdLine, signalLine, histogram };
}

export function calculateDMI(candles: Candle[], diLength = 14, adxSmoothing = 14) {
  const plusDI: Array<number | null> = Array(candles.length).fill(null);
  const minusDI: Array<number | null> = Array(candles.length).fill(null);
  const dx: Array<number | null> = Array(candles.length).fill(null);
  const adx: Array<number | null> = Array(candles.length).fill(null);
  const adxr: Array<number | null> = Array(candles.length).fill(null);

  const trueRange: number[] = [0];
  const plusDM: number[] = [0];
  const minusDM: number[] = [0];

  for (let i = 1; i < candles.length; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];

    const highDiff = current.high - prev.high;
    const lowDiff = prev.low - current.low;

    plusDM[i] = highDiff > lowDiff && highDiff > 0 ? highDiff : 0;
    minusDM[i] = lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0;

    const tr = Math.max(
      current.high - current.low,
      Math.abs(current.high - prev.close),
      Math.abs(current.low - prev.close)
    );
    trueRange[i] = tr;
  }

  let atr = 0;
  let plusDMSmoothed = 0;
  let minusDMSmoothed = 0;

  for (let i = 1; i < candles.length; i += 1) {
    atr = atr - atr / diLength + trueRange[i];
    plusDMSmoothed = plusDMSmoothed - plusDMSmoothed / diLength + plusDM[i];
    minusDMSmoothed = minusDMSmoothed - minusDMSmoothed / diLength + minusDM[i];

    if (i < diLength) {
      continue;
    }

    const plusDIValue = atr === 0 ? 0 : (plusDMSmoothed / atr) * 100;
    const minusDIValue = atr === 0 ? 0 : (minusDMSmoothed / atr) * 100;
    plusDI[i] = plusDIValue;
    minusDI[i] = minusDIValue;

    const denominator = plusDIValue + minusDIValue;
    const dxValue = denominator === 0 ? 0 : (Math.abs(plusDIValue - minusDIValue) / denominator) * 100;
    dx[i] = dxValue;

    const prevAdx = adx[i - 1];
    adx[i] =
      prevAdx == null
        ? dxValue
        : (prevAdx * (adxSmoothing - 1) + dxValue) / (adxSmoothing || 1);

    if (i - adxSmoothing >= 0) {
      const previous = adx[i - adxSmoothing];
      const current = adx[i];
      if (previous != null && current != null) {
        adxr[i] = (current + previous) / 2;
      }
    }
  }

  return { plusDI, minusDI, dx, adx, adxr };
}
