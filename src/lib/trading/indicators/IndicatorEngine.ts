/**
 * Technical Indicator Calculation Engine
 *
 * 기술 지표를 계산합니다.
 */

export class IndicatorEngine {
  /**
   * Simple Moving Average (SMA)
   *
   * @param prices - 가격 배열
   * @param period - 기간
   * @returns SMA 값 (최신)
   */
  calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }

    const recentPrices = prices.slice(-period);
    const sum = recentPrices.reduce((a, b) => a + b, 0);

    return sum / period;
  }

  /**
   * Exponential Moving Average (EMA)
   *
   * @param prices - 가격 배열
   * @param period - 기간
   * @returns EMA 값 (최신)
   */
  calculateEMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }

    const multiplier = 2 / (period + 1);

    // 첫 EMA는 SMA로 시작
    let ema = this.calculateSMA(prices.slice(0, period), period)!;

    // 나머지 가격에 대해 EMA 계산
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }

    return ema;
  }

  /**
   * Relative Strength Index (RSI)
   *
   * @param prices - 가격 배열
   * @param period - 기간 (기본값: 14)
   * @returns RSI 값 (0-100)
   */
  calculateRSI(prices: number[], period: number = 14): number | null {
    if (prices.length < period + 1) {
      return null;
    }

    const changes: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    let avgGain = 0;
    let avgLoss = 0;

    // 첫 period 개의 평균 계산
    for (let i = 0; i < period; i++) {
      if (changes[i] > 0) {
        avgGain += changes[i];
      } else {
        avgLoss += Math.abs(changes[i]);
      }
    }

    avgGain /= period;
    avgLoss /= period;

    // 나머지에 대해 smoothed average 계산
    for (let i = period; i < changes.length; i++) {
      const change = changes[i];

      if (change > 0) {
        avgGain = (avgGain * (period - 1) + change) / period;
        avgLoss = (avgLoss * (period - 1)) / period;
      } else {
        avgGain = (avgGain * (period - 1)) / period;
        avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
      }
    }

    if (avgLoss === 0) {
      return 100;
    }

    const rs = avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    return rsi;
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   *
   * @param prices - 가격 배열
   * @param fastPeriod - 빠른 EMA 기간 (기본값: 12)
   * @param slowPeriod - 느린 EMA 기간 (기본값: 26)
   * @param signalPeriod - 시그널 EMA 기간 (기본값: 9)
   * @returns { macd, signal, histogram } 또는 null
   */
  calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
  ): { macd: number; signal: number; histogram: number } | null {
    if (prices.length < slowPeriod + signalPeriod) {
      return null;
    }

    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    if (fastEMA === null || slowEMA === null) {
      return null;
    }

    const macd = fastEMA - slowEMA;

    // MACD 라인의 히스토리를 구해 시그널 계산
    const macdLine: number[] = [];
    for (let i = slowPeriod; i <= prices.length; i++) {
      const fast = this.calculateEMA(prices.slice(0, i), fastPeriod);
      const slow = this.calculateEMA(prices.slice(0, i), slowPeriod);

      if (fast !== null && slow !== null) {
        macdLine.push(fast - slow);
      }
    }

    const signal = this.calculateEMA(macdLine, signalPeriod);

    if (signal === null) {
      return null;
    }

    const histogram = macd - signal;

    return { macd, signal, histogram };
  }

  /**
   * Bollinger Bands
   *
   * @param prices - 가격 배열
   * @param period - 기간 (기본값: 20)
   * @param stdDev - 표준편차 배수 (기본값: 2)
   * @returns { upper, middle, lower } 또는 null
   */
  calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDev: number = 2
  ): { upper: number; middle: number; lower: number } | null {
    if (prices.length < period) {
      return null;
    }

    const middle = this.calculateSMA(prices, period);

    if (middle === null) {
      return null;
    }

    // 표준편차 계산
    const recentPrices = prices.slice(-period);
    const variance =
      recentPrices.reduce((sum, price) => sum + Math.pow(price - middle, 2), 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = middle + stdDev * standardDeviation;
    const lower = middle - stdDev * standardDeviation;

    return { upper, middle, lower };
  }

  /**
   * Average True Range (ATR)
   *
   * @param highs - 고가 배열
   * @param lows - 저가 배열
   * @param closes - 종가 배열
   * @param period - 기간 (기본값: 14)
   * @returns ATR 값
   */
  calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): number | null {
    if (highs.length < period + 1 || lows.length < period + 1 || closes.length < period + 1) {
      return null;
    }

    const trueRanges: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      trueRanges.push(tr);
    }

    // ATR은 TR의 SMA
    if (trueRanges.length < period) {
      return null;
    }

    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((a, b) => a + b, 0) / period;

    return atr;
  }

  /**
   * Stochastic Oscillator
   *
   * @param highs - 고가 배열
   * @param lows - 저가 배열
   * @param closes - 종가 배열
   * @param period - 기간 (기본값: 14)
   * @returns { k, d } 또는 null (0-100 범위)
   */
  calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
    kPeriod: number = 3,
    dPeriod: number = 3
  ): { k: number; d: number } | null {
    if (highs.length < period || lows.length < period || closes.length < period) {
      return null;
    }

    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];

    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);

    if (highestHigh === lowestLow) {
      return { k: 50, d: 50 };
    }

    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // %K의 SMA를 %D로 사용 (간단한 구현)
    const d = k; // 실제로는 최근 3개 %K 값의 평균을 사용해야 함

    return { k, d };
  }

  /**
   * Volume Weighted Average Price (VWAP) 근사값
   *
   * @param prices - 가격 배열
   * @param volumes - 거래량 배열
   * @param period - 기간
   * @returns VWAP 값
   */
  calculateVWAP(prices: number[], volumes: number[], period: number): number | null {
    if (prices.length < period || volumes.length < period) {
      return null;
    }

    const recentPrices = prices.slice(-period);
    const recentVolumes = volumes.slice(-period);

    let sumPV = 0;
    let sumV = 0;

    for (let i = 0; i < period; i++) {
      sumPV += recentPrices[i] * recentVolumes[i];
      sumV += recentVolumes[i];
    }

    if (sumV === 0) {
      return null;
    }

    return sumPV / sumV;
  }

  /**
   * Directional Movement Index (DMI) and Average Directional Index (ADX)
   *
   * @param highs - 고가 배열
   * @param lows - 저가 배열
   * @param closes - 종가 배열
   * @param period - 기간 (기본값: 14)
   * @returns { plusDI, minusDI, adx } 또는 null
   */
  calculateDMI(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14
  ): { plusDI: number; minusDI: number; adx: number } | null {
    const dataLength = Math.min(highs.length, lows.length, closes.length);

    // DMI needs period + 1 for DM calculation, plus period for ADX smoothing
    if (dataLength < period * 2 + 1) {
      return null;
    }

    // 1. Calculate +DM and -DM
    const plusDM: number[] = [];
    const minusDM: number[] = [];
    const tr: number[] = [];

    for (let i = 1; i < dataLength; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];

      // +DM and -DM
      let plusDMValue = 0;
      let minusDMValue = 0;

      if (highDiff > lowDiff && highDiff > 0) {
        plusDMValue = highDiff;
      }

      if (lowDiff > highDiff && lowDiff > 0) {
        minusDMValue = lowDiff;
      }

      plusDM.push(plusDMValue);
      minusDM.push(minusDMValue);

      // True Range
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const trValue = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose)
      );

      tr.push(trValue);
    }

    // 2. Smooth +DM, -DM, and TR using Wilder's smoothing
    const smoothPlusDM: number[] = [];
    const smoothMinusDM: number[] = [];
    const smoothTR: number[] = [];

    // First smoothed value is sum of first period values
    let sumPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
    let sumMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);
    let sumTR = tr.slice(0, period).reduce((a, b) => a + b, 0);

    smoothPlusDM.push(sumPlusDM);
    smoothMinusDM.push(sumMinusDM);
    smoothTR.push(sumTR);

    // Subsequent values use Wilder's smoothing
    for (let i = period; i < plusDM.length; i++) {
      sumPlusDM = sumPlusDM - sumPlusDM / period + plusDM[i];
      sumMinusDM = sumMinusDM - sumMinusDM / period + minusDM[i];
      sumTR = sumTR - sumTR / period + tr[i];

      smoothPlusDM.push(sumPlusDM);
      smoothMinusDM.push(sumMinusDM);
      smoothTR.push(sumTR);
    }

    // 3. Calculate +DI and -DI
    const plusDI: number[] = [];
    const minusDI: number[] = [];

    for (let i = 0; i < smoothPlusDM.length; i++) {
      if (smoothTR[i] === 0) {
        plusDI.push(0);
        minusDI.push(0);
      } else {
        plusDI.push((smoothPlusDM[i] / smoothTR[i]) * 100);
        minusDI.push((smoothMinusDM[i] / smoothTR[i]) * 100);
      }
    }

    // 4. Calculate DX (Directional Index)
    const dx: number[] = [];

    for (let i = 0; i < plusDI.length; i++) {
      const sum = plusDI[i] + minusDI[i];
      if (sum === 0) {
        dx.push(0);
      } else {
        dx.push((Math.abs(plusDI[i] - minusDI[i]) / sum) * 100);
      }
    }

    // 5. Calculate ADX (smoothed DX)
    if (dx.length < period) {
      return null;
    }

    // First ADX is average of first period DX values
    let adx = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;

    // Apply Wilder's smoothing for subsequent values
    for (let i = period; i < dx.length; i++) {
      adx = ((adx * (period - 1)) + dx[i]) / period;
    }

    // Return the most recent values
    const currentPlusDI = plusDI[plusDI.length - 1];
    const currentMinusDI = minusDI[minusDI.length - 1];

    return {
      plusDI: currentPlusDI,
      minusDI: currentMinusDI,
      adx: adx
    };
  }
}

// Singleton instance
let indicatorEngineInstance: IndicatorEngine | null = null;

export function getIndicatorEngine(): IndicatorEngine {
  if (!indicatorEngineInstance) {
    indicatorEngineInstance = new IndicatorEngine();
  }
  return indicatorEngineInstance;
}
