// @ts-nocheck
import { NextResponse } from 'next/server';
import { createBinanceFuturesClient } from '@/lib/trading/exchange';

export async function GET(req: Request) {
  try {
    const client = createBinanceFuturesClient();
    // Note: ccxt binanceusdm fetchBalance returns futures wallet balances
    const balance = await client.fetchBalance();
    let positions: any[] = [];
    try {
      // some ccxt versions expose positions under balance.info.positions or via fetchPositions
      if (typeof client.fetchPositions === 'function') {
        positions = await client.fetchPositions();
      } else {
        const info = (balance as any)?.info;
        positions = Array.isArray(info?.positions) ? info.positions : [];
      }
    } catch {
      positions = [];
    }
    const usdtTotal = Number(balance?.USDT?.total ?? balance?.total?.USDT ?? NaN);
    const usdtFree = Number(balance?.USDT?.free ?? balance?.free?.USDT ?? NaN);
    const usdtWallet = Number.isFinite(usdtTotal) ? usdtTotal : (Number.isFinite(usdtFree) ? usdtFree : null);
    const usdcTotal = Number(balance?.USDC?.total ?? balance?.total?.USDC ?? NaN);
    const usdcFree = Number(balance?.USDC?.free ?? balance?.free?.USDC ?? NaN);
    const usdcWallet = Number.isFinite(usdcTotal) ? usdcTotal : (Number.isFinite(usdcFree) ? usdcFree : null);
    const url = new URL(req.url);
    const qSymbol = String(url.searchParams.get('symbol') || '');
    let positionNotionalUSDT: number | null = null;
    if (qSymbol) {
      try {
        const sym = qSymbol.toUpperCase();
        const pos = positions.find((p: any) => String(p?.symbol || p?.symbolName || '').toUpperCase() === sym);
        let lastPrice: number | null = null;
        try {
          const t = await client.fetchTicker(sym);
          lastPrice = Number(t?.last ?? t?.info?.lastPrice ?? NaN);
        } catch {}
        const amt = Number(pos?.positionAmt ?? pos?.contracts ?? NaN);
        if (Number.isFinite(amt) && Number.isFinite(lastPrice as any)) {
          positionNotionalUSDT = Math.abs(amt) * (lastPrice as number);
        }
      } catch {}
    }
    const summary = {
      walletUSDT: usdtWallet,
      totalUSDT: Number.isFinite(usdtTotal) ? usdtTotal : null,
      freeUSDT: Number.isFinite(usdtFree) ? usdtFree : null,
      walletUSDC: Number.isFinite(usdcWallet) ? usdcWallet : null,
      totalUSDC: Number.isFinite(usdcTotal) ? usdcTotal : null,
      freeUSDC: Number.isFinite(usdcFree) ? usdcFree : null,
      positionNotionalUSDT,
      positions: positions?.map((p: any) => ({
        symbol: p?.symbol ?? p?.symbolName ?? null,
        positionAmt: Number(p?.positionAmt ?? p?.contracts ?? 0) || 0,
        entryPrice: Number(p?.entryPrice ?? p?.entry ?? 0) || 0,
        notional: Number(p?.notional ?? p?.positionInitialMargin ?? 0) || null,
        leverage: Number(p?.leverage ?? 0) || null,
        side: Number(p?.positionAmt ?? 0) > 0 ? 'long' : Number(p?.positionAmt ?? 0) < 0 ? 'short' : 'flat'
      })) ?? []
    };
    return NextResponse.json({ ok: true, account: summary });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'ACCOUNT_FETCH_FAILED', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
