/**
 * DMI 실시간 계산 API
 *
 * GET /api/indicators/dmi?symbol=BTCUSDT&interval=15m
 */

import { NextRequest, NextResponse } from 'next/server';
import { getIndicatorEngine } from '@/lib/trading/indicators/IndicatorEngine';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '15m';
    const period = parseInt(searchParams.get('period') || '14');
    const limit = 100; // DMI 계산을 위해 충분한 데이터

    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol is required' },
        { status: 400 }
      );
    }

    console.log(`[DMI API] Fetching data for ${symbol} ${interval}`);

    // Binance API에서 직접 캔들 데이터 가져오기
    const binanceUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(binanceUrl);

    if (!response.ok) {
      console.error(`[DMI API] Binance API error: ${response.status}`);
      return NextResponse.json(
        { error: 'Failed to fetch market data from Binance' },
        { status: response.status }
      );
    }

    const klines = await response.json();

    if (!Array.isArray(klines) || klines.length === 0) {
      console.error('[DMI API] No klines data received');
      return NextResponse.json(
        { error: 'No market data available' },
        { status: 404 }
      );
    }

    // 가격 데이터 추출
    const highs = klines.map(k => parseFloat(k[2]));
    const lows = klines.map(k => parseFloat(k[3]));
    const closes = klines.map(k => parseFloat(k[4]));

    console.log(`[DMI API] Data points: ${closes.length}`);

    // DMI 계산
    const indicatorEngine = getIndicatorEngine();
    const dmiResult = indicatorEngine.calculateDMI(highs, lows, closes, period);

    if (!dmiResult) {
      console.error('[DMI API] DMI calculation returned null');
      return NextResponse.json(
        { error: 'Failed to calculate DMI' },
        { status: 500 }
      );
    }

    console.log(`[DMI API] Result: ADX=${dmiResult.adx.toFixed(2)}, DI+=${dmiResult.plusDI.toFixed(2)}, DI-=${dmiResult.minusDI.toFixed(2)}`);

    return NextResponse.json({
      symbol,
      interval,
      period,
      adx: dmiResult.adx,
      plusDI: dmiResult.plusDI,
      minusDI: dmiResult.minusDI,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DMI API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: 'Internal server error', details: errorMessage },
      { status: 500 }
    );
  }
}