export interface TickerInfo {
  symbol: string;
  base: string;
  quote: string;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
  listedDays?: number | null;
}

export type QuoteCurrency = 'USDT' | 'USDC';
