"use client";

import { useMemo, useState } from 'react';
import type { IndicatorConditions, PositionDirection } from '@/types/trading/auto-trading';
import type { IntervalOption } from '@/types/chart';
import { ConditionsPreview } from './ConditionsPreview';
import { collectIndicatorNodes } from '@/lib/trading/conditionsTree';
import { normalizeSymbol as toExchangeSymbol } from '@/lib/trading/symbols';

export function PreviewLauncher({ conditions, symbol, interval, direction = 'long', indicatorSignals }: {
  conditions: IndicatorConditions | undefined;
  symbol: string;
  interval: IntervalOption;
  direction?: PositionDirection;
  indicatorSignals?: Record<string, boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState<string>('');
  const [quote, setQuote] = useState<'USDT' | 'USDC'>('USDT');
  const [assume, setAssume] = useState<boolean>(false);
  const normSymbol = useMemo(() => {
    const src = input.trim() || symbol;
    return toExchangeSymbol(src, quote);
  }, [input, symbol, quote]);
  const buildSignals = (conds: any, on: boolean) => {
    try {
      if (!on) return undefined;
      const ids = collectIndicatorNodes(((conds as any)?.root as any) || conds).map((n) => n.id);
      return Object.fromEntries(ids.map((id) => [id, true]));
    } catch {
      return undefined;
    }
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300">
        프리뷰 열기
      </button>
      {open ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <div className="relative z-10 w-[min(96vw,900px)] rounded-lg border border-zinc-800 bg-zinc-950 p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-100">프리뷰</h3>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <label className="flex items-center gap-2">
                  <span>심볼</span>
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onBlur={(e) => setInput(toExchangeSymbol(e.currentTarget.value || symbol, quote))}
                    placeholder={symbol}
                    className="w-44 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span>쿼트</span>
                  <select value={quote} onChange={(e) => setQuote(e.target.value as any)} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100">
                    <option value="USDT">USDT</option>
                    <option value="USDC">USDC</option>
                  </select>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={assume} onChange={(e) => setAssume(e.target.checked)} />
                  지표 신호 가정(ON)
                </label>
                <button onClick={() => setOpen(false)} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">닫기</button>
              </div>
            </div>
            <ConditionsPreview
              conditions={conditions}
              symbol={normSymbol}
              interval={interval}
              direction={direction}
              indicatorSignals={assume ? buildSignals(conditions, true) : indicatorSignals}
              enabled={true}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
