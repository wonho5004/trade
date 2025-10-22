export function normalizeSymbol(input: string, defaultQuote: string = 'USDT') {
  let raw = (input || '').trim().toUpperCase();
  if (!raw) return '';
  // Keep only A-Z and digits, drop any other chars (e.g., CJK, punctuation)
  let s = raw.replace(/[^A-Z0-9]/g, '');
  const QUOTE = (defaultQuote || 'USDT').toUpperCase();
  if (!s) return '';
  if (s === QUOTE) return '';
  const endsWithQuote = s.endsWith(QUOTE);
  if (endsWithQuote) {
    const base = s.slice(0, -QUOTE.length);
    if (/^[A-Z0-9]{2,12}$/.test(base)) {
      return base + QUOTE;
    }
    return '';
  }
  // If only base is provided and looks valid, append quote
  if (/^[A-Z0-9]{2,12}$/.test(s)) {
    return s + QUOTE;
  }
  return '';
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
