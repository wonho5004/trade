/**
 * Binance Futures WebSocket Client
 *
 * 실시간 가격 데이터를 수신하고 캔들 데이터를 관리합니다.
 *
 * WebSocket Endpoints:
 * - Production: wss://fstream.binance.com/ws
 * - Testnet: wss://stream.binancefuture.com/ws
 */

import WebSocket from 'ws';

export interface KlineData {
  symbol: string;
  interval: string;
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  isClosed: boolean;
}

export interface KlineEvent {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
    B: string; // Ignore
  };
}

export type KlineCallback = (kline: KlineData) => void;

export class BinanceWebSocketClient {
  private ws: WebSocket | null = null;
  private subscriptions = new Map<string, Set<KlineCallback>>();
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000; // 5 seconds
  private isConnecting = false;

  private readonly baseUrl = 'wss://fstream.binance.com/ws';

  constructor() {
    this.connect();
  }

  /**
   * WebSocket 연결
   */
  private connect(): void {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.baseUrl);

      this.ws.on('open', () => {
        console.log('✅ Binance WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // 기존 구독 복원
        this.resubscribeAll();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        try {
          const event = JSON.parse(data.toString()) as KlineEvent;
          this.handleKlineEvent(event);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });

      this.ws.on('close', () => {
        console.log('❌ Binance WebSocket disconnected');
        this.isConnecting = false;
        this.scheduleReconnect();
      });

      this.ws.on('ping', () => {
        this.ws?.pong();
      });

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * 재연결 스케줄링
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnect attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);

    console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * 모든 구독 복원
   */
  private resubscribeAll(): void {
    if (this.subscriptions.size === 0) return;

    const streams = Array.from(this.subscriptions.keys());
    this.sendSubscribe(streams);

    console.log(`✅ Resubscribed to ${streams.length} streams`);
  }

  /**
   * 구독 요청 전송
   */
  private sendSubscribe(streams: string[]): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket is not open, cannot subscribe');
      return;
    }

    const message = {
      method: 'SUBSCRIBE',
      params: streams,
      id: Date.now()
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * 구독 취소 요청 전송
   */
  private sendUnsubscribe(streams: string[]): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      method: 'UNSUBSCRIBE',
      params: streams,
      id: Date.now()
    };

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Kline 이벤트 처리
   */
  private handleKlineEvent(event: KlineEvent): void {
    if (event.e !== 'kline') return;

    const stream = `${event.k.s.toLowerCase()}@kline_${event.k.i}`;
    const callbacks = this.subscriptions.get(stream);

    if (!callbacks || callbacks.size === 0) return;

    const kline: KlineData = {
      symbol: event.k.s,
      interval: event.k.i,
      openTime: event.k.t,
      closeTime: event.k.T,
      open: event.k.o,
      high: event.k.h,
      low: event.k.l,
      close: event.k.c,
      volume: event.k.v,
      isClosed: event.k.x
    };

    callbacks.forEach(callback => {
      try {
        callback(kline);
      } catch (error) {
        console.error('Error in kline callback:', error);
      }
    });
  }

  /**
   * Kline 스트림 구독
   *
   * @param symbol - 심볼 (예: BTCUSDT)
   * @param interval - 간격 (예: 3m, 5m, 15m, 1h)
   * @param callback - 데이터 수신 콜백
   */
  subscribeKline(symbol: string, interval: string, callback: KlineCallback): () => void {
    const stream = `${symbol.toLowerCase()}@kline_${interval}`;

    if (!this.subscriptions.has(stream)) {
      this.subscriptions.set(stream, new Set());

      // WebSocket이 연결되어 있으면 즉시 구독
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendSubscribe([stream]);
      }
    }

    this.subscriptions.get(stream)!.add(callback);

    console.log(`📊 Subscribed to ${stream}`);

    // 구독 취소 함수 반환
    return () => {
      const callbacks = this.subscriptions.get(stream);
      if (callbacks) {
        callbacks.delete(callback);

        // 더 이상 콜백이 없으면 구독 취소
        if (callbacks.size === 0) {
          this.subscriptions.delete(stream);
          this.sendUnsubscribe([stream]);
          console.log(`📊 Unsubscribed from ${stream}`);
        }
      }
    };
  }

  /**
   * 모든 구독 취소 및 연결 종료
   */
  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.subscriptions.clear();
    console.log('🔌 WebSocket disconnected');
  }

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 현재 구독 중인 스트림 목록
   */
  getSubscriptions(): string[] {
    return Array.from(this.subscriptions.keys());
  }
}

// Singleton instance
let wsClientInstance: BinanceWebSocketClient | null = null;

export function getBinanceWebSocketClient(): BinanceWebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new BinanceWebSocketClient();
  }
  return wsClientInstance;
}
