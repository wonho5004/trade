"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import { ERROR_HELP } from './errorHelp';

import type { IndicatorConditions, PositionDirection } from '@/types/trading/auto-trading';
import type { IntervalOption } from '@/types/chart';
import { useConditionsEvaluator } from '@/hooks/useConditionsEvaluator';
import { intervalToMs } from '@/types/chart';
import { ConditionsTrace } from './ConditionsTrace';
import { buildIndicatorNumericSeries } from '@/lib/trading/engine/indicatorSignals';
import { buildActionIntents } from '@/lib/trading/engine/actions';
import { materializeOrders, type MarketConstraints, type RuntimeAmounts } from '@/lib/trading/engine/orderPlanner';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';

export function ConditionsPreview({
  conditions,
  symbol,
  interval,
  direction = 'long',
  indicatorSignals,
  overrides,
  enabled = true,
  positionMode
}: {
  conditions: IndicatorConditions | undefined;
  symbol: string;
  interval: IntervalOption;
  direction?: PositionDirection;
  indicatorSignals?: Record<string, boolean>;
  overrides?: Partial<ReturnType<typeof mapOverrides>>;
  enabled?: boolean;
  positionMode?: 'one_way' | 'hedge';
}) {
  const settings = useAutoTradingSettingsStore((s) => s.settings);
  const [showDetails, setShowDetails] = useState(false);
  const [localOverrides, setLocalOverrides] = useState<{ profitRatePct?: number; marginUSDT?: number; marginUSDC?: number; buyCount?: number; entryAgeDays?: number }>(overrides ?? {});
  const mappedOverrides = useMemo(() => mapOverrides(overrides), [overrides]);
  const { match, ready, lastEvaluatedAt, error, context, extras } = useConditionsEvaluator({
    conditions,
    symbol,
    interval,
    direction,
    indicatorSignals,
    overrides: mapOverrides(localOverrides),
    enabled
  });
  const [showHelp, setShowHelp] = useState(false);
  const [showOrders, setShowOrders] = useState(false);
  const [constraints, setConstraints] = useState<MarketConstraints>({ pricePrecision: 2, quantityPrecision: 3, minNotional: 5, minQuantity: 0.001 });
  const [runtime, setRuntime] = useState<RuntimeAmounts>({ positionNotional: undefined, walletBalanceUSDT: undefined, initialBuyNotional: undefined });
  const [flags, setFlags] = useState<{ reduceOnly: boolean; workingType: 'MARK_PRICE' | 'CONTRACT_PRICE'; positionSide: 'AUTO' | 'BOTH' | 'LONG' | 'SHORT' }>({ reduceOnly: true, workingType: 'MARK_PRICE', positionSide: 'AUTO' });
  const [safety, setSafety] = useState<{ maxOrders: number; maxNotional: number }>({ maxOrders: 10, maxNotional: 100000 });
  const [pollSec, setPollSec] = useState<number>(15);
  const [serverPositionMode, setServerPositionMode] = useState<'one_way' | 'hedge' | undefined>(undefined);
  const [pollEnabled, setPollEnabled] = useState<boolean>(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | undefined>(undefined);
  const safetyRef = useRef<HTMLDivElement | null>(null);
  const planned = useMemo(() => {
    try {
      if (!conditions || !extras?.series || !context?.candleCurrent) return [] as any[];
      const numericSeries = buildIndicatorNumericSeries(conditions, extras.series);
      const intents = buildActionIntents(conditions, context, indicatorSignals ?? {}, numericSeries);
      const lastPrice = context.candleCurrent.close;
      // 최소주문단위 보정 여부는 capital.useMinNotionalFallback에 연동
      let useMin = true;
      try {
        const mod = require('@/stores/autoTradingSettingsStore');
        const st = mod.useAutoTradingSettingsStore?.getState?.();
        useMin = Boolean(st?.settings?.capital?.useMinNotionalFallback ?? true);
      } catch {}
      return materializeOrders(intents, constraints, lastPrice, runtime, { useMinNotionalFallback: useMin });
    } catch {
      return [] as any[];
    }
  }, [conditions, extras?.series, context?.candleCurrent, indicatorSignals, constraints, runtime]);
  const plannedWithFlags = useMemo(() => (
    planned.map((o: any) => {
      // action-level overrides from raw cfg
      const cfgRO = o?.raw?.reduceOnly;
      const cfgPS = o?.raw?.positionSide as any;
      const cfgWT = o?.raw?.workingType as any;
      const autoPos = (() => {
        if (o.side === 'STOPLOSS') return direction === 'long' ? 'LONG' : 'SHORT';
        if (o.side === 'BUY') return 'LONG';
        if (o.side === 'SELL') return 'SHORT';
        return 'BOTH';
      })();
      const posSide = flags.positionSide === 'AUTO' ? autoPos : flags.positionSide;
      return {
        ...o,
        reduceOnly: typeof cfgRO === 'boolean' ? cfgRO : (o.side !== 'BUY' ? flags.reduceOnly : o.reduceOnly),
        workingType: o.side === 'STOPLOSS' ? (cfgWT || flags.workingType) : o.workingType,
        positionSide: cfgPS || posSide
      };
    })
  ), [planned, flags, direction]);

  // 서버 포지션 모드 자동 조회(키가 없거나 실패해도 무시)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/trading/binance/position-mode');
        const json = await res.json();
        if (mounted && json?.ok && (json.positionMode === 'one_way' || json.positionMode === 'hedge')) {
          setServerPositionMode(json.positionMode);
        }
      } catch { /* noop */ }
    })();
    return () => { mounted = false; };
  }, []);

  // 계정/포지션 폴링: 스토어 연동(ON/OFF/간격)
  useEffect(() => {
    let alive = true;
    let cleanup: (() => void) | undefined;
    (async () => {
      const mod = await import('@/stores/accountStore');
      const { useAccountStore } = mod as any;
      const store = useAccountStore.getState();
      store.setIntervalSec(pollSec);
      if (pollEnabled) store.startPolling(symbol); else store.stopPolling();
      const unsub = useAccountStore.subscribe((s: any) => {
        if (!alive) return;
        setRuntime((r) => ({
          ...r,
          walletBalanceUSDT: s.walletUSDT ?? r.walletBalanceUSDT,
          positionNotional: s.positionNotionalUSDT ?? r.positionNotional
        }));
        setLastUpdatedAt(s.lastUpdated);
      });
      cleanup = () => { store.stopPolling(); unsub(); };
    })();
    return () => { alive = false; cleanup?.(); };
  }, [symbol, pollEnabled, pollSec]);
  const totalNotional = useMemo(() => plannedWithFlags.reduce((s: number, o: any) => s + (Number(o.notional) || 0), 0), [plannedWithFlags]);
  const [sendResult, setSendResult] = useState<{ dryRun?: boolean; results?: any[]; payloads?: any[]; error?: string } | null>(null);

  // Auto-fill constraints by symbol (Binance futures meta)
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        const res = await fetch('/api/trading/binance/futures-symbols');
        if (!res.ok) return;
        const json = await res.json();
        const arr = (json?.markets ?? []) as Array<{ symbol: string; base: string; quote: string; pricePrecision?: number | null; quantityPrecision?: number | null; minNotional?: number | null; minQty?: number | null }>;
        const norm = (s: string) => String(s || '').toUpperCase().replace(/[^A-Z]/g, '');
        const target = norm(symbol);
        const found = arr.find((m) => norm((m.base ?? '') + (m.quote ?? '')) === target || norm(m.symbol ?? '') === target);
        if (found && !aborted) {
          setConstraints((c) => ({
            pricePrecision: found.pricePrecision ?? c.pricePrecision ?? null,
            quantityPrecision: found.quantityPrecision ?? c.quantityPrecision ?? null,
            minNotional: found.minNotional ?? c.minNotional ?? null,
            minQuantity: found.minQty ?? c.minQuantity ?? null
          }));
        }
      } catch {}
    })();
    return () => { aborted = true; };
  }, [symbol]);

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 px-2 py-2 text-[11px] text-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${match ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
        <span className="text-zinc-400">프리뷰</span>
        <span className="text-zinc-200">{enabled ? (match ? '충족' : ready ? '불충족' : '대기') : '꺼짐'}</span>
        {lastEvaluatedAt ? <span className="text-zinc-500 hidden sm:inline">· {new Date(lastEvaluatedAt).toLocaleTimeString()}</span> : null}
        {/* Hedge mode/budget chips */}
        {(() => {
          try {
            const enabledHedge = settings?.hedgeActivation?.enabled;
            const hb = settings?.capital?.hedgeBudget;
            const fmt = (d: any) => {
              if (!d) return '-';
              if (d.mode === 'usdt') return `${d.asset ?? 'USDT'} ${d.amount ?? 0}`;
              if (d.mode === 'balance_percentage') return `${d.basis ?? 'wallet'} ${d.percentage ?? 0}%`;
              if (d.mode === 'per_symbol_percentage') return `${d.basis ?? 'wallet'} 종목당 ${d.percentage ?? 0}%`;
              if (d.mode === 'position_percent') return `포지션 ${d.percentage ?? 0}%`;
              if (d.mode === 'initial_percent') return `최초 ${d.percentage ?? 0}%`;
              if (d.mode === 'min_notional') return `최소주문단위`;
              return '-';
            };
            const jump = (key: string) => {
              try { window.dispatchEvent(new CustomEvent('jump-to-section', { detail: key })); } catch {}
            };
            return (
              <>
                <button type="button" onClick={() => jump('hedge')} className={`rounded border px-1 py-0.5 ${enabledHedge ? 'border-emerald-600/60 text-emerald-200' : 'border-zinc-700 text-zinc-400'}`}>헤지 {enabledHedge ? 'ON' : 'OFF'}</button>
                {hb ? (
                  <button type="button" onClick={() => jump('capital')} className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">
                    {hb.separateByDirection ? `롱 ${fmt(hb.long)} / 숏 ${fmt(hb.short)}` : `공통 ${fmt(hb.long)}`}
                  </button>
                ) : null}
              </>
            );
          } catch { return null; }
        })()}
        {/* Safety chips at top */}
        <button
          type="button"
          onClick={() => { setShowOrders(true); safetyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
          className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200"
          title="최대 주문수"
        >
          최대 {safety.maxOrders}건
        </button>
        <button
          type="button"
          onClick={() => { setShowOrders(true); safetyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
          className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200"
          title="1건 최대 금액"
        >
          1건 최대 {safety.maxNotional}
        </button>
        {extras?.metrics ? (
          <span className="text-zinc-500 hidden md:inline">· 평가 {extras.metrics.lastMs.toFixed(1)}ms (평균 {extras.metrics.avgMs.toFixed(1)}ms)</span>
        ) : null}
        {error ? <span className="text-rose-400">· {error}</span> : null}
        <button type="button" onClick={() => setShowDetails((v) => !v)} className="ml-auto rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
          {showDetails ? '간단히' : '자세히'}
        </button>
        <button type="button" onClick={() => setShowOrders((v) => !v)} className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
          {showOrders ? '주문 닫기' : '주문 미리보기'}
        </button>
        <button type="button" onClick={() => setShowHelp(true)} className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
          프리뷰 설명
        </button>
      </div>
      {/* 캔들 요약: OHLC/거래량/시간 */}
      {context?.candleCurrent ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-zinc-400">
          <span className="text-zinc-500">캔들</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">O {context.candleCurrent.open.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">H {context.candleCurrent.high.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">L {context.candleCurrent.low.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">C {context.candleCurrent.close.toFixed(4)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300 hidden sm:inline">VOL {Math.round(context.candleCurrent.volume).toLocaleString()}</span>
          {(() => {
            const ts = context.candleCurrent!.timestamp;
            const openAt = new Date(ts);
            const closeAt = new Date(ts + (intervalToMs as any)[interval]);
            return <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-500 hidden md:inline">{openAt.toLocaleTimeString()}~{closeAt.toLocaleTimeString()}</span>;
          })()}
          {context.candlePrevious ? (
            (() => {
              const prev = context.candlePrevious!.close;
              const cur = context.candleCurrent!.close;
              const pct = prev ? ((cur - prev) / prev) * 100 : 0;
              const cls = pct > 0 ? 'text-emerald-300' : pct < 0 ? 'text-rose-300' : 'text-zinc-300';
              return <span className={`rounded border border-zinc-700 px-1 py-0.5 ${cls}`}>전봉대비 {pct.toFixed(2)}%</span>;
            })()
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] text-zinc-400">
        <span>상태 가정값</span>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">수익률%</span>
          <input type="number" value={localOverrides.profitRatePct ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, profitRatePct: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-16 sm:w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">마진USDT</span>
          <input type="number" value={localOverrides.marginUSDT ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, marginUSDT: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-20 sm:w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">매수횟수</span>
          <input type="number" value={localOverrides.buyCount ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, buyCount: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-16 sm:w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
        <label className="flex items-center gap-1">
          <span className="text-zinc-500">경과일</span>
          <input type="number" value={localOverrides.entryAgeDays ?? ''} onChange={(e) => setLocalOverrides((o) => ({ ...o, entryAgeDays: e.target.value === '' ? undefined : Number(e.target.value) }))} className="w-16 sm:w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" />
        </label>
      </div>
      {extras?.dmi ? (
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-zinc-400">
          <span className="text-zinc-500">DMI</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">DI+ {extras.dmi.diPlus.toFixed(1)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">DI- {extras.dmi.diMinus.toFixed(1)}</span>
          <span className="rounded border border-zinc-700 px-1 py-0.5 text-zinc-300">ADX {extras.dmi.adx.toFixed(1)}</span>
        </div>
      ) : null}
      {enabled && showDetails && context ? (
        <ConditionsTrace conditions={conditions} context={context} indicatorSignals={indicatorSignals} seriesTail={extras?.series}
        />
      ) : null}
      {enabled && showOrders && context ? (
        <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-2">
          <div className="flex items-center justify-between text-[11px] text-zinc-400">
            <span className="text-zinc-400">주문 미리보기</span>
            <span className="text-zinc-500">last {context.candleCurrent?.close?.toFixed?.(4)}</span>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="text-zinc-400">거래소 제약</span>
              <label className="flex items-center gap-1"><span className="text-zinc-500">가격소수</span>
                <input type="number" className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={constraints.pricePrecision ?? ''}
                  onChange={(e) => setConstraints((c) => ({ ...c, pricePrecision: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">수량소수</span>
                <input type="number" className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={constraints.quantityPrecision ?? ''}
                  onChange={(e) => setConstraints((c) => ({ ...c, quantityPrecision: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">최소금액</span>
                <input type="number" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={constraints.minNotional ?? ''}
                  onChange={(e) => setConstraints((c) => ({ ...c, minNotional: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">최소수량</span>
                <input type="number" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={constraints.minQuantity ?? ''}
                  onChange={(e) => setConstraints((c) => ({ ...c, minQuantity: e.target.value === '' ? null : Number(e.target.value) }))}
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="text-zinc-400">런타임 기준</span>
              <label className="flex items-center gap-1"><span className="text-zinc-500">포지션금액</span>
                <input type="number" className="w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={runtime.positionNotional ?? ''}
                  onChange={(e) => setRuntime((r) => ({ ...r, positionNotional: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">지갑USDT</span>
                <input type="number" className="w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={runtime.walletBalanceUSDT ?? ''}
                  onChange={(e) => setRuntime((r) => ({ ...r, walletBalanceUSDT: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">최초매수</span>
                <input type="number" className="w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={runtime.initialBuyNotional ?? ''}
                  onChange={(e) => setRuntime((r) => ({ ...r, initialBuyNotional: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
              </label>
            </div>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="text-zinc-400">실행 옵션</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={flags.reduceOnly} onChange={(e) => setFlags((f) => ({ ...f, reduceOnly: e.target.checked }))} />
                <span className="text-zinc-500">reduceOnly(매도/스탑)</span>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-zinc-500">positionSide</span>
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={flags.positionSide} onChange={(e) => setFlags((f) => ({ ...f, positionSide: e.target.value as any }))}>
                  <option value="AUTO">AUTO({direction === 'long' ? 'LONG' : 'SHORT'})</option>
                  <option value="BOTH">BOTH</option>
                  <option value="LONG">LONG</option>
                  <option value="SHORT">SHORT</option>
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-zinc-500">workingType(스탑)</span>
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={flags.workingType} onChange={(e) => setFlags((f) => ({ ...f, workingType: e.target.value as any }))}>
                  <option value="MARK_PRICE">MARK</option>
                  <option value="CONTRACT_PRICE">CONTRACT</option>
                </select>
              </label>
          </div>
            <div ref={safetyRef} className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
              <span className="text-zinc-400">안전장치</span>
              <label className="flex items-center gap-1"><span className="text-zinc-500">최대 주문수</span>
                <input type="number" className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={safety.maxOrders}
                  onChange={(e) => setSafety((s) => ({ ...s, maxOrders: Math.max(1, Number(e.target.value) || 1) }))} />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">1건 최대금액</span>
                <input type="number" className="w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={safety.maxNotional}
                  onChange={(e) => setSafety((s) => ({ ...s, maxNotional: Math.max(1, Number(e.target.value) || 1) }))} />
              </label>
              <span className="text-zinc-500">합계 {totalNotional.toFixed(2)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
            <span className="text-zinc-400">계정 업데이트</span>
              <label className="flex items-center gap-1"><span className="text-zinc-500">폴링</span>
                <input type="checkbox" className="h-3 w-3 accent-emerald-500" checked={pollEnabled} onChange={(e) => setPollEnabled(e.target.checked)} />
              </label>
              <label className="flex items-center gap-1"><span className="text-zinc-500">간격</span>
                <select
                  className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                  value={pollSec}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 15;
                    setPollSec(v);
                    import('@/stores/accountStore').then(({ useAccountStore }) => useAccountStore.getState().setIntervalSec(v));
                  }}
                >
                  {[5, 15, 30, 60].map((s) => (
                    <option key={s} value={s}>{s}s</option>
                  ))}
                </select>
              </label>
              <span className="text-zinc-500">마지막 갱신: {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : '—'}</span>
              <span className="text-zinc-500">서버 모드: {serverPositionMode ? (serverPositionMode === 'one_way' ? 'One-Way' : 'Hedge') : '알 수 없음'}</span>
            </div>
            {(() => {
              try {
                const hb = settings?.capital?.hedgeBudget;
                const enabled = settings?.hedgeActivation?.enabled;
                if (!enabled || !hb) return null;
                const fmt = (d: any) => {
                  if (!d) return '-';
                  if (d.mode === 'usdt') return `${d.asset ?? 'USDT'} ${d.amount ?? 0}`;
                  if (d.mode === 'balance_percentage') return `${d.basis ?? 'wallet'} ${d.percentage ?? 0}%`;
                  if (d.mode === 'per_symbol_percentage') return `${d.basis ?? 'wallet'} 종목당 ${d.percentage ?? 0}%`;
                  if (d.mode === 'position_percent') return `포지션 ${d.percentage ?? 0}%`;
                  if (d.mode === 'initial_percent') return `최초 ${d.percentage ?? 0}%`;
                  if (d.mode === 'min_notional') return `최소주문단위`;
                  return '-';
                };
                return (
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-300">
                    <span className="text-zinc-400">헤지 금액</span>
                    {hb.separateByDirection ? (
                      <>
                        <span className="rounded border border-zinc-700 px-1 py-0.5">롱 {fmt(hb.long)}</span>
                        <span className="rounded border border-zinc-700 px-1 py-0.5">숏 {fmt(hb.short)}</span>
                      </>
                    ) : (
                      <span className="rounded border border-zinc-700 px-1 py-0.5">공통 {fmt(hb.long)}</span>
                    )}
                  </div>
                );
              } catch {
                return null;
              }
            })()}
          </div>
          {/* 포지션 모드 경고 */}
          {(() => {
            const anyBoth = plannedWithFlags.some((o: any) => (o.positionSide ?? 'BOTH') === 'BOTH');
            const anySide = plannedWithFlags.some((o: any) => (o.positionSide ?? 'BOTH') !== 'BOTH');
            const pm = (positionMode as ('one_way' | 'hedge' | undefined)) ?? serverPositionMode;
            if (pm === 'one_way' && anySide) {
              return <div className="rounded border border-amber-600/60 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-200">경고: 현재 포지션 모드는 One-Way입니다. positionSide LONG/SHORT 주문은 거부될 수 있습니다. BOTH 사용 또는 Hedge 모드로 전환하세요.</div>;
            }
            if (pm === 'hedge' && anyBoth) {
              return <div className="rounded border border-amber-600/60 bg-amber-900/20 px-2 py-1 text-[11px] text-amber-200">경고: Hedge 모드에서는 positionSide BOTH 주문 대신 LONG/SHORT을 지정하세요.</div>;
            }
            return null;
          })()}
          <div className="rounded border border-zinc-800">
            {plannedWithFlags.length === 0 ? (
              <div className="px-2 py-1 text-[11px] text-zinc-500">생성된 주문이 없습니다.</div>
            ) : (
              <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="px-2 py-1">종류</th>
                    <th className="px-2 py-1">타입</th>
                    <th className="px-2 py-1">가격</th>
                    <th className="px-2 py-1">수량</th>
                    <th className="px-2 py-1">금액</th>
                    <th className="px-2 py-1">옵션</th>
                    <th className="px-2 py-1">비고</th>
                  </tr>
                </thead>
                <tbody>
                  {plannedWithFlags.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-800">
                      <td className="px-2 py-1">{o.side}</td>
                      <td className="px-2 py-1">{o.type}</td>
                      <td className="px-2 py-1">{o.price ?? o.stopPrice ?? '-'}</td>
                      <td className="px-2 py-1">{o.quantity ?? '-'}</td>
                      <td className="px-2 py-1">{o.notional ?? '-'}</td>
                      <td className="px-2 py-1 text-zinc-500">{`${o.reduceOnly ? 'RO' : ''}${o.positionSide ? `/${o.positionSide}` : ''}${o.workingType ? `/${o.workingType}` : ''}`}</td>
                      <td className="px-2 py-1 text-zinc-500">{o.reason ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/trading/binance/account?symbol=${encodeURIComponent(symbol)}`);
                  if (res.ok) {
                    const json = await res.json();
                    const wallet = Number(json?.account?.walletUSDT ?? NaN);
                    const posNotional = Number(json?.account?.positionNotionalUSDT ?? NaN);
                    setRuntime((r) => ({
                      ...r,
                      walletBalanceUSDT: Number.isFinite(wallet) ? wallet : r.walletBalanceUSDT,
                      positionNotional: Number.isFinite(posNotional) ? posNotional : r.positionNotional
                    }));
                  }
                } catch {}
              }}
            >
              계정값 자동 채움(USDT/포지션금액)
            </button>
            <button
              type="button"
              className="rounded border border-emerald-600 px-2 py-0.5 text-[11px] text-emerald-300"
              onClick={async () => {
                try {
                  const res = await fetch('/api/trading/binance/place-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol, orders: plannedWithFlags, dryRun: true, safety, positionMode: positionMode ?? serverPositionMode, useMinNotionalFallback: Boolean(settings?.capital?.useMinNotionalFallback ?? true) })
                  });
                  const json = await res.json();
                  setSendResult(json);
                  alert(json?.ok ? '모의 전송 payload 생성 완료' : `오류: ${json?.error || 'unknown'}`);
                } catch (e) {
                  alert(`오류: ${e instanceof Error ? e.message : String(e)}`);
                }
              }}
            >
              모의 전송(로컬)
            </button>
            <button
              type="button"
              className="rounded border border-rose-600 px-2 py-0.5 text-[11px] text-rose-300"
              onClick={async () => {
                if (plannedWithFlags.length > safety.maxOrders) {
                  alert(`안전장치: 최대 주문수(${safety.maxOrders}) 초과`);
                  return;
                }
                const over = plannedWithFlags.find((o) => (Number(o.notional) || 0) > safety.maxNotional);
                if (over) {
                  alert(`안전장치: 1건 최대금액(${safety.maxNotional}) 초과 (${over.notional})`);
                  return;
                }
                if (!confirm('주의: 실주문을 전송합니다. 환경변수/API키가 설정되어 있어야 합니다. 계속하시겠습니까?')) return;
                try {
                  const res = await fetch('/api/trading/binance/place-order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ symbol, orders: plannedWithFlags, dryRun: false, safety, positionMode: positionMode ?? serverPositionMode, useMinNotionalFallback: Boolean(settings?.capital?.useMinNotionalFallback ?? true) })
                  });
                  const json = await res.json();
                  setSendResult(json);
                  alert(json?.ok ? '실주문 요청 전송 완료' : `오류: ${json?.error || 'unknown'}`);
                } catch (e) {
                  alert(`오류: ${e instanceof Error ? e.message : String(e)}`);
                }
              }}
            >
              실행(실전)
            </button>
          </div>
          {sendResult ? (
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300">
              <div className="mb-1 text-zinc-400">전송 결과{sendResult.dryRun ? ' (모의)' : ''}</div>
              {sendResult.error ? (
                <div className="text-rose-400">{sendResult.error}</div>
              ) : sendResult.results ? (
                <ul className="space-y-1">
              {sendResult.safety ? (
                <div className="mb-1 text-[11px] text-zinc-400">
                  안전장치: 주문 {sendResult.safety.orderCount ?? '-'} / 최대 {sendResult.safety.maxOrders ?? '-'} · 위반 {Array.isArray(sendResult.safety.violations) ? sendResult.safety.violations.length : 0}건 · 1건 최대 {sendResult.safety.maxNotional ?? '-'} · 보정 {sendResult.safety.useMinNotionalFallback ? 'ON' : 'OFF'}
                </div>
              ) : null}
              {sendResult.results.map((r: any, idx: number) => (
                <li key={idx} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                  <span className="truncate text-zinc-300">{r.request?.type} {r.request?.side} {r.request?.quantity ?? '-'} @ {r.request?.price ?? r.request?.stopPrice ?? '-'}</span>
                  <div className="flex items-center gap-2">
                    <StatusLabel r={r} />
                    {r.adjustReason || r.request?._adjustReason ? (
                      <span className="rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300" title="최소주문단위 보정 적용">minN</span>
                    ) : null}
                    {(() => {
                      try {
                        const violated = Array.isArray(sendResult.safety?.violations) && sendResult.safety.violations.some((v: any) => v?.index === idx);
                        return violated ? <span className="rounded border border-rose-600 px-1 py-0.5 text-[10px] text-rose-300" title="1건 최대 금액 위반">maxN</span> : null;
                      } catch { return null; }
                    })()}
                    {!r.ok ? (
                      <>
                        <button className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300" onClick={async () => {
                          try {
                            const res = await fetch('/api/trading/binance/place-order', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ symbol, payloads: [r.request], dryRun: true, safety, positionMode: positionMode ?? serverPositionMode, useMinNotionalFallback: Boolean(settings?.capital?.useMinNotionalFallback ?? true) })
                            });
                            const json = await res.json();
                            setSendResult(json);
                          } catch (e) {
                            alert(`오류: ${e instanceof Error ? e.message : String(e)}`);
                          }
                        }}>재시도(모의)</button>
                        <button className="rounded border border-rose-600 px-1.5 py-0.5 text-[10px] text-rose-300" onClick={async () => {
                          if (!confirm('해당 주문을 실전으로 재시도하시겠습니까?')) return;
                          try {
                            const res = await fetch('/api/trading/binance/place-order', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ symbol, payloads: [r.request], dryRun: false, safety, positionMode: positionMode ?? serverPositionMode, useMinNotionalFallback: Boolean(settings?.capital?.useMinNotionalFallback ?? true) })
                            });
                            const json = await res.json();
                            setSendResult(json);
                          } catch (e) {
                            alert(`오류: ${e instanceof Error ? e.message : String(e)}`);
                          }
                        }}>재시도(실전)</button>
                      </>
                    ) : null}
                  </div>
                </li>
              ))}
                </ul>
              ) : sendResult.payloads ? (
                <div className="text-zinc-500">payloads {sendResult.payloads.length}건 생성됨</div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {showHelp ? (
        <PreviewHelp onClose={() => setShowHelp(false)} />
      ) : null}
    </div>
  );
}

function PreviewHelp({ onClose }: { onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,680px)] rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-[12px] text-zinc-300 shadow-xl">
        <header className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">프리뷰 사용법</h3>
          <button onClick={onClose} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">닫기</button>
        </header>
        <ul className="list-disc space-y-1 pl-5">
          <li>프리뷰는 실시간 캔들을 구독하고, 현재 조건을 평가하여 충족 여부를 표시합니다.</li>
          <li>심볼/쿼트를 입력하고 ‘지표 신호 가정(ON)’을 설정하면 과거 신호 계산 없이 가정값으로 빠르게 확인할 수 있습니다.</li>
          <li>상태 가정값(수익률/마진/매수횟수/경과일)을 입력해 현재 포지션 상태를 가정하여 조건을 검증하세요.</li>
          <li>‘자세히’를 누르면 트레이스가 열리고, 지표/상태/캔들 노드별 통과 여부와 현재 값이 표시됩니다.</li>
          <li>작은 화면에서는 시간/평가 메트릭이 숨겨집니다. 자세한 값은 ‘자세히’에서 확인하세요.</li>
        </ul>
        <p className="mt-2 text-zinc-400">프리뷰는 참고용 도구이며, 거래 실행 전 실제 데이터와 백엔드 검증을 함께 사용하세요.</p>
      </div>
    </div>
  );
}

function mapOverrides(src?: Partial<{ profitRatePct: number; marginUSDT: number; marginUSDC: number; buyCount: number; entryAgeDays: number }>) {
  if (!src) return {} as any;
  const margin =
    typeof src.marginUSDT === 'number'
      ? ({ asset: 'USDT', value: src.marginUSDT } as const)
      : typeof src.marginUSDC === 'number'
      ? ({ asset: 'USDC', value: src.marginUSDC } as const)
      : undefined;
  return {
    profitRatePct: src.profitRatePct,
    margin,
    buyCount: src.buyCount,
    entryAgeDays: src.entryAgeDays
  };
}

function StatusLabel({ r }: { r: any }) {
  const info = r?.code ? ERROR_HELP[r.code as string] : undefined;
  const label = r?.ok ? 'OK' : (info?.label || r?.code || 'ERR');
  const title = info ? (r?.hint ? `${info.label} — ${r.hint}` : info.label) : (r?.hint || r?.error || '');
  const className = r?.ok ? 'text-emerald-300' : 'text-rose-400';
  if (!r?.ok && r?.code) {
    const href = `/docs/errors#${encodeURIComponent(r.code)}`;
    return <a className={className + ' underline underline-offset-2'} href={href} target="_blank" rel="noreferrer" title={title}>{label}</a>;
  }
  return <span className={className} title={title}>{label}</span>;
}
