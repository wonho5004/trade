// @ts-nocheck
import { NextResponse } from 'next/server';

import { createBinanceFuturesClient } from '@/lib/trading/exchange';
import type { PlannedOrder } from '@/lib/trading/engine/orderPlanner';
import { toBinanceFuturesOrder } from '@/lib/trading/exchange/binanceOrders';
import { mapExchangeError } from '@/lib/trading/exchange/errorHints';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const symbol = String(body?.symbol || '').toUpperCase();
    const planned: PlannedOrder[] = Array.isArray(body?.orders) ? body.orders : [];
    const directPayloads: any[] = Array.isArray(body?.payloads) ? body.payloads : [];
    let positionMode = body?.positionMode === 'hedge' ? 'hedge' : (body?.positionMode === 'one_way' ? 'one_way' : undefined);
    const safety = body?.safety && typeof body.safety === 'object' ? body.safety : {};
    const maxOrders = Number(safety?.maxOrders ?? 50);
    const maxNotional = Number(safety?.maxNotional ?? 100_000);
    const useMinNotionalFallback = body?.useMinNotionalFallback !== false; // default true
    const dryRun: boolean = body?.dryRun !== false; // default true

    if (!symbol || (planned.length === 0 && directPayloads.length === 0)) {
      return NextResponse.json({ ok: false, error: 'INVALID_INPUT', message: 'symbol and orders or payloads are required' }, { status: 400 });
    }

    if (planned.length > maxOrders) {
      return NextResponse.json({ ok: false, error: 'SAFETY_LIMIT', message: `too many orders (${planned.length} > ${maxOrders})` }, { status: 400 });
    }

    let payloads = (directPayloads.length > 0 ? directPayloads : planned
      .map((o) => toBinanceFuturesOrder(symbol, o))
      .filter((p): p is NonNullable<typeof p> => !!p)) as any[];

    // Optional: minNotional fallback (best-effort on server)
    if (useMinNotionalFallback && payloads.length > 0) {
      try {
        const client = createBinanceFuturesClient();
        await (client as any).loadMarkets?.();
        const m = (client as any).market?.(symbol) ?? {};
        const precision = Number(m?.precision?.amount ?? 0) || 0;
        let minCost: number | null = null;
        if (m?.limits?.cost?.min != null) minCost = Number(m.limits.cost.min);
        if (!Number.isFinite(minCost as any)) {
          const filters = Array.isArray(m?.info?.filters) ? m.info.filters : [];
          const f = filters.find((x: any) => String(x?.filterType || x?.type || '').includes('NOTIONAL'));
          if (f && (f.minNotional || f.notional)) minCost = Number(f.minNotional ?? f.notional);
        }
        if (Number.isFinite(minCost as any)) {
          const minN = minCost as number;
          const step = Math.pow(10, -precision);
          // fetch last price once for market orders
          let lastPrice: number | null = null;
          try {
            const t = await client.fetchTicker(symbol);
            lastPrice = Number(t?.last ?? t?.info?.lastPrice ?? NaN);
            if (!Number.isFinite(lastPrice as any)) lastPrice = null;
          } catch { lastPrice = null; }
          payloads = payloads.map((p) => {
            try {
              const t = String((p as any).type || '').toUpperCase();
              const q = Number((p as any).quantity ?? NaN);
              if (!Number.isFinite(q) || q <= 0) return p;
              const ref = Number((p as any).price ?? (p as any).stopPrice ?? NaN);
              const price = (t === 'MARKET') ? (lastPrice ?? NaN) : ref;
              if (!Number.isFinite(price) || price <= 0) return p;
              const cost = price * q;
              if (cost >= minN) return p;
              const req = minN / price;
              const newQ = Math.ceil(req / step) * step;
              const fixed = Number(newQ.toFixed(precision));
              return { ...(p as any), quantity: fixed, _adjustReason: 'min_notional_aligned' };
            } catch { return p; }
          });
        }
      } catch { /* ignore fallback errors */ }
    }

    // Auto-detect positionMode from account when not provided and credentials exist (best-effort)
    if (!positionMode && process.env.BINANCE_FUTURES_API_KEY && process.env.BINANCE_FUTURES_API_SECRET) {
      try {
        const client = createBinanceFuturesClient();
        // binance futures dual-side flag: true => hedge, false => one_way
        const resp: any = await (client as any).fapiPrivateGetPositionSideDual?.();
        const dual = typeof resp?.dualSidePosition === 'boolean'
          ? resp.dualSidePosition
          : String(resp?.dualSidePosition || '').toLowerCase() === 'true';
        positionMode = dual ? 'hedge' : 'one_way';
      } catch (_) {
        // ignore detection errors; proceed without mode validation
      }
    }

    // Safety: position mode vs positionSide validation
    if (positionMode) {
      const invalid: any[] = [];
      for (const p of payloads) {
        const side = (p as any).positionSide ?? 'BOTH';
        if (positionMode === 'one_way' && side !== 'BOTH') invalid.push({ type: p.type, side: p.side, positionSide: side });
        if (positionMode === 'hedge' && side === 'BOTH') invalid.push({ type: p.type, side: p.side, positionSide: side });
      }
      if (invalid.length > 0) {
        return NextResponse.json({ ok: false, error: 'POSITION_MODE_MISMATCH', message: `positionMode=${positionMode} and payload positionSide mismatch`, invalid }, { status: 400 });
      }
    }

    // Safety: check per-order notional when provided
    const violator = planned.find((o) => typeof o.notional === 'number' && Number(o.notional) > maxNotional);
    if (violator) {
      return NextResponse.json({ ok: false, error: 'SAFETY_LIMIT', message: `order notional exceeds maxNotional (${violator.notional} > ${maxNotional})`, orderId: violator.id }, { status: 400 });
    }

    if (dryRun) {
      // Safety report for dry-run
      let violations: any[] = [];
      try {
        const c = createBinanceFuturesClient();
        const t = await c.fetchTicker(symbol);
        const last = Number(t?.last ?? t?.info?.lastPrice ?? NaN);
        const lastPrice = Number.isFinite(last) ? last : null;
        payloads.forEach((p, idx) => {
          try {
            const tp = String((p as any).type || '').toUpperCase();
            const q = Number((p as any).quantity ?? NaN);
            const ref = Number((p as any).price ?? (p as any).stopPrice ?? NaN);
            const price = (tp === 'MARKET') ? (lastPrice ?? NaN) : ref;
            if (!Number.isFinite(q) || !Number.isFinite(price) || q <= 0 || price <= 0) return;
            const cost = price * q;
            if (Number.isFinite(maxNotional) && cost > maxNotional) violations.push({ index: idx, type: 'maxNotional', cost, limit: maxNotional });
          } catch {}
        });
      } catch {}
      return NextResponse.json({ ok: true, dryRun: true, payloads, safety: { orderCount: payloads.length, maxOrders, exceededMaxOrders: payloads.length > maxOrders, maxNotional, violations, useMinNotionalFallback } });
    }

    const client = createBinanceFuturesClient();
    const results: any[] = [];
    for (const p of payloads) {
      try {
        if (p.type === 'MARKET') {
          const res = await client.createOrder(symbol, 'market', p.side, Number(p.quantity), undefined, {
            reduceOnly: p.reduceOnly,
            positionSide: p.positionSide
          });
          results.push({ ok: true, request: p, response: res, adjustReason: (p as any)._adjustReason });
        } else if (p.type === 'LIMIT') {
          const res = await client.createOrder(symbol, 'limit', p.side, Number(p.quantity), Number(p.price), {
            timeInForce: p.timeInForce || 'GTC',
            reduceOnly: p.reduceOnly,
            positionSide: p.positionSide
          });
          results.push({ ok: true, request: p, response: res, adjustReason: (p as any)._adjustReason });
        } else if (p.type === 'STOP_MARKET') {
          // ccxt binanceusdm supports stop market via createOrder with params
          const res = await client.createOrder(symbol, 'STOP_MARKET', p.side, undefined, undefined, {
            stopPrice: Number(p.stopPrice),
            reduceOnly: p.reduceOnly ?? true,
            workingType: p.workingType || 'MARK_PRICE',
            positionSide: p.positionSide
          });
          results.push({ ok: true, request: p, response: res, adjustReason: (p as any)._adjustReason });
        } else {
          results.push({ ok: false, request: p, error: 'UNSUPPORTED_TYPE', code: 'UNSUPPORTED_TYPE', hint: '지원하지 않는 주문 타입입니다.' });
        }
      } catch (e) {
        const info = mapExchangeError(e);
        results.push({ ok: false, request: p, error: e instanceof Error ? e.message : String(e), code: info?.code, hint: info?.hint, adjustReason: (p as any)._adjustReason });
      }
    }

    // Safety report for final
    let violations: any[] = [];
    try {
      const c = createBinanceFuturesClient();
      const t = await c.fetchTicker(symbol);
      const last = Number(t?.last ?? t?.info?.lastPrice ?? NaN);
      const lastPrice = Number.isFinite(last) ? last : null;
      payloads.forEach((p, idx) => {
        try {
          const tp = String((p as any).type || '').toUpperCase();
          const q = Number((p as any).quantity ?? NaN);
          const ref = Number((p as any).price ?? (p as any).stopPrice ?? NaN);
          const price = (tp === 'MARKET') ? (lastPrice ?? NaN) : ref;
          if (!Number.isFinite(q) || !Number.isFinite(price) || q <= 0 || price <= 0) return;
          const cost = price * q;
          if (Number.isFinite(maxNotional) && cost > maxNotional) violations.push({ index: idx, type: 'maxNotional', cost, limit: maxNotional });
        } catch {}
      });
    } catch {}
    return NextResponse.json({ ok: true, dryRun: false, results, safety: { orderCount: payloads.length, maxOrders, exceededMaxOrders: payloads.length > maxOrders, maxNotional, violations, useMinNotionalFallback } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: 'PLACE_ORDER_FAILED', message: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
