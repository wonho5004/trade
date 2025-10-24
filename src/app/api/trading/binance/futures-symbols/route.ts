// @ts-nocheck
import { NextResponse } from 'next/server';
import type { Market, Ticker } from 'ccxt';

import { normalizeBinanceLeverageTiers } from '@/lib/trading/adapters/binanceLeverage';
import { createBinanceFuturesClient } from '@/lib/trading/exchange';
import { getAuthenticatedProfile } from '@/lib/users/profile';
import type { LeverageTierMap } from '@/types/trading/margin';
import type { FuturesSymbolMeta } from '@/types/trading/markets';

type CachedMarkets = {
  data: FuturesSymbolMeta[];
  fetchedAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedMarkets: CachedMarkets | null = null;

export async function GET() {
  try {
    if (cachedMarkets && Date.now() - cachedMarkets.fetchedAt < CACHE_TTL_MS) {
      return NextResponse.json({
        markets: cachedMarkets.data,
        fetchedAt: new Date(cachedMarkets.fetchedAt).toISOString(),
        cached: true
      });
    }

    // 가능하면 사용자 자격증명을 사용해 레버리지 티어(인증 필요)를 조회
    const prof = await getAuthenticatedProfile();
    const client = createBinanceFuturesClient(
      prof?.binanceApiKey && prof?.binanceApiSecret
        ? { apiKey: prof.binanceApiKey, secret: prof.binanceApiSecret }
        : undefined
    );
    const markets = (await client.fetchMarkets()) as Market[];
    let tickers: Record<string, Ticker> | null = null;
    let leverageTiers: LeverageTierMap = {};

    try {
      tickers = await client.fetchTickers();
    } catch (tickerError) {
      console.warn('[binance:futures-symbols] fetchTickers failed, continuing without ticker stats', tickerError);
    }

    try {
      const tiersResponse = await client.fetchLeverageTiers();
      leverageTiers = normalizeBinanceLeverageTiers(tiersResponse);
    } catch (leverageError) {
      console.warn('[binance:futures-symbols] fetchLeverageTiers failed, continuing without leverage tiers', leverageError);
    }

    const usableMarkets: FuturesSymbolMeta[] = markets
      .filter((market: Market) => Boolean(market?.active) && (market?.quote === 'USDT' || market?.quote === 'USDC'))
      .map((market: Market) => {
        const m: Market = market as Market;
        const idKey = String((m as any).id ?? (m.info as any)?.symbol ?? `${m.base ?? ''}${m.quote ?? ''}`).toUpperCase();
        const tiersFor = leverageTiers[idKey] ?? leverageTiers[`${String(m.base ?? '').toUpperCase()}${String(m.quote ?? '').toUpperCase()}`] ?? [];
        return {
          symbol: m.symbol,
          base: m.base ?? '',
          quote: m.quote ?? '',
          minNotional: m.limits?.cost?.min ?? null,
          minQty: m.limits?.amount?.min ?? null,
          pricePrecision: m.precision?.price ?? null,
          quantityPrecision: m.precision?.amount ?? null,
          contractType: (m.info?.contractType as string | undefined) ?? null,
          lastPrice: extractNumber(tickers?.[m.symbol]?.last ?? tickers?.[m.symbol]?.info?.lastPrice),
          quoteVolume: extractNumber(
            tickers?.[m.symbol]?.quoteVolume ?? tickers?.[m.symbol]?.info?.quoteVolume
          ),
          baseVolume: extractNumber(
            tickers?.[m.symbol]?.baseVolume ?? tickers?.[m.symbol]?.info?.volume
          ),
          marketCapEstimate: extractMarketCap(tickers?.[m.symbol]),
          openInterest: extractNumber(tickers?.[m.symbol]?.info?.openInterest),
          leverageBrackets: tiersFor
        } as FuturesSymbolMeta;
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    cachedMarkets = {
      data: usableMarkets,
      fetchedAt: Date.now()
    };

    return NextResponse.json({
      markets: usableMarkets,
      fetchedAt: new Date(cachedMarkets.fetchedAt).toISOString(),
      cached: false
    });
  } catch (error) {
    if (cachedMarkets) {
      return NextResponse.json(
        {
          markets: cachedMarkets.data,
          fetchedAt: new Date(cachedMarkets.fetchedAt).toISOString(),
          cached: true,
          stale: true,
          error: 'BINANCE_FETCH_FAILED'
        },
        { status: 200 }
      );
    }

    console.error('[binance:futures-symbols] failed to fetch markets', error);
    return NextResponse.json({ error: 'FAILED_TO_FETCH_BINANCE_MARKETS' }, { status: 503 });
  }
}

const extractNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const extractMarketCap = (ticker: Ticker | undefined): number | null => {
  if (!ticker) {
    return null;
  }
  const info = ticker.info ?? ({} as Record<string, unknown>);
  const openInterestValue = extractNumber((info as Record<string, unknown>).openInterestValue);
  if (openInterestValue != null) {
    return openInterestValue;
  }
  const openInterest = extractNumber((info as Record<string, unknown>).openInterest);
  const lastPrice = extractNumber(ticker.last ?? (info as Record<string, unknown>).lastPrice);
  if (openInterest != null && lastPrice != null) {
    return openInterest * lastPrice;
  }
  return null;
};
