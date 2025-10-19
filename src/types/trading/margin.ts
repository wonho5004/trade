export type LeverageBracket = {
  maxLeverage: number | null;
  maxNotional: number | null;
};

export type LeverageTierMap = Record<string, LeverageBracket[]>;

export type MarginCapResult = {
  exchangeMaxNotional: number | null;
  strategyMaxNotional: number | null;
  effectiveMaxNotional: number | null;
  limitedBy: 'exchange' | 'strategy' | 'none';
};
