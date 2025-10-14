export type OrderSide = 'buy' | 'sell';

export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  password?: string;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  quantity: number;
  price?: number;
  type: 'market' | 'limit';
}
