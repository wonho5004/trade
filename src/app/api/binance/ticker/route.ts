import { NextResponse } from 'next/server';

const BINANCE_FUTURES_REST_URL = 'https://fapi.binance.com/fapi/v1';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');

  if (!symbol) {
    return NextResponse.json({ message: 'symbol query parameter is required' }, { status: 400 });
  }

  try {
    const response = await fetch(`${BINANCE_FUTURES_REST_URL}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, {
      cache: 'no-store'
    });

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
    console.error('[ticker route] fetch error', error);
    return NextResponse.json({ message: 'Binance 데이터 요청 실패' }, { status: 502 });
  }
}
