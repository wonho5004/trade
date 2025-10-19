export function normalizeSymbol(input: string, defaultQuote: string = 'USDT') {
  let s = (input || '').trim().toUpperCase();
  if (!s) return '';
  s = s.replace(/[\s:/_-]+/g, '');
  if (!s.endsWith(defaultQuote)) {
    // if input contained the quote with separators like BTC/USDT, remove non-letters already handled above
    // otherwise, if user entered only base, append quote
    if (s.length <= 6 && /^[A-Z]{2,6}$/.test(s)) {
      s = s + defaultQuote;
    }
  }
  return s;
}

export function uniqueAppend(list: string[], symbol: string) {
  const s = normalizeSymbol(symbol);
  if (!s) return list;
  if (list.includes(s)) return list;
  return [...list, s];
}

export function removeSymbol(list: string[], symbol: string) {
  const s = normalizeSymbol(symbol);
  return list.filter((it) => it !== s);
}

