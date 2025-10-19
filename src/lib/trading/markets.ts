import type { QuoteCurrency, TickerInfo } from '@/types/assets';
type BinanceExchangeInfo = { symbols: Array<{ symbol: string; contractType?: string; status?: string; onboardDate?: number }>; };

const SUPPORTED_QUOTES: QuoteCurrency[] = ['USDT', 'USDC'];

const VOLUME_WEIGHT = 0.6;
const CHANGE_WEIGHT = 0.4;

const BINANCE_FUTURES_TICKER_URL = 'https://fapi.binance.com/fapi/v1/ticker/24hr';

const FALLBACK_TICKERS: BinanceTickerResponse[] = [
  { symbol: 'BTCUSDT', priceChangePercent: '1.52', volume: '52345.12', quoteVolume: '186523456.22' },
  { symbol: 'ETHUSDT', priceChangePercent: '-0.83', volume: '32123.44', quoteVolume: '102345678.55' },
  { symbol: 'BNBUSDT', priceChangePercent: '0.45', volume: '18902.11', quoteVolume: '50234567.88' },
  { symbol: 'SOLUSDT', priceChangePercent: '3.21', volume: '15432.77', quoteVolume: '43215678.21' },
  { symbol: 'XRPUSDT', priceChangePercent: '0.92', volume: '64231.5', quoteVolume: '25678901.12' },
  { symbol: 'ADAUSDT', priceChangePercent: '-0.64', volume: '52123.9', quoteVolume: '18234567.33' },
  { symbol: 'DOGEUSDT', priceChangePercent: '2.34', volume: '98231.44', quoteVolume: '12567890.11' },
  { symbol: 'AVAXUSDT', priceChangePercent: '1.05', volume: '14321.77', quoteVolume: '23456789.12' },
  { symbol: 'MATICUSDT', priceChangePercent: '0.35', volume: '23890.31', quoteVolume: '14567890.45' },
  { symbol: 'LTCUSDT', priceChangePercent: '-0.24', volume: '19876.52', quoteVolume: '8765432.22' },
  { symbol: 'BTCUSDC', priceChangePercent: '1.48', volume: '4123.56', quoteVolume: '14562345.23' },
  { symbol: 'ETHUSDC', priceChangePercent: '-1.12', volume: '2890.44', quoteVolume: '8762345.12' },
  { symbol: 'SOLUSDC', priceChangePercent: '2.11', volume: '2101.23', quoteVolume: '5211234.88' },
  { symbol: 'XRPUSDC', priceChangePercent: '0.55', volume: '3102.56', quoteVolume: '2323456.77' }
];

const FALLBACK_FUTURES_SET = new Set(FALLBACK_TICKERS.map((item) => item.symbol));

interface BinanceTickerResponse {
  symbol: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
}

const getQuoteCurrency = (symbol: string): QuoteCurrency | null => {
  const match = SUPPORTED_QUOTES.find((quote) => symbol.endsWith(quote));
  return match ?? null;
};

const parseTicker = (ticker: BinanceTickerResponse): TickerInfo | null => {
  const quote = getQuoteCurrency(ticker.symbol);
  if (!quote) {
    return null;
  }

  const base = ticker.symbol.replace(quote, '');

  return {
    symbol: ticker.symbol,
    base,
    quote,
    priceChangePercent: Number(ticker.priceChangePercent ?? 0),
    volume: Number(ticker.volume ?? 0),
    quoteVolume: Number(ticker.quoteVolume ?? 0)
  };
};

const scoreTicker = (ticker: TickerInfo): number => {
  const normalizedVolume = Math.log10(ticker.volume + 1);
  const normalizedChange = Math.abs(ticker.priceChangePercent);
  return normalizedVolume * VOLUME_WEIGHT + normalizedChange * CHANGE_WEIGHT;
};

