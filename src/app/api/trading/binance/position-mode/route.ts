// @ts-nocheck
import { NextResponse } from 'next/server';
import { createBinanceFuturesClient } from '@/lib/trading/exchange';

export async function GET() {
  try {
    if (!process.env.BINANCE_FUTURES_API_KEY || !process.env.BINANCE_FUTURES_API_SECRET) {
      return NextResponse.json({ ok: false, error: 'NO_CREDENTIALS', message: 'API credentials are not configured' }, { status: 200 });
    }
    const client = createBinanceFuturesClient();
    const resp: any = await (client as any).fapiPrivateGetPositionSideDual?.();
    const dual = typeof resp?.dualSidePosition === 'boolean'
      ? resp.dualSidePosition
      : String(resp?.dualSidePosition || '').toLowerCase() === 'true';
    const positionMode = dual ? 'hedge' : 'one_way';
    return NextResponse.json({ ok: true, positionMode, dualSidePosition: dual });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'FETCH_FAILED', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

