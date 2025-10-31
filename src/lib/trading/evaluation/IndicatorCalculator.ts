/**
 * Indicator Calculator
 *
 * 지표 노드를 실제 시장 데이터로 계산하고 조건을 평가합니다.
 */

import type { IndicatorLeafNode, CandleReference } from '@/types/trading/auto-trading';
import type { Candle } from '@/types/chart';
import { getMarketDataService } from '../market-data/MarketDataService';
import { getIndicatorEngine } from '../indicators/IndicatorEngine';

export interface IndicatorCalculationResult {
  nodeId: string;
  value: number | null; // 계산된 지표 값
  signal: boolean; // 조건 충족 여부
  error?: string;
  details?: { // 지표별 상세 정보
    [key: string]: any;
  };
}

export class IndicatorCalculator {
  private marketData = getMarketDataService();
  private indicatorEngine = getIndicatorEngine();

  /**
   * 지표 노드 평가
   *
   * @param node - 지표 노드
   * @param symbol - 심볼
   * @param interval - 간격
   * @param candleCurrent - 현재 캔들 (comparison용)
   * @param candlePrevious - 이전 캔들 (comparison용)
   * @param indicatorValues - 다른 지표 값들 (indicator comparison용)
   * @param direction - 진입 방향 ('long' | 'short') - DMI diComparison 결정용
   * @returns 계산 결과
   */
  async evaluateIndicator(
    node: IndicatorLeafNode,
    symbol: string,
    interval: string,
    candleCurrent?: Candle,
    candlePrevious?: Candle,
    indicatorValues?: Map<string, number>,
    direction?: 'long' | 'short'
  ): Promise<IndicatorCalculationResult> {
    try {
      const { indicator, comparison, metric, reference } = node;

      // 1. 지표 값 계산 (상세 정보 포함)
      const calculationResult = await this.calculateIndicatorValueWithDetails(
        indicator.type,
        indicator.config,
        symbol,
        interval,
        metric,
        reference,
        direction
      );

      if (calculationResult.value === null) {
        return {
          nodeId: node.id,
          value: null,
          signal: false,
          error: '데이터 부족'
        };
      }

      // 2. 비교 조건 평가 (DMI 복합 조건의 경우 별도 처리)
      let signal = false;

      // DMI 복합 조건 평가
      if (indicator.type === 'dmi' && indicator.config?.adx?.enabled &&
          indicator.config?.diComparison) {
        // DMI 복합 조건은 내부적으로 신호를 계산함
        const adxThreshold = indicator.config.adx.value || 25;
        const adxComparator = indicator.config.adx.comparator || 'over';
        const adxCondition = adxComparator === 'over' ?
          calculationResult.value > adxThreshold :
          calculationResult.value < adxThreshold;

        if (!adxCondition) {
          signal = false; // ADX 조건 미충족
          console.log(`[DMI Debug] ADX condition not met: ADX (${calculationResult.value.toFixed(2)}) ${adxComparator} ${adxThreshold} = false`);
        } else if (calculationResult.details) {
          // 상세 정보에서 신호 계산
          const { plusDI, minusDI, adx } = calculationResult.details;
          const conditions: boolean[] = [];

          // DI 비교 조건
          if (indicator.config.diComparison === 'plus_over_minus') {
            const diResult = plusDI > minusDI;
            conditions.push(diResult);
            console.log(`[DMI Debug] DI+ (${plusDI.toFixed(2)}) > DI- (${minusDI.toFixed(2)}) = ${diResult}`);
          } else if (indicator.config.diComparison === 'minus_over_plus') {
            const diResult = minusDI > plusDI;
            conditions.push(diResult);
            console.log(`[DMI Debug] DI- (${minusDI.toFixed(2)}) > DI+ (${plusDI.toFixed(2)}) = ${diResult}`);
          }

          // ADX vs DI 조건 (설정된 경우에만)
          if (indicator.config.adxVsDi && indicator.config.adxVsDi !== 'none') {
            let adxVsDiResult = false;
            if (indicator.config.adxVsDi === 'adx_lt_di_plus') {
              adxVsDiResult = plusDI > adx;
              console.log(`[DMI Debug] DI+ (${plusDI.toFixed(2)}) > ADX (${adx.toFixed(2)}) = ${adxVsDiResult}`);
            } else if (indicator.config.adxVsDi === 'adx_gt_di_plus') {
              adxVsDiResult = adx > plusDI;
              console.log(`[DMI Debug] ADX (${adx.toFixed(2)}) > DI+ (${plusDI.toFixed(2)}) = ${adxVsDiResult}`);
            } else if (indicator.config.adxVsDi === 'adx_lt_di_minus') {
              adxVsDiResult = minusDI > adx;
              console.log(`[DMI Debug] DI- (${minusDI.toFixed(2)}) > ADX (${adx.toFixed(2)}) = ${adxVsDiResult}`);
            } else if (indicator.config.adxVsDi === 'adx_gt_di_minus') {
              adxVsDiResult = adx > minusDI;
              console.log(`[DMI Debug] ADX (${adx.toFixed(2)}) > DI- (${minusDI.toFixed(2)}) = ${adxVsDiResult}`);
            }
            conditions.push(adxVsDiResult);
          }

          // 모든 조건이 true일 때만 signal = true
          signal = conditions.length > 0 && conditions.every(c => c);
          console.log(`[DMI Debug] Final signal: ${signal} (${conditions.length} conditions, all must be true)`);
        }
      } else {
        // 일반 지표는 기존 비교 로직 사용
        signal = this.evaluateComparison(
          calculationResult.value,
          comparison,
          candleCurrent,
          candlePrevious,
          indicatorValues
        );
      }

      return {
        nodeId: node.id,
        value: calculationResult.value,
        signal,
        details: calculationResult.details
      };
    } catch (error) {
      console.error(`Error evaluating indicator node ${node.id}:`, error);
      return {
        nodeId: node.id,
        value: null,
        signal: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * 지표 값과 상세 정보 계산
   */
  private async calculateIndicatorValueWithDetails(
    type: string,
    config: any,
    symbol: string,
    interval: string,
    metric?: string,
    reference?: CandleReference,
    direction?: 'long' | 'short'
  ): Promise<{ value: number | null; details?: any }> {
    const result = await this.calculateIndicatorValue(type, config, symbol, interval, metric, reference);

    // DMI의 경우 상세 정보 추가
    if (type === 'dmi' && result !== null) {
      const closes = this.marketData.getClosePrices(symbol, interval);
      const highs = this.marketData.getHighPrices(symbol, interval);
      const lows = this.marketData.getLowPrices(symbol, interval);

      const diPeriod = config.diPeriod || config.period || 14;
      const dmiResult = this.indicatorEngine.calculateDMI(highs, lows, closes, diPeriod);

      if (dmiResult) {
        return {
          value: result,
          details: {
            adx: dmiResult.adx,
            plusDI: dmiResult.plusDI,
            minusDI: dmiResult.minusDI,
            diComparison: config.diComparison,
            adxThreshold: config.adx?.value || 25,
            adxComparator: config.adx?.comparator || 'over',
            adxVsDi: config.adxVsDi || null
          }
        };
      }
    }

    return { value: result };
  }

  /**
   * 지표 값 계산
   */
  private async calculateIndicatorValue(
    type: string,
    config: any,
    symbol: string,
    interval: string,
    metric?: string,
    reference?: CandleReference
  ): Promise<number | null> {
    // 가격 데이터 가져오기
    const closes = this.marketData.getClosePrices(symbol, interval);
    const highs = this.marketData.getHighPrices(symbol, interval);
    const lows = this.marketData.getLowPrices(symbol, interval);
    const volumes = this.marketData.getVolumes(symbol, interval);

    if (closes.length === 0) {
      return null;
    }

    let value: number | null = null;

    switch (type) {
      case 'rsi': {
        const period = config.period || 14;
        value = this.indicatorEngine.calculateRSI(closes, period);
        break;
      }

      case 'ma': {
        const period = config.period || 20;
        // MA는 SMA로 계산 (설정에 따라 EMA도 가능)
        value = this.indicatorEngine.calculateSMA(closes, period);
        break;
      }

      case 'bollinger': {
        const period = config.length || 20;
        const stdDev = config.standardDeviation || 2;
        const bb = this.indicatorEngine.calculateBollingerBands(closes, period, stdDev);

        if (bb) {
          // metric에 따라 upper/middle/lower 선택
          if (metric === 'upper') value = bb.upper;
          else if (metric === 'lower') value = bb.lower;
          else value = bb.middle; // default: middle
        }
        break;
      }

      case 'macd': {
        const fast = config.fast || 12;
        const slow = config.slow || 26;
        const signal = config.signal || 9;
        const macdResult = this.indicatorEngine.calculateMACD(closes, fast, slow, signal);

        if (macdResult) {
          // metric에 따라 macd/signal/histogram 선택
          if (metric === 'signal') value = macdResult.signal;
          else if (metric === 'histogram') value = macdResult.histogram;
          else value = macdResult.macd; // default: macd
        }
        break;
      }

      case 'dmi': {
        const diPeriod = config.diPeriod || config.period || 14;
        const adxPeriod = config.adxPeriod || config.period || 14;
        const dmiResult = this.indicatorEngine.calculateDMI(highs, lows, closes, diPeriod);

        if (dmiResult) {
          const { plusDI, minusDI, adx } = dmiResult;

          console.log(`[DMI Debug] Raw values - plusDI: ${plusDI.toFixed(2)}, minusDI: ${minusDI.toFixed(2)}, adx: ${adx.toFixed(2)}`);
          console.log(`[DMI Debug] Config:`, JSON.stringify(config, null, 2));

          // 항상 ADX 값 반환 (복합 조건 평가는 별도로 처리)
          value = adx;
        }
        break;
      }

      default:
        console.warn(`Unknown indicator type: ${type}`);
        value = null;
    }

    return value;
  }

  /**
   * 비교 조건 평가
   */
  private evaluateComparison(
    indicatorValue: number,
    comparison: IndicatorLeafNode['comparison'],
    candleCurrent?: Candle,
    candlePrevious?: Candle,
    indicatorValues?: Map<string, number>
  ): boolean {
    if (comparison.kind === 'none') {
      return true; // 비교 조건 없음 → 항상 true
    }

    if (comparison.kind === 'value') {
      return this.compareValues(indicatorValue, comparison.comparator, comparison.value);
    }

    if (comparison.kind === 'candle') {
      const candle = comparison.reference === 'previous' ? candlePrevious : candleCurrent;
      if (!candle) return false;

      const candleValue = candle[comparison.field];
      return this.compareValues(indicatorValue, comparison.comparator, candleValue);
    }

    if (comparison.kind === 'indicator') {
      const targetValue = indicatorValues?.get(comparison.targetIndicatorId);
      if (targetValue === undefined) return false;

      return this.compareValues(indicatorValue, comparison.comparator, targetValue);
    }

    return false;
  }

  /**
   * 값 비교
   */
  private compareValues(left: number, op: string, right: number): boolean {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;

    switch (op) {
      case 'over':
        return left > right;
      case 'under':
        return left < right;
      case 'eq':
        return Math.abs(left - right) < 1e-12;
      case 'gte':
        return left >= right;
      case 'lte':
        return left <= right;
      default:
        return false;
    }
  }
}

// Singleton instance
let calculatorInstance: IndicatorCalculator | null = null;

export function getIndicatorCalculator(): IndicatorCalculator {
  if (!calculatorInstance) {
    calculatorInstance = new IndicatorCalculator();
  }
  return calculatorInstance;
}
