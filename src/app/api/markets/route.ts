import { NextResponse } from 'next/server';

import { fetchTrendingMarkets } from '@/lib/trading/markets';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

type SortMode = 'volume' | 'changeUp' | 'changeDown' | 'alphabet' | 'tradeValue';

type CacheKey = `${QuoteCurrency}:${SortMode}`;

const TTL_MS = 60 * 1000;
const cache: Map<CacheKey, { items: TickerInfo[]; ts: number }> = new Map();

function getCache(quote: QuoteCurrency, sort: SortMode) {
  const key: CacheKey = `${quote}:${sort}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.items;
  return null;
}

function setCache(quote: QuoteCurrency, sort: SortMode, items: TickerInfo[]) {
  const key: CacheKey = `${quote}:${sort}`;
  cache.set(key, { items, ts: Date.now() });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const search = (url.searchParams.get('search') || '').trim();
  const quote = (url.searchParams.get('quote') || 'USDT').toUpperCase() as QuoteCurrency;
  const sort = (url.searchParams.get('sort') || 'volume') as SortMode;
  const limitRaw = url.searchParams.get('limit');
  const limit = Math.max(1, Math.min(2000, Number(limitRaw) || 1000));

  const allowedQuotes: QuoteCurrency[] = ['USDT', 'USDC'];
  const safeQuote = allowedQuotes.includes(quote) ? quote : 'USDT';
  const allowedSort: SortMode[] = ['volume', 'changeUp', 'changeDown', 'alphabet', 'tradeValue'];
  const safeSort = allowedSort.includes(sort) ? sort : 'volume';

  try {
    let items = getCache(safeQuote, safeSort);
    if (!items) {
      // pass search prompt to upstream; upstream will filter again below for safety
      items = await fetchTrendingMarkets(search || undefined, safeQuote, safeSort);
      setCache(safeQuote, safeSort, items);
    }

    let filtered = items.filter((it) => it.quote === safeQuote);
    if (search) {
      const q = search.toUpperCase().replace(/[^A-Z0-9]/g, '');
      filtered = filtered.filter((it) => it.symbol.includes(q) || it.base.includes(q));
    }

    return NextResponse.json({ items: filtered.slice(0, limit) }, { status: 200 });
  } catch (error) {
    console.error('[api/markets] failed', error);
    return NextResponse.json({ items: [] }, { status: 200 });
  }
}
