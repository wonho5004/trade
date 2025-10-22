'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useDebounce } from '@/hooks/useDebounce';
import { normalizeSymbol } from '@/lib/trading/symbols';

type MarketItem = {
  symbol: string;
  base: string;
  quote: string;
  priceChangePercent: number;
  volume: number;
  quoteVolume: number;
};

export function SymbolSelector({
  title,
  placeholder = '심볼 검색 (예: BTC, ETH)',
  quote = 'USDT',
  recentKey: recentKeyProp,
  recentMax = 12,
  recentRetentionDays = 30,
  enableSort = true,
  symbols,
  onAdd,
  onRemove,
  onExcludeAdd
}: {
  title: string;
  placeholder?: string;
  quote?: string;
  recentKey?: string;
  recentMax?: number;
  recentRetentionDays?: number;
  enableSort?: boolean;
  symbols: string[];
  onAdd: (symbol: string) => void;
  onRemove: (symbol: string) => void;
  onExcludeAdd?: (symbol: string) => void;
}) {
  const [query, setQuery] = useState('');
  const debounced = useDebounce(query, 250);
  const [items, setItems] = useState<MarketItem[]>([]);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [sort, setSort] = useState<'alphabet' | 'volume' | 'tradeValue' | 'changeUp' | 'changeDown'>('alphabet');

  const recentKey = useMemo(() => `recent-symbols:${recentKeyProp ?? 'default'}:${quote}`, [recentKeyProp, quote]);

  type RecentItem = { s: string; t: number };

  const pruneAndNormalizeStored = useCallback((raw: unknown): RecentItem[] => {
    const cutoff = Date.now() - recentRetentionDays * 24 * 60 * 60 * 1000;
    let arr: RecentItem[] = [];
    if (Array.isArray(raw)) {
      if (raw.every((x) => typeof x === 'string')) {
        arr = (raw as string[]).map((s) => ({ s, t: Date.now() }));
      } else {
        arr = (raw as any[])
          .map((x) => ({ s: String((x as any).s ?? ''), t: Number((x as any).t ?? Date.now()) }))
          .filter((x) => x.s.length > 0 && Number.isFinite(x.t));
      }
    }
    const seen = new Set<string>();
    const deduped: RecentItem[] = [];
    for (const it of arr.sort((a, b) => b.t - a.t)) {
      if (it.t < cutoff) continue;
      if (seen.has(it.s)) continue;
      seen.add(it.s);
      deduped.push(it);
    }
    return deduped.slice(0, recentMax);
  }, [recentRetentionDays, recentMax]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(recentKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const normalized = pruneAndNormalizeStored(parsed);
      localStorage.setItem(recentKey, JSON.stringify(normalized));
      setRecent(normalized.map((x) => x.s));
    } catch {}
  }, [recentKey, pruneAndNormalizeStored]);

  // Close dropdown on outside click or Escape
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (!open) return;
      const el = containerRef.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // return focus to input for convenience
        inputRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocMouseDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pushRecent = (s: string) => {
    try {
      const raw = localStorage.getItem(recentKey);
      const parsed = raw ? JSON.parse(raw) : [];
      let list = pruneAndNormalizeStored(parsed);
      const now = Date.now();
      const map = new Map<string, number>(list.map((x) => [x.s, x.t]));
      map.set(s, now);
      list = Array.from(map.entries())
        .map(([sym, t]) => ({ s: sym, t }))
        .sort((a, b) => b.t - a.t)
        .slice(0, recentMax);
      localStorage.setItem(recentKey, JSON.stringify(list));
      setRecent(list.map((x) => x.s));
    } catch {}
  };

  const clearRecent = () => {
    try {
      setRecent([]);
      localStorage.removeItem(recentKey);
    } catch {}
  };

  useEffect(() => {
    let closed = false;
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (debounced.trim().length > 0) params.set('search', debounced.trim());
        params.set('quote', quote);
        params.set('sort', sort);
        const res = await fetch(`/api/markets?${params.toString()}`);
        if (!res.ok) return;
        const json = (await res.json()) as { items: MarketItem[] };
        if (!closed) setItems(json.items ?? []);
      } catch {
        // ignore
      }
    };
    load();
    return () => {
      closed = true;
    };
  }, [debounced, quote, sort]);

  const filtered = useMemo(() => {
    const q = normalizeSymbol(query, quote);
    if (!q) return items.slice(0, 20);
    return items.filter((it) => it.symbol.includes(q)).slice(0, 20);
  }, [items, query, quote]);

  const add = (s: string) => {
    const norm = normalizeSymbol(s, quote);
    onAdd(norm);
    pushRecent(norm);
    setQuery('');
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-zinc-300">{title}</p>
      <div className="relative" ref={containerRef}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              return;
            }
          }}
          placeholder={placeholder}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          ref={inputRef}
        />
        {!open && recent.length > 0 && query.trim().length === 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            <span className="text-zinc-500">최근 선택:</span>
            {recent.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => add(r)}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300"
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={clearRecent}
              className="ml-auto rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-500 hover:text-rose-300"
            >
              지우기
            </button>
          </div>
        ) : null}
        {open && (
          <div className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded border border-zinc-800 bg-zinc-950/95 shadow-lg">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/95 px-3 py-2 text-[11px] text-zinc-400">
              <span>검색 결과</span>
              {enableSort ? (
                <div className="flex items-center gap-1">
                  {(['alphabet', 'volume', 'tradeValue', 'changeUp', 'changeDown'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSort(s)}
                      className={`rounded border px-2 py-0.5 ${sort === s ? 'border-emerald-500/60 text-emerald-300' : 'border-zinc-700 text-zinc-400'}`}
                    >
                      {s === 'alphabet' ? '알파벳' : s === 'volume' ? '거래량' : s === 'tradeValue' ? '시가총액' : s === 'changeUp' ? '상승률' : '하락률'}
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-zinc-200"
                aria-label="닫기"
              >
                닫기
              </button>
            </div>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-zinc-500">결과 없음</div>
            ) : (
              filtered.map((m) => (
                <div
                  key={m.symbol}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-zinc-200 hover:bg-zinc-800/40"
                >
                  <span>
                    {m.symbol}
                    <span className="ml-2 text-[10px] text-zinc-500">vol {Math.round(m.volume).toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => add(m.symbol)}
                      className="rounded border border-emerald-500/60 px-2 py-0.5 text-[11px] text-emerald-300"
                    >
                      추가
                    </button>
                    {onExcludeAdd ? (
                      <button
                        type="button"
                        onClick={() => { onExcludeAdd(normalizeSymbol(m.symbol, quote)); pushRecent(normalizeSymbol(m.symbol, quote)); setOpen(false); setQuery(''); }}
                        className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-400 hover:text-rose-300"
                      >
                        제외
                      </button>
                    ) : null}
                    <span className={`${m.priceChangePercent >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{m.priceChangePercent.toFixed(2)}%</span>
                  </span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
      {symbols.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {symbols.map((s) => (
            <span key={s} className="inline-flex items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-300">
              {s}
              <button type="button" onClick={() => onRemove(s)} className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-400 hover:text-rose-300">
                제거
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
