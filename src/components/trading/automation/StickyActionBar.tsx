"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { FooterActions } from './FooterActions';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';

export function StickyActionBar() {
  const lastSavedAt = useAutoTradingSettingsStore((s) => s.settings.metadata.lastSavedAt);
  const settings = useAutoTradingSettingsStore((s) => s.settings);
  const [excText, setExcText] = useState<string | null>(null);
  const [excOk, setExcOk] = useState<boolean>(true);
  const savedLabel = useMemo(() => {
    if (!lastSavedAt) return '아직 저장되지 않음';
    try {
      const d = new Date(lastSavedAt);
      return `최근 저장: ${d.toLocaleString()}`;
    } catch {
      return `최근 저장: ${lastSavedAt}`;
    }
  }, [lastSavedAt]);

  const budgetStatus = useMemo(() => {
    const cap = settings.capital as any;
    const count = Math.max(1, settings.symbolCount || 1);
    const base = Number(cap.estimatedBalance) || 0;
    const maxPct = Math.max(0, Math.min(100, cap.maxMargin?.percentage ?? 0));
    const maxBudget = (base * maxPct) / 100;
    // initial total
    const im = cap.initialMargin;
    const perSymbolBase = base / count;
    let initialTotal = 0;
    if (im.mode === 'usdt_amount') initialTotal = Number(im.usdtAmount) || 0;
    else if (im.mode === 'min_notional') initialTotal = Number(im.minNotional) * count || 0;
    else if (im.mode === 'per_symbol_percentage') initialTotal = perSymbolBase * ((im.percentage ?? 0) / 100) * count;
    else if (im.mode === 'all_symbols_percentage') initialTotal = base * ((im.percentage ?? 0) / 100);
    // scale-in total
    const sb = cap.scaleInBudget;
    let scaleTotal = 0;
    if (sb.mode === 'usdt_amount') scaleTotal = Number(sb.usdtAmount) || 0;
    else if (sb.mode === 'min_notional') scaleTotal = Number(sb.minNotional) * count || 0;
    else if (sb.mode === 'per_symbol_percentage') scaleTotal = perSymbolBase * ((sb.percentage ?? 0) / 100) * count;
    else if (sb.mode === 'balance_percentage') scaleTotal = base * ((sb.percentage ?? 0) / 100);

    const used = Math.max(0, initialTotal) + Math.max(0, scaleTotal);
    const ok = used <= maxBudget + 1e-9;
    return {
      ok,
      text: ok
        ? `예산 정상 · 사용 ${used.toFixed(2)} / 한도 ${maxBudget.toFixed(2)}`
        : `경고 · 사용 ${used.toFixed(2)} / 한도 ${maxBudget.toFixed(2)} (초과)`
    };
  }, [settings]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cap: any = settings.capital;
        const exc = (cap?.exceptions ?? {}) as any;
        const quote = String(cap?.initialMargin?.asset ?? 'USDT').toUpperCase();
        const sym = quote === 'USDC' ? 'BTCUSDC' : 'BTCUSDT';
        const cred = await fetch('/api/profile/credentials');
        if (!cred.ok) return;
        const acc = await fetch(`/api/trading/binance/account?symbol=${sym}`);
        if (!acc.ok) return;
        const js = await acc.json();
        const key = (k: string) => `${k}${quote}`;
        const wallet = Number(js?.account?.[key('wallet')] ?? NaN);
        const total = Number(js?.account?.[key('total')] ?? NaN);
        const free = Number(js?.account?.[key('free')] ?? NaN);
        let triggered: string[] = [];
        if (exc.totalVsWalletEnabled && Number.isFinite(wallet) && Number.isFinite(total)) {
          const pct = Number(exc.totalVsWalletPct ?? 0);
          if (wallet > 0 && (total / wallet) * 100 <= pct) triggered.push(`Total ≤ Wallet의 ${pct}%`);
        }
        if (exc.freeVsWalletEnabled && Number.isFinite(wallet) && Number.isFinite(free)) {
          const pct = Number(exc.freeVsWalletPct ?? 0);
          if (wallet > 0 && (free / wallet) * 100 <= pct) triggered.push(`Free ≤ Wallet의 ${pct}%`);
        }
        if (exc.totalBelowEnabled && Number.isFinite(total)) {
          const amt = Number(exc.totalBelowAmount ?? 0);
          if (total <= amt) triggered.push(`Total ≤ ${amt} ${quote}`);
        }
        if (exc.freeBelowEnabled && Number.isFinite(free)) {
          const amt = Number(exc.freeBelowAmount ?? 0);
          if (free <= amt) triggered.push(`Free ≤ ${amt} ${quote}`);
        }
        if (cancelled) return;
        if (triggered.length > 0) {
          setExcOk(false);
          setExcText(`예외조건 충족: ${triggered.join(', ')} (추가 매수 제한 가능)`);
        } else {
          setExcOk(true);
          setExcText('예외조건 미충족');
        }
      } catch {
        if (!cancelled) {
          setExcText(null);
          setExcOk(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [settings.capital]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[500] border-t border-zinc-800 bg-zinc-950/90 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/70">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-2 md:px-6">
        <div className="flex items-center gap-3">
          <div className="text-[11px] text-zinc-500">{savedLabel}</div>
          <div className={`text-[11px] ${budgetStatus.ok ? 'text-emerald-300' : 'text-amber-300'}`}>{budgetStatus.text}</div>
          {excText ? (
            <div className={`text-[11px] ${excOk ? 'text-zinc-400' : 'text-amber-300'}`}>{excText}</div>
          ) : null}
        </div>
        <FooterActions />
      </div>
    </div>
  );
}
