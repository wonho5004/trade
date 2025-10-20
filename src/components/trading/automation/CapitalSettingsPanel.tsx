"use client";

import { useState } from 'react';
import type { CapitalSettings, MarginBasis } from '@/types/trading/auto-trading';

export function CapitalSettingsPanel({ capital, symbolCount, onChange }: { capital: CapitalSettings; symbolCount: number; onChange: (next: CapitalSettings) => void }) {
  const [balances, setBalances] = useState<{ wallet?: number; total?: number; free?: number }>({});
  const quote = capital.initialMargin.asset ?? 'USDT';

  const set = (patch: Partial<CapitalSettings>) => onChange({ ...capital, ...patch });
  const setIM = (patch: Partial<CapitalSettings['initialMargin']>) => set({ initialMargin: { ...capital.initialMargin, ...patch } });
  const setSIB = (patch: Partial<CapitalSettings['scaleInBudget']>) => set({ scaleInBudget: { ...capital.scaleInBudget, ...patch } });
  const setLimit = (patch: Partial<CapitalSettings['scaleInLimit']>) => set({ scaleInLimit: { ...capital.scaleInLimit, ...patch } as any });

  const basisAmount = (basis: MarginBasis, perSymbol: boolean) => {
    const b = basis === 'wallet' ? (balances.wallet ?? capital.estimatedBalance) : basis === 'total' ? (balances.total ?? capital.estimatedBalance) : (balances.free ?? capital.estimatedBalance);
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

  return (
    <div className="space-y-3 text-xs text-zinc-300">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-zinc-400">쿼트구분</span>
        <select className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={quote} onChange={(e) => { setIM({ asset: e.target.value as any }); setSIB({ asset: e.target.value as any }); }}>
          <option value="USDT">USDT</option>
          <option value="USDC">USDC</option>
        </select>
        <span className="ml-3 text-zinc-400">투자 금액</span>
        <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.estimatedBalance}
          onChange={(e) => set({ estimatedBalance: Math.max(0, Number(e.target.value) || 0) })} />
        <button type="button" className="rounded border border-zinc-700 px-2 py-1 text-zinc-300" onClick={async () => {
          try {
            const symbol = quote === 'USDT' ? 'BTCUSDT' : 'BTCUSDC';
            const res = await fetch(`/api/trading/binance/account?symbol=${symbol}`);
            const json = await res.json();
            const key = (k: string) => `${k}${quote}`;
            setBalances({ wallet: Number(json?.account?.[key('wallet')] ?? NaN), total: Number(json?.account?.[key('total')] ?? NaN), free: Number(json?.account?.[key('free')] ?? NaN) });
          } catch {}
        }}>잔고 조회</button>
        <span className="text-zinc-500">Wallet {fmt(balances.wallet)} · Total {fmt(balances.total)} · Free {fmt(balances.free)}</span>
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" className="h-4 w-4" checked={Boolean(capital.useMinNotionalFallback)} onChange={(e) => set({ useMinNotionalFallback: e.target.checked })} />
        <span>최소 주문단위 이하 주문 시 최소 주문단위 사용</span>
      </label>

      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 font-medium text-zinc-100">최초 매수 금액 설정</div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <div className="space-y-2">
              <label className="flex items-center gap-2"><input type="radio" name="im-mode" checked={capital.initialMargin.mode==='usdt_amount'} onChange={() => setIM({ mode: 'usdt_amount' })} /> 직접 입력</label>
              {capital.initialMargin.mode==='usdt_amount' ? (
                <div className="flex items-center gap-2 pl-5">
                  <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.initialMargin.asset ?? 'USDT'} onChange={(e) => setIM({ asset: e.target.value as any })}>
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                  <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.initialMargin.usdtAmount}
                    onChange={(e) => setIM({ usdtAmount: Math.max(0, Number(e.target.value) || 0) })} />
                </div>
              ) : null}

              <label className="flex items-center gap-2"><input type="radio" name="im-mode" checked={capital.initialMargin.mode==='all_symbols_percentage'} onChange={() => setIM({ mode: 'all_symbols_percentage' })} /> 잔고 기준(총잔고)</label>
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

              <label className="flex items-center gap-2"><input type="radio" name="im-mode" checked={capital.initialMargin.mode==='per_symbol_percentage'} onChange={() => setIM({ mode: 'per_symbol_percentage' })} /> 잔고 기준(종목당)</label>
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

              <label className="flex items-center gap-2"><input type="radio" name="im-mode" checked={capital.initialMargin.mode==='min_notional'} onChange={() => setIM({ mode: 'min_notional' })} /> 최소 주문 단위 사용</label>
            </div>
          </div>
          <div className="space-y-2">
            <div className="text-zinc-400">예상 최초 매수 금액: <span className="text-zinc-200">{fmt(expectedInitial)}</span> {capital.initialMargin.asset ?? 'USDT'}</div>
            <p className="text-zinc-500">종목당 기준은 총잔고를 종목 수({symbolCount})로 나눈 값에 비율을 적용합니다.</p>
          </div>
        </div>
      </div>

      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 font-medium text-zinc-100">추가 매수 금액 설정</div>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-2">
            <label className="flex items-center gap-2"><input type="radio" name="sib-mode" checked={capital.scaleInBudget.mode==='usdt_amount'} onChange={() => setSIB({ mode: 'usdt_amount' })} /> 직접 입력</label>
            {capital.scaleInBudget.mode==='usdt_amount' ? (
              <div className="flex items-center gap-2 pl-5">
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInBudget.asset ?? 'USDT'} onChange={(e) => setSIB({ asset: e.target.value as any })}>
                  <option value="USDT">USDT</option>
                  <option value="USDC">USDC</option>
                </select>
                <input type="number" className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.scaleInBudget.usdtAmount ?? 0}
                  onChange={(e) => setSIB({ usdtAmount: Math.max(0, Number(e.target.value) || 0) })} />
              </div>
            ) : null}

            <label className="flex items-center gap-2"><input type="radio" name="sib-mode" checked={capital.scaleInBudget.mode==='balance_percentage'} onChange={() => setSIB({ mode: 'balance_percentage' })} /> 잔고 기준(총잔고)</label>
            {capital.scaleInBudget.mode==='balance_percentage' ? (
              <div className="flex items-center gap-2 pl-5">
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInBudget.basis} onChange={(e) => setSIB({ basis: e.target.value as MarginBasis })}>
                  <option value="wallet">Wallet</option>
                  <option value="total">Total</option>
                  <option value="free">Free</option>
                </select>
                <input type="number" min={0.01} max={100} step={0.01} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                  value={capital.scaleInBudget.percentage}
                  onChange={(e) => setSIB({ percentage: clampPctNum(e.currentTarget.value) })}
                />
                <span className="text-zinc-500">예상 {fmt(expectedScale)}</span>
              </div>
            ) : null}

            <label className="flex items-center gap-2"><input type="radio" name="sib-mode" checked={capital.scaleInBudget.mode==='per_symbol_percentage'} onChange={() => setSIB({ mode: 'per_symbol_percentage' })} /> 잔고 기준(종목당)</label>
            {capital.scaleInBudget.mode==='per_symbol_percentage' ? (
              <div className="flex items-center gap-2 pl-5">
                <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInBudget.basis} onChange={(e) => setSIB({ basis: e.target.value as MarginBasis })}>
                  <option value="wallet">Wallet</option>
                  <option value="total">Total</option>
                  <option value="free">Free</option>
                </select>
                <input type="number" min={0.01} max={100} step={0.01} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1"
                  value={capital.scaleInBudget.percentage}
                  onChange={(e) => setSIB({ percentage: clampPctNum(e.currentTarget.value) })}
                />
                <span className="text-zinc-500">예상 {fmt(expectedFrom(capital.scaleInBudget.basis, true, capital.scaleInBudget.percentage, balances, capital.estimatedBalance, symbolCount))}</span>
              </div>
            ) : null}

            <label className="flex items-center gap-2"><input type="radio" name="sib-mode" checked={capital.scaleInBudget.mode==='min_notional'} onChange={() => setSIB({ mode: 'min_notional' })} /> 최소 주문 단위 사용</label>
          </div>
        </div>
      </div>

      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
        <div className="mb-1 font-medium text-zinc-100">추가 매수 한도</div>
        {(() => {
          const mode: 'balance' | 'initial' | 'count' | 'unlimited' = capital.scaleInLimit.unlimited
            ? 'unlimited'
            : capital.scaleInLimit.balance.enabled
            ? 'balance'
            : capital.scaleInLimit.initialMargin.enabled
            ? 'initial'
            : capital.scaleInLimit.purchaseCount.enabled
            ? 'count'
            : 'unlimited';
          const setMode = (m: 'balance' | 'initial' | 'count' | 'unlimited') => {
            setLimit({
              balance: { ...capital.scaleInLimit.balance, enabled: m === 'balance' } as any,
              initialMargin: { ...capital.scaleInLimit.initialMargin, enabled: m === 'initial' } as any,
              purchaseCount: { ...capital.scaleInLimit.purchaseCount, enabled: m === 'count' } as any,
              unlimited: m === 'unlimited'
            } as any);
          };
          return (
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" name="sib-limit-mode" className="h-4 w-4" checked={mode==='balance'} onChange={() => setMode('balance')} />
                <span>총 잔고 비율 제한</span>
                {mode==='balance' ? (
                  <>
                    <select className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5" value={capital.scaleInLimit.balance.basis} onChange={(e) => setLimit({ balance: { ...capital.scaleInLimit.balance, basis: e.target.value as MarginBasis } as any })}>
                      <option value="wallet">Wallet</option>
                      <option value="total">Total</option>
                      <option value="free">Free</option>
                    </select>
                    <input type="number" min={0.01} max={100} step={0.01} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.scaleInLimit.balance.percentage}
                      onChange={(e) => setLimit({ balance: { ...capital.scaleInLimit.balance, percentage: clampPctNum(e.currentTarget.value) } as any })} />
                  </>
                ) : null}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sib-limit-mode" className="h-4 w-4" checked={mode==='initial'} onChange={() => setMode('initial')} />
                <span>초기 진입 대비 비율 제한</span>
                {mode==='initial' ? (
                  <>
                    <input type="number" min={1} max={1000} step={1} className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.scaleInLimit.initialMargin.percentage}
                      onChange={(e) => setLimit({ initialMargin: { ...capital.scaleInLimit.initialMargin, percentage: Math.max(1, Math.min(1000, Math.round(Number(e.currentTarget.value) || 0))) } as any })} />
                    <span className="text-zinc-500">%</span>
                  </>
                ) : null}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sib-limit-mode" className="h-4 w-4" checked={mode==='count'} onChange={() => setMode('count')} />
                <span>추가 매수 횟수 제한</span>
                {mode==='count' ? (
                  <>
                    <input type="number" min={1} max={100} step={1} className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={capital.scaleInLimit.purchaseCount.value}
                      onChange={(e) => setLimit({ purchaseCount: { ...capital.scaleInLimit.purchaseCount, value: Math.max(1, Math.min(100, Math.round(Number(e.currentTarget.value) || 0))) } as any })} />
                    <span className="text-zinc-500">회</span>
                  </>
                ) : null}
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="sib-limit-mode" className="h-4 w-4" checked={mode==='unlimited'} onChange={() => setMode('unlimited')} />
                <span>제한 없음(주의)</span>
              </label>
            </div>
          );
        })()}
      </div>

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

function expectedFrom(basis: MarginBasis, perSymbol: boolean, percentage: number, balances: { wallet?: number; total?: number; free?: number }, estimated: number, symbolCount: number) {
  const base = basis === 'wallet' ? (balances.wallet ?? estimated) : basis === 'total' ? (balances.total ?? estimated) : (balances.free ?? estimated);
  const denom = perSymbol ? Math.max(1, symbolCount) : 1;
  return (base / denom) * (Math.max(0, percentage) / 100);
}
