import { NextResponse } from 'next/server';

import { fetchTrendingMarkets } from '@/lib/trading/markets';
import type { QuoteCurrency } from '@/types/assets';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const quote = (searchParams.get('quote')?.toUpperCase() ?? 'USDT') as QuoteCurrency;
  const search = searchParams.get('search') ?? undefined;

  try {
    const sort = (searchParams.get('sort') ?? 'volume') as
      | 'volume'
      | 'changeUp'
      | 'changeDown'
      | 'alphabet'
      | 'tradeValue';
    const markets = await fetchTrendingMarkets(search, quote, sort);
    const filtered = markets.filter((item) => item.quote === quote);

    return NextResponse.json(
      { items: filtered },
      {
        headers: { 'Cache-Control': 'no-store' }
      }
    );
  } catch (error) {
    console.error('[markets route] fetch error', error);
    return NextResponse.json({ message: 'Binance 마켓 데이터를 가져오지 못했습니다.' }, { status: 502 });
  }
}
