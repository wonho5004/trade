import type { Candle, IntervalOption } from '@/types/chart';

const BINANCE_FUTURES_WS_URL = 'wss://fstream.binance.com/ws';
const BINANCE_FUTURES_REST_URL = 'https://fapi.binance.com/fapi/v1';

type RawTickerEvent = {
  e: string;
  s: string;
  c: string;
  P: string;
  h: string;
  l: string;
  v: string;
  E?: number;
};

export type TickerUpdate = {
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  eventTime?: number;
};

type MessageHandler = (update: TickerUpdate) => void;

const isTickerEvent = (payload: unknown): payload is RawTickerEvent => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const event = payload as Record<string, unknown>;
  return (
    event.e === '24hrTicker' &&
    typeof event.s === 'string' &&
    typeof event.c === 'string' &&
    typeof event.P === 'string' &&
    typeof event.h === 'string' &&
    typeof event.l === 'string' &&
    typeof event.v === 'string'
  );
};

export function subscribeTicker(symbol: string, handler: MessageHandler, onError?: (message: string) => void) {
  const streamName = `${symbol.toLowerCase()}@ticker`;

  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    throw new Error('WebSocket은 클라이언트 환경에서만 사용할 수 있습니다.');
  }

  const socket = new WebSocket(`${BINANCE_FUTURES_WS_URL}/${streamName}`);
  let fallbackTimer: number | undefined;
  let hasConnected = false;

  const startFallback = () => {
    if (fallbackTimer != null) {
      return;
    }
    const poll = async () => {
      try {
        const snapshot = await fetchTicker24h(symbol);
        handler(snapshot);
      } catch (error) {
        // swallow polling errors in fallback mode
      }
    };
    poll();
    fallbackTimer = window.setInterval(poll, 10_000);
  };

  socket.onmessage = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data);
      if (!isTickerEvent(payload)) {
        return;
      }
      hasConnected = true;

      handler({
        symbol: payload.s,
        lastPrice: Number(payload.c),
        priceChangePercent: Number(payload.P),
        highPrice: Number(payload.h),
        lowPrice: Number(payload.l),
        volume: Number(payload.v),
        eventTime: payload.E
      });
    } catch (error) {
      onError?.('수신 데이터 파싱에 실패했습니다.');
    }
  };

  socket.onerror = () => {
    if (!hasConnected) {
      startFallback();
    }
    onError?.('Binance WebSocket 오류가 발생했습니다.');
  };

  socket.onclose = (event) => {
    if (!event.wasClean) {
      onError?.('WebSocket이 예상치 못하게 종료되었습니다.');
    }
    startFallback();
  };

  return () => {
    socket.close();
    if (fallbackTimer != null) {
      window.clearInterval(fallbackTimer);
      fallbackTimer = undefined;
    }
  };
}

type RawKlineEvent = {
  e: string;
  s: string;
  k: {
    t: number;
    T: number;
    i: string;
    o: string;
    c: string;
    h: string;
    l: string;
    v: string;
    x: boolean;
  };
};

const isKlineEvent = (payload: unknown): payload is RawKlineEvent => {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const candidate = payload as Record<string, unknown>;
  const kline = candidate.k as Record<string, unknown> | undefined;

  return (
    candidate.e === 'kline' &&
    typeof candidate.s === 'string' &&
    !!kline &&
    typeof kline.t === 'number' &&
    typeof kline.i === 'string' &&
    typeof kline.o === 'string' &&
    typeof kline.c === 'string' &&
    typeof kline.h === 'string' &&
    typeof kline.l === 'string' &&
    typeof kline.v === 'string' &&
    typeof kline.x === 'boolean'
  );
};

export type KlineUpdate = {
  candle: Candle;
  closed: boolean;
};

type KlineHandler = (update: KlineUpdate) => void;

export function subscribeKline(
  symbol: string,
  interval: IntervalOption,
  handler: KlineHandler,
  onError?: (message: string) => void
) {
  const streamName = `${symbol.toLowerCase()}@kline_${interval}`;

  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    throw new Error('WebSocket은 클라이언트 환경에서만 사용할 수 있습니다.');
  }

  const socket = new WebSocket(`${BINANCE_FUTURES_WS_URL}/${streamName}`);

  socket.onmessage = (event: MessageEvent<string>) => {
    try {
      const payload = JSON.parse(event.data);
      if (!isKlineEvent(payload)) {
        return;
      }

      const kline = payload.k;

      handler({
        candle: {
          timestamp: kline.t,
          open: Number(kline.o),
          high: Number(kline.h),
          low: Number(kline.l),
          close: Number(kline.c),
          volume: Number(kline.v)
        },
        closed: kline.x
      });
    } catch (error) {
      onError?.('캔들 데이터 파싱에 실패했습니다.');
    }
  };

  socket.onerror = () => {
    onError?.('Binance 캔들 WebSocket 오류가 발생했습니다.');
  };

  socket.onclose = (event) => {
    if (!event.wasClean) {
      onError?.('캔들 WebSocket이 예상치 못하게 종료되었습니다.');
    }
  };

  return () => {
    socket.close();
  };
}

function parseKlinesResponse(payload: unknown): Candle[] {
  if (!Array.isArray(payload)) {
    throw new Error('Binance 캔들 응답 포맷이 올바르지 않습니다.');
  }

  return payload.map((item) => {
    if (!Array.isArray(item) || item.length < 6) {
      throw new Error('캔들 데이터 항목이 올바르지 않습니다.');
    }

    const [openTime, open, high, low, close, volume] = item;

    return {
      timestamp: Number(openTime),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: Number(volume)
    };
  });
}

type CandleFetchOptions = {
  startTime?: number;
  endTime?: number;
};

export async function fetchFuturesCandles(
  symbol: string,
  interval: IntervalOption,
  limit = 500,
  options: CandleFetchOptions = {}
): Promise<Candle[]> {
  const params = new URLSearchParams({ symbol, interval, limit: String(limit) });
  if (options.startTime != null) {
    params.set('startTime', String(options.startTime));
  }
  if (options.endTime != null) {
    params.set('endTime', String(options.endTime));
  }
  const endpoint =
    typeof window === 'undefined'
      ? `${BINANCE_FUTURES_REST_URL}/klines?${params.toString()}`
      : new URL(`/api/binance/klines?${params.toString()}`, window.location.origin).toString();

  const response = await fetch(endpoint, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Binance 캔들 데이터를 불러오지 못했습니다. (status ${response.status})`);
  }

  const payload = await response.json();
  return parseKlinesResponse(payload);
}

export async function fetchTicker24h(symbol: string): Promise<TickerUpdate> {
  const endpoint =
    typeof window === 'undefined'
      ? `${BINANCE_FUTURES_REST_URL}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
      : new URL(`/api/binance/ticker?symbol=${encodeURIComponent(symbol)}`, window.location.origin).toString();

  const response = await fetch(endpoint, {
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`티커 데이터를 불러오지 못했습니다. (status ${response.status})`);
  }

  const payload = await response.json();
  return {
    symbol: payload.symbol,
    lastPrice: Number(payload.lastPrice),
    priceChangePercent: Number(payload.priceChangePercent),
    highPrice: Number(payload.highPrice),
    lowPrice: Number(payload.lowPrice),
    volume: Number(payload.volume),
    eventTime: payload.closeTime
  };
}
