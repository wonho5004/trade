/**
 * Market Data Service
 *
 * WebSocket 스트림과 캐시를 통합 관리합니다.
 * - 실시간 가격 데이터 수신
 * - 초기 데이터 로드
 * - 캔들 데이터 제공
 */

import { getBinanceWebSocketClient, type KlineData } from './BinanceWebSocketClient';
import { getKlineCache, type CachedKline } from './KlineCache';

export class MarketDataService {
  private wsClient = getBinanceWebSocketClient();
  private cache = getKlineCache();
  private unsubscribers = new Map<string, () => void>();

  /**
   * 심볼/간격에 대한 실시간 스트림 시작
   *
   * @param symbol - 심볼 (예: BTCUSDT)
   * @param interval - 간격 (예: 3m, 5m, 15m, 1h)
   * @param loadInitialData - 초기 데이터 로드 여부
   */
  async startStream(
    symbol: string,
    interval: string,
    loadInitialData: boolean = true
  ): Promise<void> {
    const key = `${symbol}_${interval}`;

    // 이미 구독 중이면 스킵
    if (this.unsubscribers.has(key)) {
      console.log(`Already streaming ${key}`);
      return;
    }

    // 초기 데이터 로드
    if (loadInitialData) {
      await this.loadInitialKlines(symbol, interval);
    }

    // 실시간 스트림 구독
    const unsubscribe = this.wsClient.subscribeKline(
      symbol,
      interval,
      (kline: KlineData) => {
        this.cache.addKline(kline);

        // 캔들이 완료되면 로그
        if (kline.isClosed) {
          console.log(
            `📊 [${symbol}] ${interval} candle closed: ${kline.close} (${new Date(kline.closeTime).toLocaleTimeString()})`
          );
        }
      }
    );

    this.unsubscribers.set(key, unsubscribe);

    console.log(`✅ Started market data stream for ${symbol} ${interval}`);
  }

  /**
   * 스트림 중지
   */
  stopStream(symbol: string, interval: string): void {
    const key = `${symbol}_${interval}`;
    const unsubscribe = this.unsubscribers.get(key);

    if (unsubscribe) {
      unsubscribe();
      this.unsubscribers.delete(key);
      console.log(`⏸️ Stopped market data stream for ${symbol} ${interval}`);
    }
  }

  /**
   * 모든 스트림 중지
   */
  stopAllStreams(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers.clear();
    console.log('⏸️ Stopped all market data streams');
  }

  /**
   * 초기 캔들 데이터 로드 (REST API)
   */
  private async loadInitialKlines(symbol: string, interval: string): Promise<void> {
    try {
      console.log(`📥 Loading initial klines for ${symbol} ${interval}...`);

      const limit = 500; // 최대 500개
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to fetch klines: ${response.statusText}`);
      }

      const klines = await response.json();

      // 캔들 데이터를 캐시에 추가
      for (const k of klines) {
        const klineData: KlineData = {
          symbol,
          interval,
          openTime: k[0],
          closeTime: k[6],
          open: k[1],
          high: k[2],
          low: k[3],
          close: k[4],
          volume: k[5],
          isClosed: true // 과거 데이터는 모두 완료됨
        };

        this.cache.addKline(klineData);
      }

      console.log(`✅ Loaded ${klines.length} klines for ${symbol} ${interval}`);
    } catch (error) {
      console.error(`Failed to load initial klines for ${symbol} ${interval}:`, error);
      // 초기 로드 실패해도 스트림은 계속 진행
    }
  }

  /**
   * 캔들 데이터 조회
   */
  getKlines(symbol: string, interval: string, limit?: number): CachedKline[] {
    return this.cache.getKlines(symbol, interval, limit);
  }

  /**
   * 현재 가격 조회
   */
  getCurrentPrice(symbol: string, interval: string): number | null {
    return this.cache.getCurrentPrice(symbol, interval);
  }

  /**
   * 종가 배열 조회
   */
  getClosePrices(symbol: string, interval: string, limit?: number): number[] {
    return this.cache.getClosePrices(symbol, interval, limit);
  }

  /**
   * 고가 배열 조회
   */
  getHighPrices(symbol: string, interval: string, limit?: number): number[] {
    return this.cache.getHighPrices(symbol, interval, limit);
  }

  /**
   * 저가 배열 조회
   */
  getLowPrices(symbol: string, interval: string, limit?: number): number[] {
    return this.cache.getLowPrices(symbol, interval, limit);
  }

  /**
   * 거래량 배열 조회
   */
  getVolumes(symbol: string, interval: string, limit?: number): number[] {
    return this.cache.getVolumes(symbol, interval, limit);
  }

  /**
   * 캐시 통계
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * WebSocket 연결 상태
   */
  isConnected(): boolean {
    return this.wsClient.isConnected();
  }

  /**
   * 현재 구독 중인 스트림 목록
   */
  getActiveStreams(): string[] {
    return Array.from(this.unsubscribers.keys());
  }

  /**
   * 서비스 종료
   */
  shutdown(): void {
    this.stopAllStreams();
    this.wsClient.disconnect();
    this.cache.clearAll();
    console.log('🔌 MarketDataService shutdown');
  }
}

// Singleton instance
let serviceInstance: MarketDataService | null = null;

export function getMarketDataService(): MarketDataService {
  if (!serviceInstance) {
    serviceInstance = new MarketDataService();
  }
  return serviceInstance;
}
