"use client";

import { useEffect, useMemo, useState } from 'react';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

type SortMode = 'alphabet' | 'volume' | 'tradeValue' | 'changeUp' | 'changeDown';

export function SymbolsPickerPanel({
  quote,
  onChangeQuote,
  symbolCount,
  manual,
  excluded,
  excludedReasons,
  leverageOverrides,
  positionOverrides,
  featureOverrides,
  onChange
}: {
  quote: QuoteCurrency;
  onChangeQuote: (q: QuoteCurrency) => void;
  symbolCount: number;
  manual: string[];
  excluded: string[];
  excludedReasons: Record<string, string>;
  leverageOverrides: Record<string, number>;
  positionOverrides?: Record<string, 'long' | 'short' | 'both'>;
  featureOverrides?: Record<string, { scaleIn?: boolean; exit?: boolean; stopLoss?: boolean }>;
  onChange: (next: {
    manual: string[];
    excluded: string[];
    excludedReasons: Record<string, string>;
    leverageOverrides: Record<string, number>;
    positionOverrides: Record<string, 'long' | 'short' | 'both'>;
    featureOverrides: Record<string, { scaleIn?: boolean; exit?: boolean; stopLoss?: boolean }>;
  }) => void;
}) {
  // 안전장치: API 실패 시 표시할 소규모 로컬 폴백 데이터
  const LOCAL_FALLBACK: TickerInfo[] = [
    { symbol: 'BTCUSDT', base: 'BTC', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'ETHUSDT', base: 'ETH', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'BNBUSDT', base: 'BNB', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'SOLUSDT', base: 'SOL', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'XRPUSDT', base: 'XRP', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'ADAUSDT', base: 'ADA', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'DOGEUSDT', base: 'DOGE', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'AVAXUSDT', base: 'AVAX', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'MATICUSDT', base: 'MATIC', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'LTCUSDT', base: 'LTC', quote: 'USDT', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'BTCUSDC', base: 'BTC', quote: 'USDC', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null },
    { symbol: 'ETHUSDC', base: 'ETH', quote: 'USDC', priceChangePercent: 0, volume: 0, quoteVolume: 0, listedDays: null }
  ];
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('alphabet');
  const [items, setItems] = useState<TickerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 제외 사유는 상위에서 관리/영속화
  // 좌측 필터 패널 상태(목록 표시 전용)
  const symbolsPrefs = useUIPreferencesStore((s) => s.getSymbolsPickerPrefs());
  const setSymbolsPrefs = useUIPreferencesStore((s) => s.updateSymbolsPickerPrefs);
  const [filterStable, setFilterStable] = useState<boolean>(symbolsPrefs.filters.filterStable);
  // 목록 표시 컬럼 토글
  const [colVol, setColVol] = useState<boolean>(symbolsPrefs.columns.vol);
  const [colVal, setColVal] = useState<boolean>(symbolsPrefs.columns.val);
  const [colChg, setColChg] = useState<boolean>(symbolsPrefs.columns.chg);
  const [colAge, setColAge] = useState<boolean>(symbolsPrefs.columns.age);
  const [order, setOrder] = useState<Array<'vol' | 'val' | 'chg' | 'age'>>((symbolsPrefs as any).columnsOrder ?? ['vol','val','chg','age']);
  const [widths, setWidths] = useState<Record<'vol'|'val'|'chg'|'age', number>>((symbolsPrefs as any).columnsWidth ?? { vol: 96, val: 96, chg: 96, age: 96 });
  const [hideUnknownListing, setHideUnknownListing] = useState<boolean>(symbolsPrefs.filters.hideUnknownListing);
  const [hideListingDays, setHideListingDays] = useState<number | null>(symbolsPrefs.filters.hideListingDays);

  // 변경 시 환경설정에 즉시 반영
  useEffect(() => {
    setSymbolsPrefs({
      columns: { vol: colVol, val: colVal, chg: colChg, age: colAge },
      filters: { filterStable, hideUnknownListing, hideListingDays },
      columnsOrder: order,
      columnsWidth: widths
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colVol, colVal, colChg, colAge, filterStable, hideUnknownListing, hideListingDays, order]);

  const labels: Record<'vol' | 'val' | 'chg' | 'age', string> = { vol: '거래량', val: '거래대금', chg: '변동률', age: '상장일수' };
  const enabled = { vol: colVol, val: colVal, chg: colChg, age: colAge } as Record<'vol'|'val'|'chg'|'age', boolean>;
  const move = (key: 'vol'|'val'|'chg'|'age', dir: 'left'|'right') => {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const j = dir === 'left' ? idx - 1 : idx + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      const [it] = next.splice(idx, 1);
      next.splice(j, 0, it as any);
      return next as any;
    });
  };

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      setError(null);
      const tryFetch = async (params: URLSearchParams): Promise<TickerInfo[] | null> => {
        try {
          const res = await fetch(`/api/markets?${params.toString()}`, { signal: controller.signal });
          if (!res.ok) return null;
          const ct = res.headers.get('content-type') || '';
          if (!ct.includes('application/json')) return null;
          const json = (await res.json()) as { items?: TickerInfo[] };
          if (!json?.items || !Array.isArray(json.items)) return null;
          return json.items;
        } catch {
          return null;
        }
      };

      const base = new URLSearchParams({ quote, sort, limit: '2000' });
      if (search.trim()) base.set('search', search.trim());
      let list = await tryFetch(base);
      if (!list || list.length === 0) {
        // fallback: try volume sort without search
        const alt = new URLSearchParams({ quote, sort: 'volume', limit: '2000' });
        list = await tryFetch(alt);
      }
      if (!aborted) {
        if (list && list.length > 0) {
          setItems(list);
        } else {
          // 마지막 폴백: 로컬 폴백 데이터 표시
          const fb = LOCAL_FALLBACK.filter((it) => it.quote === quote);
          setItems(fb);
          setError('시장 데이터를 불러오지 못해 기본 목록을 표시합니다.');
        }
      }
      if (!aborted) setLoading(false);
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
      excludedReasons: { ...excludedReasons },
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const addExcluded = (sym: string) => {
    const up = sym.toUpperCase();
    const nextExcluded = Array.from(new Set([...excludedSet, up]));
    const nextReasons = { ...excludedReasons, [up]: excludedReasons[up] ?? '수동제외' } as Record<string, string>;
    onChange({
      manual,
      excluded: nextExcluded,
      excludedReasons: nextReasons,
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
      excludedReasons: { ...excludedReasons },
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const removeExcluded = (sym: string) => {
    const up = sym.toUpperCase();
    const nextExcluded = excluded.filter((s) => s.toUpperCase() !== up);
    const { [up]: _removed, ...restReasons } = excludedReasons;
    onChange({
      manual,
      excluded: nextExcluded,
      excludedReasons: restReasons,
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
      excludedReasons: { ...excludedReasons },
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
      excludedReasons: { ...excludedReasons },
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: v === ('default' as any)
        ? (() => { const next = { ...(positionOverrides ?? {}) }; delete (next as any)[up]; return next; })()
        : { ...(positionOverrides ?? {}), [up]: v },
      featureOverrides: { ...(featureOverrides ?? {}) }
    });
  };
  const setFeat = (sym: string, key: 'scaleIn' | 'exit' | 'stopLoss', v: boolean | undefined) => {
    const up = sym.toUpperCase();
    const prev = featureOverrides?.[up] ?? {} as any;
    const nextFeat = { ...prev } as any;
    if (v === undefined) {
      delete nextFeat[key];
    } else {
      nextFeat[key] = v;
    }
    onChange({
      manual,
      excluded,
      excludedReasons: { ...excludedReasons },
      leverageOverrides: { ...leverageOverrides },
      positionOverrides: { ...(positionOverrides ?? {}) },
      featureOverrides: { ...(featureOverrides ?? {}), [up]: nextFeat }
    });
  };

  // 자동선택 실행: sortKey에 따라 상위/하위 목록을 가져와 선택/제외에 일괄 반영
  async function applyAuto(action: 'include' | 'exclude', sortKey: 'volume' | 'volume-bottom' | 'changeUp' | 'changeDown' | 'tradeValue' | 'tradeValue-bottom', n: number) {
    const mapSort: Record<string, string> = {
      volume: 'volume',
      'volume-bottom': 'volume',
      changeUp: 'changeUp',
      changeDown: 'changeDown',
      tradeValue: 'tradeValue',
      'tradeValue-bottom': 'tradeValue'
    };
    const res = await fetch(`/api/markets?${new URLSearchParams({ quote, sort: mapSort[sortKey], limit: '2000' }).toString()}`);
    if (!res.ok) return;
    const json = (await res.json()) as { items: TickerInfo[] };
    let list = json.items ?? [];
    if (sortKey.endsWith('bottom')) list = [...list].reverse();
    const picked = list.slice(0, Math.max(1, Math.min(1000, n)));
    const syms = picked.map((it) => `${it.base}/${it.quote}`);
    if (action === 'include') {
      const union = new Set<string>([...manual]);
      syms.forEach((s) => union.add(s));
      onChange({
        manual: Array.from(union),
        excluded,
        excludedReasons: { ...excludedReasons },
        leverageOverrides: { ...leverageOverrides },
        positionOverrides: { ...(positionOverrides ?? {}) },
        featureOverrides: { ...(featureOverrides ?? {}) }
      });
    } else {
      const union = new Set<string>([...excluded]);
      const reasonLabel = sortKey.includes('volume')
        ? '거래량'
        : sortKey.includes('tradeValue')
        ? '시가총액'
        : '일변동률';
      const nextReasons = { ...excludedReasons } as Record<string, string>;
      syms.forEach((s) => {
        union.add(s);
        nextReasons[s.toUpperCase()] = `자동선택:${reasonLabel} ${sortKey.endsWith('bottom') ? '하위' : sortKey === 'changeDown' ? '하락' : '상위'} ${n}`;
      });
      onChange({
        manual,
        excluded: Array.from(union),
        excludedReasons: nextReasons,
        leverageOverrides: { ...leverageOverrides },
        positionOverrides: { ...(positionOverrides ?? {}) },
        featureOverrides: { ...(featureOverrides ?? {}) }
      });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
        <label className="flex items-center gap-1">
          <span className="text-zinc-400">쿼트</span>
          <select value={quote} onChange={(e) => onChangeQuote(e.target.value as QuoteCurrency)} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
            <option value="USDT">USDT</option>
            <option value="USDC">USDC</option>
          </select>
        </label>
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
        <span className="ml-3 text-[11px] text-zinc-500">현재 선택 {manual.length}개 / 부족 {Math.max(0, symbolCount - manual.length)}개</span>
        {loading ? <span className="text-zinc-500">불러오는 중…</span> : null}
        {!loading && error ? <span className="text-amber-400">{error}</span> : null}
      </div>
      {/* 자동선택 블록 */}
      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300">
        <div className="grid gap-2 md:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 whitespace-nowrap">거래량순</span>
            <select id="auto-vol-mode" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
              <option value="top">상위</option>
              <option value="bottom">하위</option>
            </select>
            <input id="auto-vol-n" type="number" min="1" max="1000" defaultValue="10" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
            <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300" onClick={async () => await applyAuto('include', (document.getElementById('auto-vol-mode') as HTMLSelectElement).value === 'top' ? 'volume' : 'volume-bottom', Number((document.getElementById('auto-vol-n') as HTMLInputElement).value))}>선택 추가</button>
            <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={async () => await applyAuto('exclude', (document.getElementById('auto-vol-mode') as HTMLSelectElement).value === 'top' ? 'volume' : 'volume-bottom', Number((document.getElementById('auto-vol-n') as HTMLInputElement).value))}>제외 추가</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 whitespace-nowrap">일변동률</span>
            <select id="auto-chg-mode" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
              <option value="up">상승</option>
              <option value="down">하락</option>
            </select>
            <input id="auto-chg-n" type="number" min="1" max="1000" defaultValue="10" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
            <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300" onClick={async () => await applyAuto('include', (document.getElementById('auto-chg-mode') as HTMLSelectElement).value === 'up' ? 'changeUp' : 'changeDown', Number((document.getElementById('auto-chg-n') as HTMLInputElement).value))}>선택 추가</button>
            <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={async () => await applyAuto('exclude', (document.getElementById('auto-chg-mode') as HTMLSelectElement).value === 'up' ? 'changeUp' : 'changeDown', Number((document.getElementById('auto-chg-n') as HTMLInputElement).value))}>제외 추가</button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 whitespace-nowrap">시가총액</span>
            <select id="auto-cap-mode" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
              <option value="top">상위</option>
              <option value="bottom">하위</option>
            </select>
            <input id="auto-cap-n" type="number" min="1" max="1000" defaultValue="10" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
            <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300" onClick={async () => await applyAuto('include', (document.getElementById('auto-cap-mode') as HTMLSelectElement).value === 'top' ? 'tradeValue' : 'tradeValue-bottom', Number((document.getElementById('auto-cap-n') as HTMLInputElement).value))}>선택 추가</button>
            <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={async () => await applyAuto('exclude', (document.getElementById('auto-cap-mode') as HTMLSelectElement).value === 'top' ? 'tradeValue' : 'tradeValue-bottom', Number((document.getElementById('auto-cap-n') as HTMLInputElement).value))}>제외 추가</button>
          </div>
        </div>
      </div>
      {/* 상단: 목록 전체폭 */}
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* 좌측 필터 패널 */}
        <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300">
          <p className="mb-1 text-zinc-400">필터</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={filterStable} onChange={(e) => setFilterStable(e.target.checked)} />
              <span>스테이블 제외</span>
            </label>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <span className="text-zinc-400">표시 컬럼</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colVol} onChange={(e) => setColVol(e.target.checked)} />
                <span>거래량</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colVal} onChange={(e) => setColVal(e.target.checked)} />
                <span>거래대금</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colChg} onChange={(e) => setColChg(e.target.checked)} />
                <span>변동률</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colAge} onChange={(e) => setColAge(e.target.checked)} />
                <span>상장일수</span>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-zinc-400">표시 순서</span>
              {order.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-300">
                  {labels[k]}
                  <button className="rounded border border-zinc-700 px-1 text-zinc-400" onClick={() => move(k, 'left')} aria-label={`${labels[k]} 왼쪽으로`}>
                    ◀
                  </button>
                  <button className="rounded border border-zinc-700 px-1 text-zinc-400" onClick={() => move(k, 'right')} aria-label={`${labels[k]} 오른쪽으로`}>
                    ▶
                  </button>
                  {!enabled[k] ? <span className="text-zinc-500">(숨김)</span> : null}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-zinc-400">컬럼 너비(px)</span>
              {order.map((k) => (
                <label key={`w-${k}`} className="flex items-center gap-1 text-[10px] text-zinc-400">
                  <span>{labels[k]}</span>
                  <input
                    type="number"
                    min={64}
                    max={240}
                    value={widths[k]}
                    onChange={(e) => setWidths((prev) => ({ ...prev, [k]: Math.max(64, Math.min(240, Number(e.target.value) || 64)) }))}
                    className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-zinc-200"
                  />
                </label>
              ))}
            </div>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={hideUnknownListing} onChange={(e) => setHideUnknownListing(e.target.checked)} />
              <span>상장일 정보 없음 숨기기</span>
            </label>
            <label className="flex items-center gap-2">
              <span className="w-24 text-zinc-400">상장일 ≤(일)</span>
              <input type="number" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={hideListingDays ?? ''}
                onChange={(e) => setHideListingDays(e.target.value === '' ? null : Math.max(1, Math.min(1000, Number(e.target.value) || 1)))} />
            </label>
          </div>
        </div>

        {/* 심볼 목록 */}
        <div className="rounded border border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
            <span>심볼 목록</span>
            <span>{items.length} 종목</span>
          </div>
          <div className="max-h-64 overflow-auto overflow-x-auto">
            <table className="w-full min-w-[720px] table-fixed text-left text-[11px] text-zinc-300">
              <colgroup>
                <col className="w-28" />
                <col className="w-20" />
                <col className="w-24" />
                {order.map((k) => (
                  <col key={`col-${k}`} className="w-24" style={{ display: enabled[k] ? undefined : 'none', width: widths[k] }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="px-2 py-1">심볼</th>
                  <th className="px-2 py-1">베이스</th>
                  <th className="px-2 py-1">쿼트</th>
                  {order.map((k) => (
                    <th key={`head-${k}`} className="px-2 py-1" style={{ display: enabled[k] ? undefined : 'none' }}>{labels[k]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.filter((t) => {
                  // 좌측 필터 적용
                  if (filterStable) {
                    const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP','USTC']);
                    if (STABLES.has(t.base.toUpperCase())) return false;
                  }
                  const listed = (t as any).listedDays as number | null | undefined;
                  if (hideUnknownListing && listed == null) return false;
                  if (hideListingDays != null && typeof listed === 'number' && listed <= hideListingDays) return false;
                  return true;
                }).map((t) => {
                  const sym = `${t.base}/${t.quote}`;
                  const inSel = manualSet.has(sym);
                  const inEx = excludedSet.has(sym);
                  return (
                    <tr key={sym} className="border-b border-zinc-800">
                      <td className="px-2 py-1 text-zinc-300">{sym}</td>
                      <td className="px-2 py-1 text-zinc-400">{t.base}</td>
                      <td className="px-2 py-1 text-zinc-400">{t.quote}</td>
                      {order.map((k) => (
                        <td key={`cell-${sym}-${k}`} className="px-2 py-1 text-zinc-500" style={{ display: enabled[k] ? undefined : 'none' }}>
                          {k === 'vol' ? `vol ${Math.round(t.volume ?? 0)}` :
                           k === 'val' ? `val ${Math.round(t.quoteVolume ?? 0)}` :
                           k === 'chg' ? `chg ${Number(t.priceChangePercent ?? 0).toFixed(2)}%` :
                           (t.listedDays != null ? `${t.listedDays}d` : '-')}
                        </td>
                      ))}
                      <td className="px-2 py-1 space-x-1">
                        {inSel ? (
                          <button className="rounded border border-rose-600 px-2 py-0.5 text-rose-300" onClick={() => removeManual(sym)}>
                            제거
                          </button>
                        ) : (
                          <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300" onClick={() => addManual(sym)}>
                            추가
                          </button>
                        )}
                        {inEx ? (
                          <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={() => removeExcluded(sym)}>
                            제외해제
                          </button>
                        ) : (
                          <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={() => addExcluded(sym)}>
                            제외
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
      </div>

      {/* 하단: 선택/제외 표 (위/아래 스택) */}
      <div className="space-y-3">
        <div className="space-y-3">
          <div className="rounded border border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-400">
              <span>선택 종목</span>
              <span>{manual.length} 개</span>
            </div>
            <div className="max-h-40 overflow-auto">
              <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
                <colgroup>
                  <col className="w-32" />
                  <col className="w-40" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="px-2 py-1">심볼</th>
                    <th className="px-2 py-1">레버</th>
                    <th className="px-2 py-1">포지션</th>
                    <th className="px-2 py-1">추가</th>
                    <th className="px-2 py-1">매도</th>
                    <th className="px-2 py-1">손절</th>
                    <th className="px-2 py-1"> </th>
                  </tr>
                </thead>
                <tbody>
                  {manual.map((sym) => {
                    const up = sym.toUpperCase();
                    const lev = leverageOverrides[up] ?? 0;
                    const pos = ((positionOverrides ?? {})[up] ?? 'default') as any;
                    const feat = (featureOverrides ?? {})[up] ?? {};
                    return (
                      <tr key={sym} className="border-b border-zinc-800">
                        <td className="px-2 py-1.5 whitespace-nowrap">{sym}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <select
                              value={lev > 0 ? 'custom' : 'default'}
                              onChange={(e) => setLev(sym, e.target.value === 'custom' ? (lev || 5) : 0)}
                              className="min-w-[88px] rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                            >
                              <option value="default">기본설정</option>
                              <option value="custom">직접입력</option>
                            </select>
                            {lev > 0 ? (
                              <input
                                type="number"
                                min={1}
                                max={125}
                                value={lev}
                                onChange={(e) => setLev(sym, Math.max(1, Math.min(125, Number(e.target.value) || 1)))}
                                className="w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select value={pos} onChange={(e) => setPos(sym, e.target.value as any)} className="min-w-[100px] rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5">
                            <option value="default">기본</option>
                            <option value="long">롱</option>
                            <option value="short">숏</option>
                            <option value="both">양방향</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select
                            value={feat.scaleIn === false ? 'exclude' : 'default'}
                            onChange={(e) => setFeat(sym, 'scaleIn', e.target.value === 'exclude' ? false : undefined)}
                            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          >
                            <option value="default">기본</option>
                            <option value="exclude">제외</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select
                            value={feat.exit === false ? 'exclude' : 'default'}
                            onChange={(e) => setFeat(sym, 'exit', e.target.value === 'exclude' ? false : undefined)}
                            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          >
                            <option value="default">기본</option>
                            <option value="exclude">제외</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select
                            value={feat.stopLoss === false ? 'exclude' : 'default'}
                            onChange={(e) => setFeat(sym, 'stopLoss', e.target.value === 'exclude' ? false : undefined)}
                            className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          >
                            <option value="default">기본</option>
                            <option value="exclude">제외</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <button className="rounded border border-rose-600 px-2 py-0.5 text-rose-300" onClick={() => removeManual(sym)}>
                            제거
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
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
                    <span>
                      {sym}
                      {excludedReasons[sym.toUpperCase()] ? (
                        <span className="ml-2 rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">
                          {excludedReasons[sym.toUpperCase()]}
                        </span>
                      ) : null}
                    </span>
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
  );
}
