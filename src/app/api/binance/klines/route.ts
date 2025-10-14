import { NextResponse } from 'next/server';

const BINANCE_FUTURES_REST_URL = 'https://fapi.binance.com/fapi/v1';

const allowedIntervals = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval');
  const limit = searchParams.get('limit') ?? '500';
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');

  if (!symbol || !interval) {
    return NextResponse.json({ message: 'symbol과 interval은 필수입니다.' }, { status: 400 });
  }

  if (!allowedIntervals.has(interval)) {
    return NextResponse.json({ message: '지원하지 않는 interval입니다.' }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      symbol,
      interval,
      limit
    });

    if (startTime != null) {
      params.set('startTime', startTime);
    }

    if (endTime != null) {
      params.set('endTime', endTime);
    }

    const response = await fetch(
      `${BINANCE_FUTURES_REST_URL}/klines?${params.toString()}`,
      { cache: 'no-store' }
    );

    if (!response.ok) {
      return NextResponse.json(
        { message: `Binance 응답이 실패했습니다. (status ${response.status})` },
        { status: 502 }
      );
    }

    const payload = await response.json();
    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('[klines route] fetch error', error);
    return NextResponse.json({ message: 'Binance 데이터 요청 실패' }, { status: 502 });
  }
}
