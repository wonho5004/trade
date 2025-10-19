"use client";

import { useEffect, useMemo, useState } from 'react';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

type SortMode = 'alphabet' | 'volume' | 'tradeValue' | 'changeUp' | 'changeDown';

export function SymbolsPickerPanel({
  quote,
  manual,
  excluded,
  leverageOverrides,
  positionOverrides,
  featureOverrides,
  onChange
}: {
  quote: QuoteCurrency;
  manual: string[];
  excluded: string[];
  leverageOverrides: Record<string, number>;
  positionOverrides?: Record<string, 'long' | 'short' | 'both'>;
  featureOverrides?: Record<string, { scaleIn?: boolean; exit?: boolean; stopLoss?: boolean }>;
  onChange: (next: {
    manual: string[];
    excluded: string[];
    leverageOverrides: Record<string, number>;
    positionOverrides: Record<string, 'long' | 'short' | 'both'>;
    featureOverrides: Record<string, { scaleIn?: boolean; exit?: boolean; stopLoss?: boolean }>;
  }) => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('alphabet');
  const [items, setItems] = useState<TickerInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ quote, sort });
        if (search.trim()) params.set('search', search.trim());
        const res = await fetch(`/api/markets?${params.toString()}`, { signal: controller.signal });
        if (!res.ok) throw new Error('load failed');
        const json = (await res.json()) as { items: TickerInfo[] };
        if (!aborted) setItems(json.items);
      } catch {
        if (!aborted) setItems([]);
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
      controller.abort();
    };
  }, [quote, sort, search]);

  const manualSet = useMemo(() => new Set(manual.map((s) => s.toUpperCase())), [manual]);
  const excludedSet = useMemo(() => new Set(excluded.map((s) => s.toUpperCase())), [excluded]);

  const addManual = (sym: string) => {
    const up = sym.toUpperCase();
    const nextManual = Array.from(new Set([...manualSet, up]));
    onChange({
      manual: nextManual,
      excluded,
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const addExcluded = (sym: string) => {
    const up = sym.toUpperCase();
    const nextExcluded = Array.from(new Set([...excludedSet, up]));
    onChange({
      manual,
      excluded: nextExcluded,
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const removeManual = (sym: string) => {
    const up = sym.toUpperCase();
    const nextManual = manual.filter((s) => s.toUpperCase() !== up);
    onChange({
      manual: nextManual,
      excluded,
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const removeExcluded = (sym: string) => {
    const up = sym.toUpperCase();
    const nextExcluded = excluded.filter((s) => s.toUpperCase() !== up);
    onChange({
      manual,
      excluded: nextExcluded,
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };

  const setLev = (sym: string, v: number) => {
    const up = sym.toUpperCase();
    onChange({
      manual,
      excluded,
      leverageOverrides: { ...leverageOverrides, [up]: v },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const setPos = (sym: string, v: 'long' | 'short' | 'both') => {
    const up = sym.toUpperCase();
    onChange({
      manual,
      excluded,
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}), [up]: v },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const setFeat = (sym: string, key: 'scaleIn' | 'exit' | 'stopLoss', v: boolean) => {
    const up = sym.toUpperCase();
    const prev = featureOverrides?.[up] ?? {};
    onChange({
      manual,
      excluded,
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}), [up]: { ...prev, [key]: v } }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
        <input
          placeholder="심볼 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-48 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-100"
        />
        <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
          <option value="alphabet">알파벳순</option>
          <option value="volume">거래량순</option>
          <option value="tradeValue">거래금액순</option>
          <option value="changeUp">상승률순</option>
          <option value="changeDown">하락률순</option>
        </select>
        {loading ? <span className="text-zinc-500">불러오는 중…</span> : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded border border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
            <span>심볼 목록</span>
            <span>{items.length} 종목</span>
          </div>
          <div className="max-h-64 overflow-auto">
            <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
              <colgroup>
                <col className="w-24" />
                <col />
                <col className="w-20" />
              </colgroup>
              <tbody>
                {items.map((t) => {
                  const sym = `${t.base}/${t.quote}`;
                  const inSel = manualSet.has(sym);
                  const inEx = excludedSet.has(sym);
                  return (
                    <tr key={sym} className="border-b border-zinc-800">
                      <td className="px-2 py-1 text-zinc-400">{sym}</td>
                      <td className="px-2 py-1 text-zinc-500">vol {Math.round(t.volume ?? 0)}</td>
                      <td className="px-2 py-1">
                        {!inSel ? (
                          <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300" onClick={() => addManual(sym)}>
                            추가
                          </button>
                        ) : (
                          <button className="rounded border border-rose-600 px-2 py-0.5 text-rose-300" onClick={() => removeManual(sym)}>
                            제거
                          </button>
                        )}
                        {!inEx ? (
                          <button className="ml-1 rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={() => addExcluded(sym)}>
                            제외
                          </button>
                        ) : (
                          <button className="ml-1 rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={() => removeExcluded(sym)}>
                            제외해제
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="space-y-3">
          <div className="rounded border border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
              <span>선택 종목</span>
              <span>{manual.length} 개</span>
            </div>
            <div className="max-h-40 overflow-auto">
              <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
                <colgroup>
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="px-2 py-1">심볼</th>
                    <th className="px-2 py-1">레버</th>
                    <th className="px-2 py-1">포지션</th>
                    <th className="px-2 py-1">추가</th>
                    <th className="px-2 py-1">매도</th>
                    <th className="px-2 py-1">손절</th>
                  </tr>
                </thead>
                <tbody>
                  {manual.map((sym) => {
                    const up = sym.toUpperCase();
                    const lev = leverageOverrides[up] ?? 0;
                    const pos = (positionOverrides ?? {})[up] ?? 'long';
                    const feat = (featureOverrides ?? {})[up] ?? {};
                    return (
                      <tr key={sym} className="border-b border-zinc-800">
                        <td className="px-2 py-1">{sym}</td>
                        <td className="px-2 py-1">
                          <input
                            type="number"
                            min={0}
                            max={125}
                            value={lev}
                            onChange={(e) => setLev(sym, Math.max(0, Math.min(125, Number(e.target.value) || 0)))}
                            className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <select value={pos} onChange={(e) => setPos(sym, e.target.value as any)} className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">
                            <option value="long">롱</option>
                            <option value="short">숏</option>
                            <option value="both">양방향</option>
                          </select>
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input type="checkbox" checked={!!feat.scaleIn} onChange={(e) => setFeat(sym, 'scaleIn', e.target.checked)} />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input type="checkbox" checked={!!feat.exit} onChange={(e) => setFeat(sym, 'exit', e.target.checked)} />
                        </td>
                        <td className="px-2 py-1 text-center">
                          <input type="checkbox" checked={!!feat.stopLoss} onChange={(e) => setFeat(sym, 'stopLoss', e.target.checked)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
              <span>제외 종목</span>
              <span>{excluded.length} 개</span>
            </div>
            <div className="max-h-32 overflow-auto">
              <ul className="divide-y divide-zinc-800 text-[11px] text-zinc-300">
                {excluded.map((sym) => (
                  <li key={sym} className="flex items-center justify-between px-2 py-1">
                    <span>{sym}</span>
                    <button className="rounded border border-zinc-700 px-2 py-0.5" onClick={() => removeExcluded(sym)}>
                      제거
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

