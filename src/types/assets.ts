export interface TickerInfo {
  symbol: string;
  base: string;
  quote: string;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
}

export type QuoteCurrency = 'USDT' | 'USDC';
