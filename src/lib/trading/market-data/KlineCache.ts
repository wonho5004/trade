/**
 * Kline Data Cache
 *
 * 캔들 데이터를 메모리에 캐싱하고 관리합니다.
 * 지표 계산에 필요한 최근 N개의 캔들을 유지합니다.
 */

import type { KlineData } from './BinanceWebSocketClient';

export interface CachedKline {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export class KlineCache {
  private cache = new Map<string, CachedKline[]>();
  private maxCandles = 500; // 최대 500개 캔들 보관

  /**
   * 캐시 키 생성
   */
  private getKey(symbol: string, interval: string): string {
    return `${symbol.toUpperCase()}_${interval}`;
  }

  /**
   * Kline 데이터 추가 또는 업데이트
   */
  addKline(kline: KlineData): void {
    const key = this.getKey(kline.symbol, kline.interval);
    const candles = this.cache.get(key) || [];

    const cached: CachedKline = {
      openTime: kline.openTime,
      closeTime: kline.closeTime,
      open: parseFloat(kline.open),
      high: parseFloat(kline.high),
      low: parseFloat(kline.low),
      close: parseFloat(kline.close),
      volume: parseFloat(kline.volume),
      isClosed: kline.isClosed
    };

    // 마지막 캔들 확인
    const lastCandle = candles[candles.length - 1];

    if (lastCandle && lastCandle.openTime === cached.openTime) {
      // 기존 캔들 업데이트
      candles[candles.length - 1] = cached;
    } else {
      // 새 캔들 추가
      candles.push(cached);

      // 최대 개수 유지
      if (candles.length > this.maxCandles) {
        candles.shift();
      }
    }

    this.cache.set(key, candles);
  }

  /**
   * 캔들 데이터 조회
   *
   * @param symbol - 심볼
   * @param interval - 간격
   * @param limit - 가져올 캔들 개수 (최근부터)
   * @returns 캔들 배열 (오래된 것부터)
   */
  getKlines(symbol: string, interval: string, limit?: number): CachedKline[] {
    const key = this.getKey(symbol, interval);
    const candles = this.cache.get(key) || [];

    if (!limit || limit >= candles.length) {
      return [...candles];
    }

    return candles.slice(-limit);
  }

  /**
   * 마지막 캔들 조회
   */
  getLastKline(symbol: string, interval: string): CachedKline | null {
    const key = this.getKey(symbol, interval);
    const candles = this.cache.get(key) || [];

    return candles.length > 0 ? candles[candles.length - 1] : null;
  }

  /**
   * 현재 가격 조회 (마지막 캔들의 종가)
   */
  getCurrentPrice(symbol: string, interval: string): number | null {
    const lastKline = this.getLastKline(symbol, interval);
    return lastKline ? lastKline.close : null;
  }

  /**
   * 종가 배열 조회 (지표 계산용)
   */
  getClosePrices(symbol: string, interval: string, limit?: number): number[] {
    const klines = this.getKlines(symbol, interval, limit);
    return klines.map(k => k.close);
  }

  /**
   * 고가 배열 조회
   */
  getHighPrices(symbol: string, interval: string, limit?: number): number[] {
    const klines = this.getKlines(symbol, interval, limit);
    return klines.map(k => k.high);
  }

  /**
   * 저가 배열 조회
   */
  getLowPrices(symbol: string, interval: string, limit?: number): number[] {
    const klines = this.getKlines(symbol, interval, limit);
    return klines.map(k => k.low);
  }

  /**
   * 거래량 배열 조회
   */
  getVolumes(symbol: string, interval: string, limit?: number): number[] {
    const klines = this.getKlines(symbol, interval, limit);
    return klines.map(k => k.volume);
  }

  /**
   * 캔들 개수 조회
   */
  getKlineCount(symbol: string, interval: string): number {
    const key = this.getKey(symbol, interval);
    const candles = this.cache.get(key) || [];
    return candles.length;
  }

  /**
   * 특정 심볼/간격의 캐시 삭제
   */
  clear(symbol: string, interval: string): void {
    const key = this.getKey(symbol, interval);
    this.cache.delete(key);
  }

  /**
   * 모든 캐시 삭제
   */
  clearAll(): void {
    this.cache.clear();
  }

  /**
   * 캐시된 모든 키 조회
   */
  getCachedKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * 캐시 통계
   */
  getStats(): {
    totalSymbols: number;
    totalCandles: number;
    keys: string[];
  } {
    const keys = this.getCachedKeys();
    const totalCandles = keys.reduce((sum, key) => {
      return sum + (this.cache.get(key)?.length || 0);
    }, 0);

    return {
      totalSymbols: keys.length,
      totalCandles,
      keys
    };
  }
}

// Singleton instance
let cacheInstance: KlineCache | null = null;

export function getKlineCache(): KlineCache {
  if (!cacheInstance) {
    cacheInstance = new KlineCache();
  }
  return cacheInstance;
}
