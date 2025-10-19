import type { LeverageBracket } from '@/types/trading/margin';

export type FuturesSymbolMeta = {
  symbol: string;
  base: string;
  quote: string;
  minNotional: number | null;
  minQty: number | null;
  pricePrecision: number | null;
  quantityPrecision: number | null;
  contractType: string | null;
  lastPrice: number | null;
  quoteVolume: number | null;
  baseVolume: number | null;
  marketCapEstimate: number | null;
  openInterest: number | null;
  leverageBrackets: LeverageBracket[];
};
