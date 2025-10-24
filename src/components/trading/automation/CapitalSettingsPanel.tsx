"use client";

import { useEffect, useMemo, useState } from 'react';
import type { CapitalSettings, MarginBasis } from '@/types/trading/auto-trading';
import { Segmented } from '@/components/common/Segmented';
import { HelpModal } from '@/components/common/HelpModal';
import { InfoTip } from '@/components/common/InfoTip';

export function CapitalSettingsPanel({ capital, symbolCount, manualSymbols, leverage = 1, onChange, quoteFromSymbols }: { capital: CapitalSettings; symbolCount: number; manualSymbols?: string[]; leverage?: number; onChange: (next: CapitalSettings) => void; quoteFromSymbols?: 'USDT' | 'USDC' }) {
  const [balances, setBalances] = useState<{ wallet?: number; total?: number; free?: number }>({});
  const [cred, setCred] = useState<{ ok?: boolean; hasKey?: boolean } | null>(null);
  const [loadingBal, setLoadingBal] = useState(false);
  const quote = (quoteFromSymbols ?? capital.initialMargin.asset ?? 'USDT') as 'USDT' | 'USDC';
  const [minNotionalHint, setMinNotionalHint] = useState<number | null>(null);
  const [calcBasis, setCalcBasis] = useState<'estimated'|'wallet'|'total'|'free'>('estimated');
  const [marketsMeta, setMarketsMeta] = useState<Array<any>>([]);
  const [showInitialMinModal, setShowInitialMinModal] = useState(false);
  const [showScaleMinModal, setShowScaleMinModal] = useState(false);
  const [showBalancePickModal, setShowBalancePickModal] = useState(false);
  const [showExceptions, setShowExceptions] = useState(false);
  const [fetchedBalances, setFetchedBalances] = useState<{ wallet?: number | null; total?: number | null; free?: number | null } | null>(null);
  const renderMinNotionalTable = (kind: 'initial' | 'scale') => {
    const norm = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const list = Array.isArray(manualSymbols) ? manualSymbols : [];
    const wanted = new Set(list.map((s) => {
      const n = norm(s);
      return n.endsWith(quote) ? n : `${n}${quote}`;
    }));
    const rows = marketsMeta
      .filter((m) => wanted.has(String(m?.symbol || '').toUpperCase()))
      .map((m) => {
        const minNotional = Number(m?.minNotional ?? 0) || 0;
        const walletUse = minNotional / Math.max(1, Number(leverage) || 1);
        const pricePrecision = Number(m?.pricePrecision ?? NaN);
        const quantityPrecision = Number(m?.quantityPrecision ?? NaN);
        const priceTick = Number.isFinite(pricePrecision) ? Math.pow(10, -pricePrecision) : null;
        const qtyStep = Number.isFinite(quantityPrecision) ? Math.pow(10, -quantityPrecision) : null;
        const tiers = Array.isArray(m?.leverageBrackets) ? (m.leverageBrackets as Array<any>) : [];
        const maxLev = tiers.reduce((acc, t) => Math.max(acc, Number(t?.maxLeverage ?? 0) || 0), 0) || null;
        return {
          symbol: String(m.symbol).toUpperCase(),
          minNotional,
          walletUse,
          priceTick,
          qtyStep,
          maxLeverage: maxLev
        };
      })
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    const totalMin = rows.reduce((s, r) => s + (r.minNotional || 0), 0);
    const totalWallet = rows.reduce((s, r) => s + (r.walletUse || 0), 0);
    const recommended = rows.reduce((mx, r) => Math.max(mx, r.minNotional || 0), 0);
    return (
      <div>
        <table className="w-full table-fixed text-left text-[12px]">
          <thead className="text-zinc-400">
            <tr>
              <th className="px-2 py-1">심볼</th>
              <th className="px-2 py-1">최소 주문</th>
              <th className="px-2 py-1">지갑 사용액(/{quote})</th>
              <th className="px-2 py-1">최대 레버리지</th>
              <th className="px-2 py-1">가격 틱</th>
              <th className="px-2 py-1">수량 스텝</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <tr key={r.symbol}>
                <td className="px-2 py-1 text-zinc-200">{r.symbol}</td>
                <td className="px-2 py-1">{fmt(r.minNotional)}</td>
                <td className="px-2 py-1">{fmt(r.walletUse)}</td>
                <td className="px-2 py-1">{r.maxLeverage ?? '-'}</td>
                <td className="px-2 py-1">{r.priceTick != null ? r.priceTick.toExponential() : '-'}</td>
                <td className="px-2 py-1">{r.qtyStep != null ? r.qtyStep.toExponential() : '-'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-zinc-800 text-zinc-300">
            <tr>
              <td className="px-2 py-1">합계</td>
              <td className="px-2 py-1">{fmt(totalMin)}</td>
              <td className="px-2 py-1">{fmt(totalWallet)}</td>
              <td className="px-2 py-1" colSpan={3} />
            </tr>
          </tfoot>
        </table>
        <p className="mt-2 text-[11px] text-zinc-500">지갑 사용액 = 최소 주문 금액 ÷ 레버리지</p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-emerald-600 px-2 py-0.5 text-[12px] text-emerald-300"
            onClick={() => {
              if (kind === 'initial') setIM({ minNotional: Number(recommended) || 0 });
              else setSIB({ minNotional: Number(recommended) || 0 });
              if (kind === 'initial') setShowInitialMinModal(false); else setShowScaleMinModal(false);
            }}
          >
            {kind === 'initial' ? '초기값에 일괄 적용' : '추매값에 일괄 적용'}
          </button>
          <span className="text-[11px] text-zinc-400">추천: {fmt(recommended)} {quote}</span>
        </div>
      </div>
    );
  };

  useEffect(() => {
    // 사전 자격 확인 (선택사항)
    (async () => {
      try {
        const res = await fetch('/api/profile/credentials');
        if (!res.ok) return setCred({ ok: false, hasKey: false });
        const js = await res.json();
        const has = Boolean(js?.hasBinanceApiKey && js?.hasBinanceApiSecret);
        setCred({ ok: true, hasKey: has });
      } catch {
        setCred({ ok: false, hasKey: false });
      }
    })();
  }, []);

  // Compute recommended minNotional across selected manual symbols for current quote
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = Array.isArray(manualSymbols) ? manualSymbols : [];
        if (list.length === 0) { setMinNotionalHint(null); return; }
        const res = await fetch('/api/trading/binance/futures-symbols');
        if (!res.ok) { setMinNotionalHint(null); return; }
        const js = await res.json();
        const markets: Array<any> = Array.isArray(js?.markets) ? js.markets : [];
        setMarketsMeta(markets);
        const norm = (s: string) => s.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const wanted = new Set(list.map((s) => {
          const n = norm(s);
          return n.endsWith(quote) ? n : `${n}${quote}`;
        }));
        let maxMin: number | null = null;
        for (const m of markets) {
          try {
            const sym = String(m?.symbol || '').toUpperCase();
            if (!wanted.has(sym)) continue;
            const val = Number(m?.minNotional);
            if (Number.isFinite(val)) maxMin = maxMin == null ? val : Math.max(maxMin, val);
          } catch {}
        }
        if (!cancelled) setMinNotionalHint(maxMin);
      } catch {
        if (!cancelled) setMinNotionalHint(null);
      }
    })();
    return () => { cancelled = true; };
  }, [manualSymbols, quote]);

  const set = (patch: Partial<CapitalSettings>) => onChange({ ...capital, ...patch });
  const setIM = (patch: Partial<CapitalSettings['initialMargin']>) => set({ initialMargin: { ...capital.initialMargin, ...patch } });
  const setSIB = (patch: Partial<CapitalSettings['scaleInBudget']>) => set({ scaleInBudget: { ...capital.scaleInBudget, ...patch } });
  const setLimit = (patch: Partial<CapitalSettings['scaleInLimit']>) => set({ scaleInLimit: { ...capital.scaleInLimit, ...patch } as any });
  const setMM = (patch: Partial<CapitalSettings['maxMargin']>) => set({ maxMargin: { ...capital.maxMargin, ...patch } });
  const [autoRescale, setAutoRescale] = useState<boolean>(Boolean((capital as any).autoRescale));
  const [preserveRatio, setPreserveRatio] = useState<boolean>(Boolean((capital as any).preserveRatio));

  // 외부(종목 선택)의 쿼트를 따라가도록 동기화 (자산 통일)
  useEffect(() => {
    if (!quoteFromSymbols) return;
    setIM({ asset: quoteFromSymbols });
    setSIB({ asset: quoteFromSymbols });
  }, [quoteFromSymbols]);

  const basisAmount = (basis: MarginBasis, perSymbol: boolean) => {
    // Calculation source priority: user-chosen calcBasis
    let baseVal: number | undefined;
    if (calcBasis === 'estimated') {
      baseVal = capital.estimatedBalance;
    } else if (calcBasis === 'wallet') {
      baseVal = balances.wallet;
    } else if (calcBasis === 'total') {
      baseVal = balances.total;
    } else if (calcBasis === 'free') {
      baseVal = balances.free;
    }
    // Fallback to basis-specific value if calcBasis unavailable
    const b = (baseVal ?? (
      basis === 'wallet' ? (balances.wallet ?? capital.estimatedBalance) :
      basis === 'total' ? (balances.total ?? capital.estimatedBalance) :
      (balances.free ?? capital.estimatedBalance)
    ));
    const base = perSymbol ? (b / Math.max(1, symbolCount)) : b;
    return base;
  };

  const expectedInitial = (() => {
    const im = capital.initialMargin;
    if (im.mode === 'usdt_amount') return im.usdtAmount;
    if (im.mode === 'min_notional') return im.minNotional;
    if (im.mode === 'per_symbol_percentage') return basisAmount(im.basis, true) * (im.percentage / 100);
    if (im.mode === 'all_symbols_percentage') return basisAmount(im.basis, false) * (im.percentage / 100);
    return 0;
  })();

  const expectedScale = (() => {
    const b = capital.scaleInBudget;
    if (b.mode === 'usdt_amount') return b.usdtAmount ?? 0;
    if (b.mode === 'min_notional') return b.minNotional;
    if (b.mode === 'balance_percentage') return basisAmount(b.basis, false) * (b.percentage / 100);
    if (b.mode === 'per_symbol_percentage') return basisAmount(b.basis, true) * (b.percentage / 100);
    return 0;
  })();

  // Per-symbol and total expected amounts (cards)
  const initialPerSymbol = useMemo(() => {
    const im = capital.initialMargin;
    if (im.mode === 'usdt_amount') return im.usdtAmount ?? 0;
    if (im.mode === 'min_notional') return im.minNotional ?? 0;
    if (im.mode === 'per_symbol_percentage') return basisAmount(im.basis, true) * ((im.percentage ?? 0) / 100);
    if (im.mode === 'all_symbols_percentage') {
      const total = basisAmount(im.basis, false) * ((im.percentage ?? 0) / 100);
      return total / Math.max(1, symbolCount);
    }
    return 0;
  }, [capital.initialMargin, balances, symbolCount]);
  const initialTotal = initialPerSymbol * Math.max(1, symbolCount);
  const scalePerSymbol = useMemo(() => {
    const sb = capital.scaleInBudget;
    if (sb.mode === 'usdt_amount') return (sb.usdtAmount ?? 0) / Math.max(1, symbolCount);
    if (sb.mode === 'min_notional') return sb.minNotional ?? 0;
    if (sb.mode === 'per_symbol_percentage') return basisAmount(sb.basis, true) * ((sb.percentage ?? 0) / 100);
    if (sb.mode === 'balance_percentage') {
      const total = basisAmount(sb.basis, false) * ((sb.percentage ?? 0) / 100);
      return total / Math.max(1, symbolCount);
    }
    return 0;
  }, [capital.scaleInBudget, balances, symbolCount]);
  const scaleTotal = useMemo(() => {
    const sb = capital.scaleInBudget;
    if (sb.mode === 'usdt_amount') return sb.usdtAmount ?? 0;
    if (sb.mode === 'min_notional') return (sb.minNotional ?? 0) * Math.max(1, symbolCount);
    if (sb.mode === 'per_symbol_percentage') return scalePerSymbol * Math.max(1, symbolCount);
    if (sb.mode === 'balance_percentage') return basisAmount(sb.basis, false) * ((sb.percentage ?? 0) / 100);
    if (sb.mode === 'position_percent') return initialTotal * ((sb.percentage ?? 0) / 100);
    return 0;
  }, [capital.scaleInBudget, balances, symbolCount, scalePerSymbol]);
  // Budget vs limit snapshot
  const maxBudget = useMemo(() => {
    const baseTotal = basisAmount(capital.maxMargin.basis, false);
    return baseTotal * ((capital.maxMargin.percentage ?? 0) / 100);
  }, [capital.maxMargin.basis, capital.maxMargin.percentage, balances, symbolCount]);
  const totalUsed = initialTotal + scaleTotal;

  const invalidClass = (bad: boolean) => (bad ? 'border-rose-600' : 'border-zinc-700');

  // Percent estimates for allocation bar (all relative to maxMargin.basis)
  const barBasis = capital.maxMargin?.basis ?? 'wallet';
  const barBaseTotal = basisAmount(barBasis as MarginBasis, false);
  const initialPct = useMemo(() => {
    const amount = Number(initialTotal) || 0;
    return barBaseTotal > 0 ? (amount / barBaseTotal) * 100 : 0;
  }, [initialTotal, barBaseTotal]);
  const scalePct = useMemo(() => {
    const amount = Number(scaleTotal) || 0;
    return barBaseTotal > 0 ? (amount / barBaseTotal) * 100 : 0;
  }, [scaleTotal, barBaseTotal]);
  const maxPct = Math.max(0, Math.min(100, capital.maxMargin.percentage ?? 0));
  const usedPct = Math.max(0, Math.min(maxPct, initialPct + scalePct));
  const leftoverPct = Math.max(0, maxPct - usedPct);
  const iNorm = maxPct > 0 ? (Math.max(0, Math.min(initialPct, maxPct)) / maxPct) * 100 : 0;
  const sNorm = maxPct > 0 ? (Math.max(0, Math.min(scalePct, Math.max(0, maxPct - Math.min(initialPct, maxPct)))) / maxPct) * 100 : 0;
  const lNorm = Math.max(0, 100 - iNorm - sNorm);

  // Auto clip to maxBudget on limit changes when preserveRatio is enabled
  const [rescalingNonce, setRescalingNonce] = useState(0);
  useEffect(() => {
    if (!preserveRatio) return;
    const baseTotal = basisAmount(capital.maxMargin.basis, false);
    const maxBudget = (baseTotal * capital.maxMargin.percentage) / 100;
    const used = initialTotal + scaleTotal;
    if (used > maxBudget + 1e-8 && used > 0) {
      const k = maxBudget / used;
      const count = Math.max(1, symbolCount || 1);

      const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
      const round2 = (v: number) => Math.round(v * 100) / 100;

      const newInitialTotal = initialTotal * k;
      const newScaleTotal = scaleTotal * k;

      const im = { ...capital.initialMargin } as any;
      if (im.mode === 'usdt_amount') im.usdtAmount = round2(newInitialTotal);
      else if (im.mode === 'min_notional') im.minNotional = round2(newInitialTotal / count);
      else if (im.mode === 'per_symbol_percentage') {
        const perBase = basisAmount(im.basis ?? capital.maxMargin.basis, true);
        im.percentage = clampPct((newInitialTotal / count / Math.max(1e-9, perBase)) * 100);
      } else if (im.mode === 'all_symbols_percentage') {
        const totBase = basisAmount(im.basis ?? capital.maxMargin.basis, false);
        im.percentage = clampPct((newInitialTotal / Math.max(1e-9, totBase)) * 100);
      }

      const sb = { ...capital.scaleInBudget } as any;
      if (sb.mode === 'usdt_amount') sb.usdtAmount = round2(newScaleTotal);
      else if (sb.mode === 'min_notional') sb.minNotional = round2(newScaleTotal / count);
      else if (sb.mode === 'per_symbol_percentage') {
        const perBase = basisAmount(sb.basis ?? capital.maxMargin.basis, true);
        sb.percentage = clampPct((newScaleTotal / count / Math.max(1e-9, perBase)) * 100);
      } else if (sb.mode === 'balance_percentage') {
        const totBase = basisAmount(sb.basis ?? capital.maxMargin.basis, false);
        sb.percentage = clampPct((newScaleTotal / Math.max(1e-9, totBase)) * 100);
      }

      onChange({ ...(capital as any), initialMargin: im, scaleInBudget: sb } as any);
      setRescalingNonce((x) => x + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capital.maxMargin.percentage, capital.maxMargin.basis]);


  return (
    <div className="space-y-3 text-xs text-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        {!quoteFromSymbols ? (
          <>
            <span className="text-zinc-400">쿼트구분</span>
            <select className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={quote} onChange={(e) => { setIM({ asset: e.target.value as any }); setSIB({ asset: e.target.value as any }); }}>
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          </>
        ) : (
          <span className="rounded border border-zinc-700 px-2 py-1 text-zinc-300">쿼트: {quoteFromSymbols}</span>
        )}
        <span className="ml-3 text-zinc-400">투자 금액</span>
        <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.estimatedBalance}
          onChange={(e) => set({ estimatedBalance: Math.max(0, Number(e.target.value) || 0) })} />
        <button
          type="button"
          disabled={loadingBal}
          className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 disabled:opacity-50"
          onClick={async () => {
            try {
              setLoadingBal(true);
              // API Key 확인
              const credRes = await fetch('/api/profile/credentials');
              if (!credRes.ok) { setCred({ ok: false, hasKey: false }); return; }
              const cj = await credRes.json();
              const has = Boolean(cj?.hasBinanceApiKey && cj?.hasBinanceApiSecret);
              setCred({ ok: true, hasKey: has });
              if (!has) return;
              const symbol = quote === 'USDT' ? 'BTCUSDT' : 'BTCUSDC';
              const res = await fetch(`/api/trading/binance/account?symbol=${symbol}`);
              if (!res.ok) {
                try {
                  const js = await res.json();
                  // optional toast, if provider exists
                  // dynamic import avoided; this panel may be used without ToastProvider
                  console.warn('잔고 조회 실패', js);
                } catch {}
                return;
              }
              const json = await res.json();
              const key = (k: string) => `${k}${quote}`;
              setBalances({ wallet: Number(json?.account?.[key('wallet')] ?? NaN), total: Number(json?.account?.[key('total')] ?? NaN), free: Number(json?.account?.[key('free')] ?? NaN) });
              setFetchedBalances({ wallet: Number(json?.account?.[key('wallet')] ?? NaN), total: Number(json?.account?.[key('total')] ?? NaN), free: Number(json?.account?.[key('free')] ?? NaN) });
              setShowBalancePickModal(true);
            } catch {
              // ignore
            } finally {
              setLoadingBal(false);
            }
          }}
        >
          {loadingBal ? '조회 중…' : '잔고 조회'}
        </button>
        <span className="text-zinc-500">Wallet {fmt(balances.wallet)} · Total {fmt(balances.total)} · Free {fmt(balances.free)}</span>
        <span className="ml-3 text-zinc-400">계산 기준</span>
        <Segmented
          ariaLabel="calculation basis"
          value={calcBasis}
          onChange={(v) => setCalcBasis(v as any)}
          options={[
            { label: '입력값', value: 'estimated' },
            { label: 'Wallet', value: 'wallet' },
            { label: 'Total', value: 'total' },
            { label: 'Free', value: 'free' }
          ]}
        />
        {cred && cred.ok && cred.hasKey === false ? (
          <span className="ml-2 rounded border border-amber-600/60 bg-amber-900/30 px-2 py-0.5 text-amber-200">API Key/Secret 미등록 · 마이페이지에서 등록하세요.</span>
        ) : null}
     </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-4 w-4" checked={Boolean(capital.useMinNotionalFallback)} onChange={(e) => set({ useMinNotionalFallback: e.target.checked })} />
        <span>최소 주문단위 이하 주문 시 최소 주문단위 사용</span>
      </label>

      <div id="initial-settings" className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 font-medium text-zinc-100">최초 매수 금액 설정</div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <div className="space-y-2">
              <Segmented
                ariaLabel="initial margin mode"
                value={capital.initialMargin.mode}
                onChange={(v) => setIM({ mode: v as any })}
                options={[
                  { label: '직접 입력', value: 'usdt_amount' },
                  { label: '잔고(총)', value: 'all_symbols_percentage' },
                  { label: '잔고(종목당)', value: 'per_symbol_percentage' },
                  { label: '최소 주문', value: 'min_notional' }
                ]}
              />
              {capital.initialMargin.mode==='usdt_amount' ? (
                <div className="flex items-center gap-2 pl-5">
                  {!quoteFromSymbols ? (
                    <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.initialMargin.asset ?? 'USDT'} onChange={(e) => setIM({ asset: e.target.value as any })}>
                      <option value="USDT">USDT</option>
                      <option value="USDC">USDC</option>
                    </select>
                  ) : null}
                  <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.initialMargin.usdtAmount}
                    onChange={(e) => setIM({ usdtAmount: Math.max(0, Number(e.target.value) || 0) })} />
                  {String(capital.initialMargin.asset ?? 'USDT') !== String(quote) ? (
                    <span className="text-rose-400 text-[11px]">쿼트({quote})와 동일한 통화로 입력하세요.</span>
                  ) : null}
                </div>
              ) : null}

              {capital.initialMargin.mode==='all_symbols_percentage' ? (
                <div className="flex items-center gap-2 pl-5">
                  <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.initialMargin.basis} onChange={(e) => setIM({ basis: e.target.value as MarginBasis })}>
                    <option value="wallet">Wallet</option>
                    <option value="total">Total</option>
                    <option value="free">Free</option>
                  </select>
                  <input type="number" min={0.01} max={100} step={0.01} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                    value={capital.initialMargin.percentage}
                    onChange={(e) => setIM({ percentage: clampPctNum(e.currentTarget.value) })}
                  />
                  <span className="text-zinc-500">예상 {fmt(expectedFrom(capital.initialMargin.basis, false, capital.initialMargin.percentage, balances, capital.estimatedBalance, symbolCount))}</span>
                </div>
              ) : null}

              {capital.initialMargin.mode==='per_symbol_percentage' ? (
                <div className="flex items-center gap-2 pl-5">
                  <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.initialMargin.basis} onChange={(e) => setIM({ basis: e.target.value as MarginBasis })}>
                    <option value="wallet">Wallet</option>
                    <option value="total">Total</option>
                    <option value="free">Free</option>
                  </select>
                  <input type="number" min={0.01} max={100} step={0.01} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                    value={capital.initialMargin.percentage}
                    onChange={(e) => setIM({ percentage: clampPctNum(e.currentTarget.value) })}
                  />
                  <span className="text-zinc-500">예상 {fmt(expectedFrom(capital.initialMargin.basis, true, capital.initialMargin.percentage, balances, capital.estimatedBalance, symbolCount))}</span>
                </div>
              ) : null}

              {capital.initialMargin.mode==='min_notional' ? (
                <div className="pl-5 text-zinc-500">
                  심볼별 최소 주문 금액을 사용합니다.
                  {minNotionalHint != null ? (
                    <>
                      <span className="ml-2 text-zinc-400">추천 {fmt(minNotionalHint)}</span>
                      <button
                        type="button"
                        className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
                        onClick={() => setIM({ minNotional: Number(minNotionalHint) || 0 })}
                      >
                        적용
                      </button>
                      <button
                        type="button"
                        className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
                        onClick={() => setShowInitialMinModal(true)}
                      >
                        예상주문금액 확인
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-zinc-400">예상 최초 매수 금액: <span className="text-zinc-200">{fmt(expectedInitial)}</span> {capital.initialMargin.asset ?? 'USDT'}</div>
            <div className="text-zinc-500 text-[11px]">레버리지 {leverage}x 기준 지갑 사용액 ≈ {fmt(Number(expectedInitial) / Math.max(1, Number(leverage) || 1))} {capital.initialMargin.asset ?? 'USDT'}</div>
            <div className="text-zinc-400">예상 추가 매수 예산: <span className="text-zinc-200">{fmt(expectedScale)}</span> {capital.scaleInBudget.asset ?? 'USDT'}</div>
            <p className="text-zinc-500">종목당 기준은 총잔고를 종목 수({symbolCount})로 나눈 값에 비율을 적용합니다.</p>
          </div>
        </div>
      </div>

      {/* Global basis + max limit controls (slider only for clarity) */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <span className="text-zinc-400">기준</span>
        <Segmented
          ariaLabel="max margin basis"
          value={capital.maxMargin.basis}
          onChange={(v) => setMM({ basis: v as MarginBasis })}
          options={[
            { label: 'Wallet', value: 'wallet' },
            { label: 'Total', value: 'total' },
            { label: 'Free', value: 'free' }
          ]}
        />
        <span className="ml-2 text-zinc-400">최대 투자 한도 <InfoTip title="선택한 기준(Wallet/Total/Free)의 총액 대비 한도 비율입니다." /></span>
        <input
          type="range"
          min={0}
          max={100}
          step={0.01}
          value={capital.maxMargin.percentage}
          onChange={(e) => setMM({ percentage: Math.max(0, Math.min(100, Number(e.currentTarget.value) || 0)) })}
          className="h-1 w-64 cursor-pointer"
          aria-label="max margin percent slider"
        />
        <span className="text-zinc-400 text-[12px]">{fmtPct(capital.maxMargin.percentage)}</span>
        <span className="text-zinc-500 text-[12px]">
          적용 금액 ≈ {fmt(basisAmount(capital.maxMargin.basis, false) * ((capital.maxMargin.percentage ?? 0) / 100))} {quote}
        </span>
      </div>

      {/* Allocation bar and per-symbol cards removed to reduce duplication */}

      <div id="scale-settings" className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 font-medium text-zinc-100">추가 매수 금액 설정</div>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Left: 금액 설정 */}
          <div className="space-y-2">
            <Segmented
              ariaLabel="scale-in budget mode"
              value={capital.scaleInBudget.mode}
              onChange={(v) => setSIB({ mode: v as any })}
              options={[
                { label: '직접 입력', value: 'usdt_amount' },
                { label: '잔고 비율', value: 'balance_percentage' },
                { label: '종목당 비율', value: 'per_symbol_percentage' },
                { label: '현재 매수기준%', value: 'position_percent' },
                { label: '최소 주문', value: 'min_notional' }
              ]}
            />
            <div className="text-[11px] text-zinc-500">
              <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">예상 추매 {fmt(scaleTotal)} / 한도 {fmt(maxBudget)} {quote}</span>
            </div>
            {capital.scaleInBudget.mode==='usdt_amount' ? (
              <div className="flex items-center gap-2 pl-5">
                {!quoteFromSymbols ? (
                  <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInBudget.asset ?? 'USDT'} onChange={(e) => setSIB({ asset: e.target.value as any })}>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                ) : null}
                <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.scaleInBudget.usdtAmount ?? 0}
                  onChange={(e) => setSIB({ usdtAmount: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
            ) : null}
            {capital.scaleInBudget.mode==='balance_percentage' ? (
              <div className="flex items-center gap-2 pl-5">
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInBudget.basis} onChange={(e) => setSIB({ basis: e.target.value as MarginBasis })}>
                  <option value="wallet">Wallet</option>
                  <option value="total">Total</option>
                  <option value="free">Free</option>
                </select>
                <input type="number" min={0.01} max={100} step={0.01} className={`w-24 rounded bg-zinc-900 px-2 py-1 ${invalidClass(!(capital.scaleInBudget.percentage > 0 && capital.scaleInBudget.percentage <= 100))}`}
                  value={capital.scaleInBudget.percentage}
                  onChange={(e) => setSIB({ percentage: clampPctNum(e.currentTarget.value) })}
                />
                <span className="text-zinc-500">예상 {fmt(expectedScale)}</span>
              </div>
            ) : null}
            {capital.scaleInBudget.mode==='per_symbol_percentage' ? (
              <div className="flex items-center gap-2 pl-5">
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInBudget.basis} onChange={(e) => setSIB({ basis: e.target.value as MarginBasis })}>
                  <option value="wallet">Wallet</option>
                  <option value="total">Total</option>
                  <option value="free">Free</option>
                </select>
                <input type="number" min={0.01} max={100} step={0.01} className={`w-24 rounded bg-zinc-900 px-2 py-1 ${invalidClass(!(capital.scaleInBudget.percentage > 0 && capital.scaleInBudget.percentage <= 100))}`}
                  value={capital.scaleInBudget.percentage}
                  onChange={(e) => setSIB({ percentage: clampPctNum(e.currentTarget.value) })}
                />
                <span className="text-zinc-500">예상 {fmt(expectedFrom(capital.scaleInBudget.basis, true, capital.scaleInBudget.percentage, balances, capital.estimatedBalance, symbolCount))}</span>
              </div>
            ) : null}
            {capital.scaleInBudget.mode==='position_percent' ? (
              <div className="flex items-center gap-2 pl-5">
                <span className="text-zinc-400">현재 매수 기준 <InfoTip title="추가 매수 발생 시점의 누적 매수금액 기준으로 산정합니다." /></span>
                <input type="number" min={1} max={2000} step={1} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                  value={capital.scaleInBudget.percentage}
                  onChange={(e) => setSIB({ percentage: Math.max(1, Math.min(2000, Math.round(Number(e.currentTarget.value) || 0))) })}
                />
                <span className="text-zinc-500">%</span>
                <span className="text-zinc-500">(현재 포지션 누적 매수금액 기준으로 산정)</span>
              </div>
            ) : null}
            {capital.scaleInBudget.mode==='min_notional' ? (
              <div className="pl-5 text-zinc-500">
                심볼별 최소 주문 금액을 사용합니다.
                {minNotionalHint != null ? (
                  <>
                    <span className="ml-2 text-zinc-400">추천 {fmt(minNotionalHint)}</span>
                    <button
                      type="button"
                      className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
                      onClick={() => setSIB({ minNotional: Number(minNotionalHint) || 0 })}
                    >
                      적용
                    </button>
                    <button
                      type="button"
                      className="ml-2 rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
                      onClick={() => setShowScaleMinModal(true)}
                    >
                      예상주문금액 확인
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
          {/* Right: 추가 매수 한도 설정 (세그먼트 + 해당 입력만) */}
          <div className="space-y-2">
            <div className="mb-1 font-medium text-zinc-100">추가 매수 한도 설정 <InfoTip title="추가 매수에 사용할 총 한도를 제한합니다." /></div>
            {(() => {
              const mode: 'balance' | 'initial' | 'count' | 'amount' | 'unlimited' = capital.scaleInLimit.unlimited
                ? 'unlimited'
                : capital.scaleInLimit.balance.enabled
                ? 'balance'
                : capital.scaleInLimit.initialMargin.enabled
                ? 'initial'
                : capital.scaleInLimit.purchaseCount.enabled
                ? 'count'
                : (capital.scaleInLimit.notional?.enabled ? 'amount' : 'unlimited');
              const setMode = (m: 'balance' | 'initial' | 'count' | 'amount' | 'unlimited') => {
                setLimit({
                  balance: { ...capital.scaleInLimit.balance, enabled: m === 'balance' } as any,
                  initialMargin: { ...capital.scaleInLimit.initialMargin, enabled: m === 'initial' } as any,
                  purchaseCount: { ...capital.scaleInLimit.purchaseCount, enabled: m === 'count' } as any,
                  notional: { ...(capital.scaleInLimit.notional ?? { asset: 'USDT', amount: 0 } as any), enabled: (m as any) === 'amount' } as any,
                  unlimited: m === 'unlimited'
                } as any);
              };
              return (
                <div className="space-y-2">
                  <Segmented
                    ariaLabel="scale-in limit mode"
                    value={mode}
                    onChange={(v) => setMode(v as any)}
                    options={[
                      { label: '잔고 비율', value: 'balance' },
                      { label: '초기 대비%', value: 'initial' },
                      { label: '횟수', value: 'count' },
                      { label: '직접 입력', value: 'amount' },
                      { label: '제한 없음', value: 'unlimited' }
                    ]}
                  />
                  <div className="text-[11px] text-zinc-500">
                    <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">예상 총 사용액 {fmt(totalUsed)} / 한도 {fmt(maxBudget)} {quote}</span>
                  </div>
                  {/* 간단 요약 칩 */}
                  <div className="text-[11px] text-zinc-500">
                    {mode === 'balance' && (
                      <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">{capital.scaleInLimit.balance.basis} · {fmtPct(capital.scaleInLimit.balance.percentage)}</span>
                    )}
                    {mode === 'initial' && (
                      <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">초기 대비 {capital.scaleInLimit.initialMargin.percentage}%</span>
                    )}
                    {mode === 'count' && (
                      <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">횟수 {capital.scaleInLimit.purchaseCount.value}회</span>
                    )}
                    {mode === 'amount' && (
                      <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">정액 {fmt(capital.scaleInLimit.notional?.amount)} {capital.scaleInLimit.notional?.asset ?? 'USDT'}</span>
                    )}
                    {mode === 'unlimited' && (
                      <span className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">제한 없음</span>
                    )}
                  </div>
                  {mode === 'balance' ? (
                    <div className="flex items-center gap-2 pl-1">
                      <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInLimit.balance.basis} onChange={(e) => setLimit({ balance: { ...capital.scaleInLimit.balance, basis: e.target.value as MarginBasis } as any })}>
                        <option value="wallet">Wallet</option>
                        <option value="total">Total</option>
                        <option value="free">Free</option>
                      </select>
                      <input
                        type="number"
                        min={0.01}
                        max={100}
                        step={0.01}
                        className={`w-24 rounded bg-zinc-900 px-2 py-1 ${invalidClass(!(capital.scaleInLimit.balance.percentage > 0 && capital.scaleInLimit.balance.percentage <= 100))}`}
                        value={capital.scaleInLimit.balance.percentage}
                        onChange={(e) => setLimit({ balance: { ...capital.scaleInLimit.balance, percentage: clampPctNum(e.currentTarget.value) } as any })}
                      />
                      <span className="text-zinc-500">%</span>
                      <span className="text-[11px] text-zinc-500">(0.01–100)</span>
                    </div>
                  ) : null}
                  {mode === 'initial' ? (
                    <div className="flex items-center gap-2 pl-1">
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        step={1}
                        className={`w-24 rounded bg-zinc-900 px-2 py-1 ${invalidClass(!(capital.scaleInLimit.initialMargin.percentage >= 1 && capital.scaleInLimit.initialMargin.percentage <= 1000))}`}
                        value={capital.scaleInLimit.initialMargin.percentage}
                        onChange={(e) => setLimit({ initialMargin: { ...capital.scaleInLimit.initialMargin, percentage: Math.max(1, Math.min(1000, Math.round(Number(e.currentTarget.value) || 0))) } as any })}
                      />
                      <span className="text-zinc-500">%</span>
                      <span className="text-[11px] text-zinc-500">(1–1000)</span>
                    </div>
                  ) : null}
                  {mode === 'count' ? (
                    <div className="flex items-center gap-2 pl-1">
                      <input
                        type="number"
                        min={1}
                        max={100}
                        step={1}
                        className={`w-20 rounded bg-zinc-900 px-2 py-1 ${invalidClass(!(capital.scaleInLimit.purchaseCount.value >= 1 && capital.scaleInLimit.purchaseCount.value <= 100))}`}
                        value={capital.scaleInLimit.purchaseCount.value}
                        onChange={(e) => setLimit({ purchaseCount: { ...capital.scaleInLimit.purchaseCount, value: Math.max(1, Math.min(100, Math.round(Number(e.currentTarget.value) || 0))) } as any })}
                      />
                      <span className="text-zinc-500">회</span>
                      <span className="text-[11px] text-zinc-500">(1–100)</span>
                    </div>
                  ) : null}
                  {mode === 'amount' ? (
                    <div className="flex items-center gap-2 pl-1">
                      <select
                        className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                        value={capital.scaleInLimit.notional?.asset ?? 'USDT'}
                        onChange={(e) => setLimit({ notional: { ...(capital.scaleInLimit.notional ?? { enabled: true, amount: 0 } as any), asset: e.target.value as any } as any })}
                      >
                        <option value="USDT">USDT</option>
                        <option value="USDC">USDC</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        className={`w-28 rounded bg-zinc-900 px-2 py-1 ${invalidClass(!((capital.scaleInLimit.notional?.amount ?? 0) >= 0))}`}
                        value={capital.scaleInLimit.notional?.amount ?? 0}
                        onChange={(e) => setLimit({ notional: { ...(capital.scaleInLimit.notional ?? { enabled: true, asset: 'USDT' } as any), amount: Math.max(0, Number(e.currentTarget.value) || 0) } as any })}
                      />
                      <span className="text-[11px] text-zinc-500">(0 이상)</span>
                    </div>
                  ) : null}
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="font-medium text-zinc-100">매수 예외 조건</div>
          <button type="button" className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300" onClick={() => setShowExceptions(true)}>예외 조건 선택</button>
        </div>
        <div className="space-y-2 text-[12px]">
          <div className="text-zinc-400">
            {(() => {
              const exc: any = (capital as any).exceptions ?? {};
              const picked: string[] = [];
              if (exc.totalVsWalletEnabled) picked.push(`Total≤Wallet ${exc.totalVsWalletPct ?? 0}%`);
              if (exc.freeVsWalletEnabled) picked.push(`Free≤Wallet ${exc.freeVsWalletPct ?? 0}%`);
              if (exc.totalBelowEnabled) picked.push(`Total≤${exc.totalBelowAmount ?? 0} ${quote}`);
              if (exc.freeBelowEnabled) picked.push(`Free≤${exc.freeBelowAmount ?? 0} ${quote}`);
              return picked.length > 0 ? picked.join(' · ') : '선택된 예외 없음';
            })()}
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.totalVsWalletEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalVsWalletEnabled: e.target.checked } as any })} />
            <span>Total 잔고가 Wallet 보다</span>
            <input type="number" min={1} max={100} className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.totalVsWalletPct ?? 50)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalVsWalletPct: Math.max(1, Math.min(100, Math.round(Number(e.currentTarget.value) || 0))) } as any })} />
            <span>% 이하</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.freeVsWalletEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeVsWalletEnabled: e.target.checked } as any })} />
            <span>Free 잔고가 Wallet 보다</span>
            <input type="number" min={1} max={100} className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.freeVsWalletPct ?? 50)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeVsWalletPct: Math.max(1, Math.min(100, Math.round(Number(e.currentTarget.value) || 0))) } as any })} />
            <span>% 이하</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.totalBelowEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalBelowEnabled: e.target.checked } as any })} />
            <span>Total 잔고</span>
            <input type="number" min={0} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.totalBelowAmount ?? 0)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalBelowAmount: Math.max(0, Number(e.currentTarget.value) || 0) } as any })} />
            <span>{quote} 이하</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.freeBelowEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeBelowEnabled: e.target.checked } as any })} />
            <span>Free 잔고</span>
            <input type="number" min={0} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.freeBelowAmount ?? 0)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeBelowAmount: Math.max(0, Number(e.currentTarget.value) || 0) } as any })} />
            <span>{quote} 이하</span>
          </label>
        </div>
      </div>

      {/* 예외 조건 선택 모달 */}
      <HelpModal open={showExceptions} title="매수 예외 조건 선택" onClose={() => setShowExceptions(false)}>
        <div className="space-y-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.totalVsWalletEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalVsWalletEnabled: e.target.checked } as any })} />
            <span>Total 잔고가 Wallet 보다</span>
            <input type="number" min={1} max={100} className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.totalVsWalletPct ?? 50)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalVsWalletPct: Math.max(1, Math.min(100, Math.round(Number(e.currentTarget.value) || 0))) } as any })} />
            <span>% 이하</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.freeVsWalletEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeVsWalletEnabled: e.target.checked } as any })} />
            <span>Free 잔고가 Wallet 보다</span>
            <input type="number" min={1} max={100} className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.freeVsWalletPct ?? 50)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeVsWalletPct: Math.max(1, Math.min(100, Math.round(Number(e.currentTarget.value) || 0))) } as any })} />
            <span>% 이하</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.totalBelowEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalBelowEnabled: e.target.checked } as any })} />
            <span>Total 잔고</span>
            <input type="number" min={0} className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.totalBelowAmount ?? 0)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), totalBelowAmount: Math.max(0, Number(e.currentTarget.value) || 0) } as any })} />
            <span>{quote} 이하</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={Boolean((capital as any).exceptions?.freeBelowEnabled)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeBelowEnabled: e.target.checked } as any })} />
            <span>Free 잔고</span>
            <input type="number" min={0} className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={Number((capital as any).exceptions?.freeBelowAmount ?? 0)} onChange={(e) => onChange({ ...(capital as any), exceptions: { ...((capital as any).exceptions ?? {}), freeBelowAmount: Math.max(0, Number(e.currentTarget.value) || 0) } as any })} />
            <span>{quote} 이하</span>
          </label>
        </div>
      </HelpModal>

      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 font-medium text-zinc-100">양방향(헤지) 금액 설정</div>
        <label className="mb-2 flex items-center gap-2">
          <input type="checkbox" className="h-4 w-4" checked={Boolean(capital.hedgeBudget?.separateByDirection)} onChange={(e) => onChange({ ...capital, hedgeBudget: { ...(capital.hedgeBudget ?? ({} as any)), separateByDirection: e.target.checked, long: capital.hedgeBudget?.long ?? { mode: 'position_percent', percentage: 100 }, short: capital.hedgeBudget?.short ?? { mode: 'position_percent', percentage: 100 } } })} />
          <span>롱/숏 따로 설정</span>
        </label>
        <div className="grid gap-3 md:grid-cols-2">
          {(['long','short'] as const).map((dir) => {
            const cfg = (capital.hedgeBudget?.[dir] ?? { mode: 'position_percent', percentage: 100 }) as any;
            const setDir = (patch: any) => onChange({ ...capital, hedgeBudget: { ...(capital.hedgeBudget ?? ({} as any)), separateByDirection: Boolean(capital.hedgeBudget?.separateByDirection), long: dir==='long' ? { ...cfg, ...patch } : (capital.hedgeBudget?.long ?? { mode: 'position_percent', percentage: 100 }), short: dir==='short' ? { ...cfg, ...patch } : (capital.hedgeBudget?.short ?? { mode: 'position_percent', percentage: 100 }) } as any });
            const title = dir === 'long' ? '롱' : '숏';
            const show = capital.hedgeBudget?.separateByDirection || dir === 'long';
            if (!show) return <div key={dir} />;
            return (
              <div key={dir} className="space-y-2 rounded border border-zinc-800 bg-zinc-950/40 p-2">
                <div className="font-medium text-zinc-200">{title} 매수 금액</div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1"><input type="radio" name={`hedge-${dir}-mode`} checked={cfg.mode==='usdt'} onChange={() => setDir({ mode: 'usdt' })} /> 직접입력</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" name={`hedge-${dir}-mode`} checked={cfg.mode==='balance_percentage'} onChange={() => setDir({ mode: 'balance_percentage', perSymbol: false })} /> 잔고기준(총)</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" name={`hedge-${dir}-mode`} checked={cfg.mode==='per_symbol_percentage'} onChange={() => setDir({ mode: 'per_symbol_percentage', perSymbol: true })} /> 잔고기준(종목당)</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" name={`hedge-${dir}-mode`} checked={cfg.mode==='position_percent'} onChange={() => setDir({ mode: 'position_percent' })} /> 현재 포지션%</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" name={`hedge-${dir}-mode`} checked={cfg.mode==='initial_percent'} onChange={() => setDir({ mode: 'initial_percent' })} /> 최초 매수%</label>
                  <label className="inline-flex items-center gap-1"><input type="radio" name={`hedge-${dir}-mode`} checked={cfg.mode==='min_notional'} onChange={() => setDir({ mode: 'min_notional' })} /> 최소주문단위</label>
                </div>
                {cfg.mode==='usdt' ? (
                  <div className="flex items-center gap-2">
                    <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={cfg.asset ?? quote} onChange={(e) => setDir({ asset: e.target.value })}>
                      <option value="USDT">USDT</option>
                      <option value="USDC">USDC</option>
                    </select>
                    <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={cfg.amount ?? 0} onChange={(e) => setDir({ amount: Math.max(0, Number(e.target.value) || 0) })} />
                  </div>
                ) : null}
                {(cfg.mode==='balance_percentage' || cfg.mode==='per_symbol_percentage') ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={cfg.basis ?? 'wallet'} onChange={(e) => setDir({ basis: e.target.value })}>
                      <option value="wallet">Wallet</option>
                      <option value="total">Total</option>
                      <option value="free">Free</option>
                    </select>
                    <input type="number" min={0.01} max={cfg.mode==='initial_percent'?2000:100} step={0.01} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={cfg.percentage ?? 0}
                      onChange={(e) => setDir({ percentage: clampPctNum(e.currentTarget.value) })} />
                    <span className="text-zinc-500">{cfg.mode==='per_symbol_percentage' ? '종목당 기준' : '총잔고 기준'}</span>
                  </div>
                ) : null}
                {(cfg.mode==='position_percent' || cfg.mode==='initial_percent') ? (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400">비율</span>
                    <input type="number" min={cfg.mode==='initial_percent'?1:1} max={cfg.mode==='initial_percent'?2000:100} step={1} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={cfg.percentage ?? 0}
                      onChange={(e) => setDir({ percentage: Math.max(1, Math.min(cfg.mode==='initial_percent'?2000:100, Math.round(Number(e.currentTarget.value) || 0))) })} />
                    <span className="text-zinc-500">%</span>
                  </div>
                ) : null}
                {cfg.mode==='min_notional' ? (
                  <div className="text-zinc-500">심볼별 최소 주문 금액을 사용합니다.</div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Min notional preview modals */}
      <HelpModal open={showInitialMinModal} title="최초 매수 · 최소 주문 예상" onClose={() => setShowInitialMinModal(false)}>
        {renderMinNotionalTable('initial')}
      </HelpModal>
      <HelpModal open={showScaleMinModal} title="추가 매수 · 최소 주문 예상" onClose={() => setShowScaleMinModal(false)}>
        {renderMinNotionalTable('scale')}
      </HelpModal>
      <HelpModal open={showBalancePickModal} title="잔고 조회 결과 적용" onClose={() => setShowBalancePickModal(false)}>
        <div className="space-y-2 text-sm">
          <p className="text-zinc-400">잔고 조회 결과를 예상 금액 계산에 사용할지, 입력값을 유지할지 선택하세요.</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
              onClick={() => { setCalcBasis('estimated'); setShowBalancePickModal(false); }}
            >
              입력값 유지(계산 기준)
            </button>
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
              onClick={() => { setCalcBasis('wallet'); setShowBalancePickModal(false); }}
            >
              Wallet 사용(계산 기준)
            </button>
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
              onClick={() => { setCalcBasis('total'); setShowBalancePickModal(false); }}
            >
              Total 사용(계산 기준)
            </button>
            <button
              type="button"
              className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300 hover:border-emerald-600/60 hover:text-emerald-200"
              onClick={() => { setCalcBasis('free'); setShowBalancePickModal(false); }}
            >
              Free 사용(계산 기준)
            </button>
          </div>
          <div className="mt-2 text-[12px] text-zinc-400">
            <div>입력값: {fmt(capital.estimatedBalance)} {quote}</div>
            <div>Wallet: {fmt(fetchedBalances?.wallet ?? balances.wallet)} {quote}</div>
            <div>Total: {fmt(fetchedBalances?.total ?? balances.total)} {quote}</div>
            <div>Free: {fmt(fetchedBalances?.free ?? balances.free)} {quote}</div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300"
              onClick={() => { const v = Number(fetchedBalances?.wallet ?? NaN); if (Number.isFinite(v)) set({ estimatedBalance: v }); setShowBalancePickModal(false); }}
            >
              입력값을 Wallet로 설정
            </button>
            <button
              type="button"
              className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300"
              onClick={() => { const v = Number(fetchedBalances?.total ?? NaN); if (Number.isFinite(v)) set({ estimatedBalance: v }); setShowBalancePickModal(false); }}
            >
              입력값을 Total로 설정
            </button>
            <button
              type="button"
              className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300"
              onClick={() => { const v = Number(fetchedBalances?.free ?? NaN); if (Number.isFinite(v)) set({ estimatedBalance: v }); setShowBalancePickModal(false); }}
            >
              입력값을 Free로 설정
            </button>
          </div>
        </div>
      </HelpModal>
    </div>
  );
}

function clampPctNum(v: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0.01, Math.min(100, n));
}

function fmt(n?: number) {
  if (!Number.isFinite(n as number)) return '-';
  const v = Number(n);
  return v >= 1000 ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : v.toFixed(2);
}

function fmtPct(n?: number) {
  if (!Number.isFinite(n as number)) return '0%';
  const v = Math.max(0, Math.min(100, Number(n)));
  return `${v.toFixed(2)}%`;
}

function expectedFrom(basis: MarginBasis, perSymbol: boolean, percentage: number, balances: { wallet?: number; total?: number; free?: number }, estimated: number, symbolCount: number) {
  const base = basis === 'wallet' ? (balances.wallet ?? estimated) : basis === 'total' ? (balances.total ?? estimated) : (balances.free ?? estimated);
  const denom = perSymbol ? Math.max(1, symbolCount) : 1;
  return (base / denom) * (Math.max(0, percentage) / 100);
}