export async function fetchTrendingMarkets(
  prompt?: string,
  preferredQuote?: QuoteCurrency,
  sortMode: 'volume' | 'changeUp' | 'changeDown' | 'alphabet' | 'tradeValue' = 'volume'
): Promise<TickerInfo[]> {
  let rawTickers: BinanceTickerResponse[] = FALLBACK_TICKERS;
  let validSymbols: Set<string> = FALLBACK_FUTURES_SET;
  const listingAgeMap: Map<string, number | null> = new Map();

  try {
    const response = await fetch(BINANCE_FUTURES_TICKER_URL, { cache: 'no-store' });

    if (response.ok) {
      rawTickers = (await response.json()) as BinanceTickerResponse[];
    } else {
      console.warn(`[markets] Binance response ${response.status}, using fallback dataset`);
    }
  } catch (error) {
    console.warn('[markets] Binance fetch failed, using fallback dataset', error);
  }

  try {
    const infoResponse = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', {
      cache: 'force-cache'
    });
    if (infoResponse.ok) {
      const info = (await infoResponse.json()) as BinanceExchangeInfo;
      const now = Date.now();
      const perpetual = info.symbols
        .filter((item) => item.contractType === 'PERPETUAL' && item.status === 'TRADING')
        .map((item) => ({ symbol: item.symbol, onboardDate: item.onboardDate }));
      if (perpetual.length > 0) {
        validSymbols = new Set(perpetual.map((p) => p.symbol));
      }
      // Attach listing age to fallback tickers when possible
      for (const p of perpetual) {
        const days = typeof p.onboardDate === 'number' && p.onboardDate > 0 ? Math.floor((now - p.onboardDate) / (24 * 60 * 60 * 1000)) : null;
        listingAgeMap.set(p.symbol, days);
      }
      // decorate FALLBACK_TICKERS ages (optional)
      FALLBACK_TICKERS.forEach((t) => {
        if (!listingAgeMap.has(t.symbol)) listingAgeMap.set(t.symbol, null);
      });
    }
  } catch (error) {
    console.warn('[markets] exchangeInfo fetch failed, falling back to static list', error);
  }

  const parsedTickers = rawTickers
    .map((ticker) => parseTicker(ticker))
    .filter((ticker): ticker is TickerInfo => ticker != null);

  const filtered = parsedTickers.filter((item) => validSymbols.has(item.symbol));

  const searched = prompt
    ? filtered.filter((item) => item.symbol.toLowerCase().includes(prompt.toLowerCase()))
    : filtered;

  const scored = searched.map((item) => ({
    ...item,
    score: scoreTicker(item),
    direction: item.priceChangePercent >= 0 ? 'up' : 'down'
  }));

  const sorted = scored.sort((a, b) => {
    if (preferredQuote) {
      if (a.quote === preferredQuote && b.quote !== preferredQuote) {
        return -1;
      }
      if (a.quote !== preferredQuote && b.quote === preferredQuote) {
        return 1;
      }
    }

    if (sortMode === 'alphabet') {
      return a.symbol.localeCompare(b.symbol);
    }
    if (sortMode === 'changeUp') {
      return b.priceChangePercent - a.priceChangePercent;
    }
    if (sortMode === 'changeDown') {
      return a.priceChangePercent - b.priceChangePercent;
    }
    if (sortMode === 'tradeValue') {
      return b.quoteVolume - a.quoteVolume;
    }
    return b.volume - a.volume;
  });

  return sorted.map(({ score: _score, direction: _direction, ...rest }) => ({
      ...rest,
      listedDays: listingAgeMap.get(rest.symbol) ?? null
    }));
}

// Returns a Set of tradable perpetual symbols (e.g., BTCUSDT)
export async function fetchPerpetualSymbolSet(): Promise<Set<string>> {
  let validSymbols: Set<string> = FALLBACK_FUTURES_SET;
  try {
    const infoResponse = await fetch('https://fapi.binance.com/fapi/v1/exchangeInfo', {
      cache: 'force-cache'
    });
    if (infoResponse.ok) {
      const info = (await infoResponse.json()) as any;
      const perpetual = Array.isArray(info?.symbols)
        ? info.symbols
            .filter((item: any) => item.contractType === 'PERPETUAL' && item.status === 'TRADING')
            .map((item: any) => String(item.symbol))
        : [];
      if (perpetual.length > 0) {
        validSymbols = new Set(perpetual);
      }
    }
  } catch (error) {
    console.warn('[markets] exchangeInfo fetch failed for symbol set, falling back to static list', error);
  }
  return validSymbols;
}
