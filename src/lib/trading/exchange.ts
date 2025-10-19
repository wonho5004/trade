import ccxt from 'ccxt';

import type { ExchangeCredentials } from '@/types/trading';

export type BinanceFuturesClient = ReturnType<typeof createBinanceFuturesClient>;

export function createBinanceFuturesClient(credentials?: Partial<ExchangeCredentials>) {
  const client = new ccxt.binanceusdm({
    enableRateLimit: true,
    options: {
      defaultType: 'future'
    }
  });

  if (credentials?.apiKey ?? process.env.BINANCE_FUTURES_API_KEY) {
    client.apiKey = credentials?.apiKey ?? process.env.BINANCE_FUTURES_API_KEY ?? '';
  }

  if (credentials?.secret ?? process.env.BINANCE_FUTURES_API_SECRET) {
    client.secret = credentials?.secret ?? process.env.BINANCE_FUTURES_API_SECRET ?? '';
  }

  if (credentials?.password ?? process.env.BINANCE_FUTURES_API_PASSWORD) {
    client.password = credentials?.password ?? process.env.BINANCE_FUTURES_API_PASSWORD ?? '';
  }

  return client;
}
