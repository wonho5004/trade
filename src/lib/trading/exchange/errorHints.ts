export type ExchangeErrorInfo = { code: string; hint: string };

const RULES: Array<{ test: RegExp; info: ExchangeErrorInfo }> = [
  { test: /filter failure.*NOTIONAL|notional.*too (small|low)/i, info: { code: 'FILTER_NOTIONAL', hint: '최소 주문 금액을 충족하도록 금액/수량을 늘리세요.' } },
  { test: /insufficient.*margin|not enough balance/i, info: { code: 'INSUFFICIENT_MARGIN', hint: '가용 증거금이 부족합니다. 금액을 줄이거나 레버리지를 낮추세요.' } },
  { test: /reduce.?only.*rejected/i, info: { code: 'REDUCE_ONLY_REJECTED', hint: '리듀스온리로 인해 주문이 거부되었습니다. 옵션을 해제하거나 수량을 조정하세요.' } },
  { test: /position mode|hedge.*disabled|one.?way/i, info: { code: 'POSITION_MODE_MISMATCH', hint: '포지션 모드와 주문의 positionSide가 일치하지 않습니다. 모드를 확인하세요.' } },
  { test: /precision.*(over|invalid)|invalid price|invalid quantity/i, info: { code: 'INVALID_PRECISION', hint: '가격/수량 소수 자릿수를 심볼 제약에 맞추세요.' } },
  { test: /workingType|invalid working type/i, info: { code: 'INVALID_WORKING_TYPE', hint: '스탑 주문의 기준(표시/계약) 설정을 확인하세요.' } }
];

export function mapExchangeError(e: unknown): ExchangeErrorInfo | null {
  const msg = typeof e === 'string' ? e : (e as any)?.message || String(e ?? '');
  for (const r of RULES) {
    if (r.test.test(msg)) return r.info;
  }
  return null;
}

