"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { normalizeSymbol } from '@/lib/trading/symbols';
import { applyAutoSelectionRules } from '@/lib/trading/autoFill';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

// Local fallback market list for resilience when API fails
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

type SortMode = 'alphabet' | 'tradeValue' | 'changeUp' | 'changeDown';
const MAX_AUTO_RULES = 10;

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
  onChange,
  errors,
  rules,
  onSetRule,
  onClearRule,
  onClearAllRules,
  onClearMaxListingAgeDays
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
  errors?: { manualSymbols?: string; excludedSymbols?: string; leverageOverrides?: string };
  rules: {
    ranking: { volume?: number | null; market_cap?: number | null; top_gainers?: number | null; top_losers?: number | null };
    excludeTopGainers?: number | null;
    excludeTopLosers?: number | null;
    maxListingAgeDays?: number | null;
    excludeBottomVolume?: number | null;
    excludeBottomMarketCap?: number | null;
  };
  onSetRule: (
    action: 'include' | 'exclude',
    key: 'volume' | 'volume-bottom' | 'changeUp' | 'changeDown' | 'tradeValue' | 'tradeValue-bottom',
    n: number
  ) => void;
  onClearRule: (
    kind: 'ranking' | 'exclude',
    field: 'volume' | 'market_cap' | 'top_gainers' | 'top_losers' | 'bottom_volume' | 'bottom_market_cap'
  ) => void;
  onClearAllRules: () => void;
  onClearMaxListingAgeDays: () => void;
}) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortMode>('alphabet');
  const [items, setItems] = useState<TickerInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 심볼별 최대 레버리지 맵 (예: BTCUSDT -> 125)
  const [levMaxMap, setLevMaxMap] = useState<Record<string, number>>({});
  // 제외 사유는 상위에서 관리/영속화
  // 좌측 필터 패널 상태(목록 표시 전용)
  const rawPrefs = useUIPreferencesStore((s) => s.autoTrading?.symbolsPicker);
  const symbolsPrefs = rawPrefs ?? {
    columns: { vol: true, val: true, chg: true, age: true },
    filters: { filterStable: true, hideUnknownListing: false, hideListingDays: null },
    columnsOrder: ['vol', 'val', 'chg', 'age'] as Array<'vol'|'val'|'chg'|'age'>,
    columnsWidth: { vol: 96, val: 96, chg: 96, age: 96 } as Record<'vol'|'val'|'chg'|'age', number>
  };
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

  // 변경 시 환경설정을 동기화합니다.
  // - 렌더 중 호출될 수 있는 setState(updater) 내부에서는 side-effect를 피합니다.
  // - 너비/표시순서는 이펙트로 저장해 안전하게 동기화합니다.
  useEffect(() => {
    setSymbolsPrefs({ columnsWidth: widths as any });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widths]);
  useEffect(() => {
    setSymbolsPrefs({ columnsOrder: order as any });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  const labels: Record<'vol' | 'val' | 'chg' | 'age', string> = { vol: '현재가', val: '거래대금', chg: '변동률', age: '상장일수' };
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
        // fallback: try tradeValue sort without search
        const alt = new URLSearchParams({ quote, sort: 'tradeValue', limit: '2000' });
        list = await tryFetch(alt);
      }
      if (!aborted) {
        if (list && list.length > 0) {
          setItems(list);
        } else {
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

  // 선물 메타(최대 레버리지) 불러오기
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/trading/binance/futures-symbols');
        if (!res.ok) return;
        const json = (await res.json()) as { markets?: Array<{ symbol: string; base: string; quote: string; leverageBrackets?: Array<{ maxLeverage?: number | null }> }> };
        const list = Array.isArray(json?.markets) ? json.markets : [];
        const map: Record<string, number> = {};
        list
          .filter((m) => (m?.quote ?? '').toUpperCase() === quote)
          .forEach((m) => {
            const norm = normalizeSymbol(`${m.base}/${m.quote}`, quote);
            const maxLev = (Array.isArray(m?.leverageBrackets) ? m.leverageBrackets : []).reduce((acc, t: any) => {
              const lv = Number(t?.maxLeverage ?? 0) || 0;
              return Math.max(acc, lv);
            }, 0);
            if (norm) map[norm] = maxLev || 0;
          });
        if (!cancelled) setLevMaxMap(map);
      } catch {
        if (!cancelled) setLevMaxMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [quote]);

  const filteredItems = useMemo(() => {
    return items.filter((t) => {
      if (filterStable) {
        const STABLES = new Set(['USDT','USDC','BUSD','DAI','TUSD','FDUSD','USDP','USTC']);
        if (STABLES.has(t.base.toUpperCase())) return false;
      }
      const listed = (t as any).listedDays as number | null | undefined;
      if (hideUnknownListing && listed == null) return false;
      if (hideListingDays != null && typeof listed === 'number' && listed <= hideListingDays) return false;
      return true;
    });
  }, [items, filterStable, hideUnknownListing, hideListingDays]);

  const manualSet = useMemo(() => new Set(manual.map((s) => normalizeSymbol(s, quote))), [manual, quote]);
  const excludedSet = useMemo(() => new Set(excluded.map((s) => normalizeSymbol(s, quote))), [excluded, quote]);
  const preview = useMemo(() => {
    try {
      const settingsLike: any = {
        symbolSelection: {
          ranking: rules?.ranking || {},
          excludeTopGainers: rules?.excludeTopGainers || null,
          excludeTopLosers: rules?.excludeTopLosers || null,
          excludeBottomMarketCap: (rules as any)?.excludeBottomMarketCap ?? null
        }
      };
      const res = applyAutoSelectionRules(settingsLike, items);
      const inc = new Set(res.include.map((s) => normalizeSymbol(s, quote)));
      const exc = new Set(res.exclude.map((s) => normalizeSymbol(s, quote)));
      // manual precedence
      for (const s of manualSet) exc.delete(s);
      for (const s of excludedSet) inc.delete(s);
      // rule conflict: exclude wins
      for (const s of Array.from(inc)) if (exc.has(s)) inc.delete(s);
      let includeAdds = 0;
      for (const s of inc) if (!manualSet.has(s)) includeAdds++;
      let excludeAdds = 0;
      for (const s of exc) if (!excludedSet.has(s)) excludeAdds++;
      return { includeAdds, excludeAdds };
    } catch {
      return { includeAdds: 0, excludeAdds: 0 };
    }
  }, [rules, items, manualSet, excludedSet, quote]);

  const addManual = (sym: string) => {
    const up = normalizeSymbol(sym, quote);
    if (!up) return;
    const nextManual = Array.from(new Set([...manual, up]));
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
    const up = normalizeSymbol(sym, quote);
    if (!up) return;
    const nextExcluded = Array.from(new Set([...excluded, up]));
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
    const up = normalizeSymbol(sym, quote);
    const nextManual = manual.filter((s) => normalizeSymbol(s, quote) !== up);
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
    const up = normalizeSymbol(sym, quote);
    const nextExcluded = excluded.filter((s) => normalizeSymbol(s, quote) !== up);
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
  const clearLev = (sym: string) => {
    const up = sym.toUpperCase();
    const next = { ...leverageOverrides } as Record<string, number>;
    delete (next as any)[up];
    onChange({
      manual,
      excluded,
      excludedReasons: { ...excludedReasons },
      leverageOverrides: next,
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
    const syms = picked.map((it) => normalizeSymbol(`${it.base}/${it.quote}`, quote));
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
        nextReasons[s] = `자동선택:${reasonLabel} ${sortKey.endsWith('bottom') ? '하위' : sortKey === 'changeDown' ? '하락' : '상위'} ${n}`;
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

  // local rules limit check; call parent to mutate draft only when allowed
  const [ruleMsg, setRuleMsg] = useState<string | null>(null);
  const showRuleMsg = (msg: string) => {
    setRuleMsg(msg);
    try {
      // auto clear after 3s
      setTimeout(() => setRuleMsg((cur) => (cur === msg ? null : cur)), 3000);
    } catch {}
  };
  const setAutoRule = (action: 'include' | 'exclude', key: 'volume' | 'volume-bottom' | 'changeUp' | 'changeDown' | 'tradeValue' | 'tradeValue-bottom', n: number) => {
    const r = (rules?.ranking ?? {}) as any;
    const eg = rules?.excludeTopGainers as number | null | undefined;
    const el = rules?.excludeTopLosers as number | null | undefined;
    // 현재 활성 규칙 수 집계(포함 우선순위 + 제외 규칙 통합)
    const isActive = (v: any) => typeof v === 'number' && v !== 0;
    const includeCount = Number(isActive(r.market_cap) && (r.market_cap as number) > 0)
      + Number(isActive(r.top_gainers) && (r.top_gainers as number) > 0)
      + Number(isActive(r.top_losers) && (r.top_losers as number) > 0);
    const excludeCount = Number(typeof rules?.excludeBottomMarketCap === 'number' && (rules?.excludeBottomMarketCap as number) > 0)
      + Number(typeof eg === 'number' && eg > 0)
      + Number(typeof el === 'number' && el > 0);
    const totalCount = includeCount + excludeCount;

    // 추가될 대상 필드가 신규 규칙인지 판별
    const willCreateNewRule = (() => {
      if (key === 'changeUp') return !(typeof eg === 'number' && eg > 0) && action === 'exclude';
      if (key === 'changeDown') return !(typeof el === 'number' && el > 0) && action === 'exclude';
      if (key === 'tradeValue') return !(typeof r.market_cap === 'number' && r.market_cap > 0) && action === 'include';
      if (key === 'tradeValue-bottom') return !(typeof rules?.excludeBottomMarketCap === 'number' && (rules?.excludeBottomMarketCap as number) > 0) && action === 'exclude';
      return false;
    })();
    if (willCreateNewRule && totalCount >= MAX_AUTO_RULES) {
      showRuleMsg(`자동선택 규칙은 포함+제외 합산 최대 ${MAX_AUTO_RULES}개까지 설정할 수 있습니다.`);
      return;
    }

    onSetRule(action, key, n);
  };

  // Visualize current rules
  const clearRule = useCallback(onClearRule, [onClearRule]);
  const clearAllRules = () => { onClearAllRules(); };
  const ruleBadges = useMemo(() => {
    type Badge = { key: string; label: string; onClear: () => void; kind: 'include' | 'exclude'; icon: string };
    const includes: Badge[] = [];
    const excludes: Badge[] = [];
    const r = rules?.ranking || {};
    // Priority order for includes: volume -> market_cap -> top_gainers -> top_losers
    // 거래량 관련 규칙은 표시하지 않음 (요청 사항)
    if (typeof r.market_cap === 'number' && r.market_cap !== 0) {
      if (r.market_cap > 0) includes.push({ key: 'r-cap', label: `시가총액 상위 ${r.market_cap}`, onClear: () => clearRule('ranking', 'market_cap'), kind: 'include', icon: '💰' });
    }
    if (typeof r.top_gainers === 'number' && r.top_gainers > 0) includes.push({ key: 'r-g', label: `상승률 상위 ${r.top_gainers}`, onClear: () => clearRule('ranking', 'top_gainers'), kind: 'include', icon: '📈' });
    if (typeof r.top_losers === 'number' && r.top_losers > 0) includes.push({ key: 'r-l', label: `하락률 상위 ${r.top_losers}`, onClear: () => clearRule('ranking', 'top_losers'), kind: 'include', icon: '↘︎' });
    const eg = rules?.excludeTopGainers;
    const el = rules?.excludeTopLosers;
    if (typeof eg === 'number' && eg > 0) excludes.push({ key: 'x-g', label: `상승률 제외 상위 ${eg}`, onClear: () => clearRule('exclude', 'top_gainers'), kind: 'exclude', icon: '🚫' });
    if (typeof el === 'number' && el > 0) excludes.push({ key: 'x-l', label: `하락률 제외 상위 ${el}`, onClear: () => clearRule('exclude', 'top_losers'), kind: 'exclude', icon: '🚫' });
    const ebm = (rules as any)?.excludeBottomMarketCap as number | null | undefined;
    if (typeof ebm === 'number' && ebm > 0) excludes.push({ key: 'x-cap-bot', label: `시가총액 하위 ${ebm} 제외`, onClear: () => clearRule('exclude', 'bottom_market_cap'), kind: 'exclude', icon: '📉' });

    // 상장일 기반 제외 규칙 표시(설정/환경설정 반영)
    const maxDays = rules?.maxListingAgeDays as number | null | undefined;
    if (typeof maxDays === 'number' && maxDays > 0) {
      excludes.push({
        key: 'x-age',
        label: `상장 ≤ ${maxDays}일 제외`,
        onClear: () => onClearMaxListingAgeDays(),
        kind: 'exclude',
        icon: '🗓️'
      });
    }
    if (hideUnknownListing) {
      excludes.push({
        key: 'x-unknown-age',
        label: '상장일 정보 없음 제외',
        onClear: () => setSymbolsPrefs({ filters: { hideUnknownListing: false } as any }),
        kind: 'exclude',
        icon: '❓'
      });
    }
    return { includes, excludes };
  }, [rules, hideUnknownListing, setSymbolsPrefs, clearRule, onClearMaxListingAgeDays]);

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
          <option value="tradeValue">거래대금순</option>
          <option value="changeUp">상승률순</option>
          <option value="changeDown">하락률순</option>
        </select>
        <span className="ml-3 text-[11px] text-zinc-500">현재 선택 {manual.length}개 / 부족 {Math.max(0, symbolCount - manual.length)}개</span>
        {loading ? <span className="text-zinc-500">불러오는 중…</span> : null}
        {!loading && error ? <span className="text-amber-400">{error}</span> : null}
      </div>
      {/* 자동선택 블록: 선택 종목 위로 이동 (모달 실행 시 자동 채움 규칙으로 동작) */}
      {/* 상단: 목록 전체폭 */}
      <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)]">
        {/* 좌측 필터 패널 */}
        <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300">
          <p className="mb-1 font-medium text-zinc-300">필터</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4" checked={filterStable} onChange={(e) => { const v = e.target.checked; setFilterStable(v); setSymbolsPrefs({ filters: { filterStable: v } as any }); }} />
              <span>스테이블 제외</span>
            </label>
            <div className="mt-2 border-t border-zinc-800 pt-2" />
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-zinc-400">표시 컬럼</span>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colVal} onChange={(e) => { const v = e.target.checked; setColVal(v); setSymbolsPrefs({ columns: { val: v } as any }); }} />
                <span>거래대금</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colChg} onChange={(e) => { const v = e.target.checked; setColChg(v); setSymbolsPrefs({ columns: { chg: v } as any }); }} />
                <span>변동률</span>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" className="h-4 w-4" checked={colAge} onChange={(e) => { const v = e.target.checked; setColAge(v); setSymbolsPrefs({ columns: { age: v } as any }); }} />
                <span>상장일수</span>
              </label>
            </div>
            {/* 표시 순서/컬럼 너비 조정 UI는 심볼 목록 상단/헤더로 이동 */}
            <div className="mt-2 border-t border-zinc-800 pt-2" />
            <div className="space-y-2">
              <div className="text-zinc-400">상장일 필터</div>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={hideUnknownListing} onChange={(e) => { const v = e.target.checked; setHideUnknownListing(v); setSymbolsPrefs({ filters: { hideUnknownListing: v } as any }); }} />
                <span>상장일 정보 없음 숨기기</span>
              </label>
              <label className="flex items-center gap-2">
                <span className="w-24 text-zinc-400">상장일 ≤(일)</span>
                <input type="number" className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={hideListingDays ?? ''}
                  onChange={(e) => { const v = e.target.value === '' ? null : Math.max(1, Math.min(1000, Number(e.target.value) || 1)); setHideListingDays(v); setSymbolsPrefs({ filters: { hideListingDays: v as any } as any }); }} />
              </label>
            </div>
          </div>
        </div>

        {/* 심볼 목록 */}
        <div className="rounded border border-zinc-800 bg-zinc-950/60">
          <div className="border-b border-zinc-800 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-200">심볼 목록</span>

              {/* 표시 순서 조정 - 개선된 UI */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-zinc-500">컬럼 순서:</span>
                <div className="flex items-center gap-1">
                  {order.map((k, idx) => (
                    <div key={`ctrl-${k}`} className="flex items-center gap-0.5 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                      <span className="text-[11px] text-zinc-300">{labels[k]}</span>
                      <div className="flex gap-0.5 ml-1">
                        <button
                          className="rounded px-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                          onClick={() => { move(k, 'left'); }}
                          disabled={idx === 0}
                          aria-label={`${labels[k]} 왼쪽으로`}
                          title="왼쪽으로 이동"
                        >
                          ◀
                        </button>
                        <button
                          className="rounded px-1 text-[10px] text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-zinc-400"
                          onClick={() => { move(k, 'right'); }}
                          disabled={idx === order.length - 1}
                          aria-label={`${labels[k]} 오른쪽으로`}
                          title="오른쪽으로 이동"
                        >
                          ▶
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <span className="text-[11px] text-zinc-400">{filteredItems.length} 종목</span>
            </div>
          </div>
          {/* 드래그 리사이즈 안내 (모바일 숨김) */}
          <div className="hidden border-b border-zinc-800 px-2 py-1 text-[10px] text-zinc-500 sm:block">컬럼 헤더 오른쪽 경계를 드래그해 너비를 조정할 수 있습니다.</div>
          <div className="max-h-64 overflow-auto overflow-x-auto">
              <table className="w-full min-w-[720px] table-fixed text-left text-[11px] text-zinc-300 select-none">
              <colgroup>
                <col className="w-28" />
                <col className="w-24" />
                {order.map((k) => (
                  <col key={`col-${k}`} className="w-24" style={{ display: enabled[k] ? undefined : 'none', width: widths[k] }} />
                ))}
                <col className="w-24" />
              </colgroup>
              <thead className="sticky top-0 bg-zinc-950">
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="px-2 py-1">심볼</th>
                  <th className="px-2 py-1">쿼트</th>
                  {order.map((k) => (
                    <th key={`head-${k}`} className="relative px-2 py-1" style={{ display: enabled[k] ? undefined : 'none' }}>
                      {labels[k]}
                      <span
                        onMouseDown={(e) => {
                          const startX = e.clientX;
                          const start = widths[k];
                          const onMove = (ev: MouseEvent) => {
                            const dx = ev.clientX - startX;
                            const nextW = Math.max(64, Math.min(240, start + dx));
                            setWidths((prev) => (prev[k] === nextW ? prev : ({ ...prev, [k]: nextW } as any)));
                          };
                          const onUp = () => {
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-transparent"
                        title="드래그하여 너비 조정"
                      />
                    </th>
                  ))}
                  <th className="px-2 py-1">최대 레버리지</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((t) => {
                  const sym = `${t.base}/${t.quote}`;
                  const norm = normalizeSymbol(sym, quote);
                  const inSel = manualSet.has(norm);
                  const inEx = excludedSet.has(norm);
                  return (
                    <tr key={sym} className="border-b border-zinc-800">
                      <td className="px-2 py-1 text-zinc-300">{sym}</td>
                      <td className="px-2 py-1 text-zinc-400">{t.quote}</td>
                      {order.map((k) => {
                        const listed = (t as any).listedDays as number | null | undefined;
                        const chg = Number(t.priceChangePercent ?? 0);
                        const chgIcon = chg > 0 ? '▲' : chg < 0 ? '▼' : '•';
                        const chgClass = chg > 0 ? 'text-emerald-400' : chg < 0 ? 'text-rose-400' : 'text-zinc-400';
                        return (
                          <td key={`cell-${sym}-${k}`} className="px-2 py-1 text-zinc-500" style={{ display: enabled[k] ? undefined : 'none' }}>
                            {k === 'vol' ? (
                              (() => {
                                const vol = Number(t.volume ?? 0);
                                const qv = Number(t.quoteVolume ?? 0);
                                const p = vol > 0 ? qv / vol : NaN;
                                const display = isFinite(p) && p > 0 ? p.toFixed(4) : '-';
                                return <span className={chgClass}>{display}</span>;
                              })()
                            ) : k === 'val' ? (
                              (() => {
                                const qv = Number(t.quoteVolume ?? 0);
                                return qv > 0 ? Intl.NumberFormat('en-US', { notation: 'compact' }).format(qv) : '-';
                              })()
                            ) : k === 'chg' ? (
                              <span className={chgClass}>
                                <span className="mr-1 align-middle">{chgIcon}</span>
                                {chg.toFixed(2)}%
                              </span>
                            ) : (
                              listed != null ? `${listed}일` : '-'
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-zinc-400">{levMaxMap[norm] ?? '-'}</td>
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
        {/* 중간 안내 문구 */}
        <div className="mt-2 px-3 py-2 text-[12px] font-semibold text-emerald-200 rounded border border-emerald-800/50 bg-emerald-950/40">
          종목 세부 설정 - 기본설정보다 우선 적용됩니다.
        </div>
      </div>

      {/* 하단: 자동선택 블록 (선택 종목 위) */}
      <div className="rounded border border-zinc-800 bg-zinc-950/60 p-2 text-[11px] text-zinc-300">
          <div className="mb-1 flex items-center justify-between text-zinc-400">
            <span>자동선택 규칙(자동매매 실행 시 적용)</span>
            <div className="flex items-center gap-2">
          <span className={`text-[10px] ${((ruleBadges.includes.length + ruleBadges.excludes.length) >= MAX_AUTO_RULES ? 'text-amber-300' : 'text-zinc-500')}`}>
            합계 {ruleBadges.includes.length + ruleBadges.excludes.length} / {MAX_AUTO_RULES}
          </span>
          <span className="text-[10px] text-zinc-500">미리보기: +{preview.includeAdds} / 제외 +{preview.excludeAdds}</span>
              <button
                type="button"
                onClick={() => {
                  // 적용: 현재 규칙을 기준으로 manual/excluded 리스트 즉시 갱신
                  try {
                    const settingsLike: any = { symbolSelection: { ranking: rules?.ranking || {}, excludeTopGainers: rules?.excludeTopGainers || null, excludeTopLosers: rules?.excludeTopLosers || null, excludeBottomVolume: (rules as any)?.excludeBottomVolume ?? null, excludeBottomMarketCap: (rules as any)?.excludeBottomMarketCap ?? null } };
                    const res = applyAutoSelectionRules(settingsLike, items);
                    const incSet = new Set(res.include.map((s) => normalizeSymbol(s, quote)));
                    const excSet = new Set(res.exclude.map((s) => normalizeSymbol(s, quote)));
                    const manualNow = new Set((manual || []).map((s) => normalizeSymbol(s, quote)));
                    const excludedNow = new Set((excluded || []).map((s) => normalizeSymbol(s, quote)));
                    // 수동 우선: 수동 선택은 규칙 제외에도 유지, 수동 제외는 규칙 포함에도 제외
                    for (const s of manualNow) excSet.delete(s);
                    for (const s of excludedNow) incSet.delete(s);
                    // 규칙 간 충돌: 제외 우선
                    for (const s of incSet) if (excSet.has(s)) incSet.delete(s);
                    const nextManual = Array.from(new Set([...(manual || []), ...Array.from(incSet)]));
                    const nextExcluded = Array.from(new Set([...(excluded || []), ...Array.from(excSet)]));
                    const nextReasons = { ...excludedReasons } as Record<string, string>;
                    Array.from(excSet).forEach((s) => { if (!nextReasons[s]) nextReasons[s] = '자동선택: 규칙 적용'; });
                    onChange({
                      manual: nextManual,
                      excluded: nextExcluded,
                      excludedReasons: nextReasons,
                      leverageOverrides: { ...leverageOverrides },
                      positionOverrides: { ...(positionOverrides ?? {}) },
                      featureOverrides: { ...(featureOverrides ?? {}) }
                    });
                    showRuleMsg('규칙을 현재 목록에 적용했습니다. 저장하면 영구 반영됩니다.');
                  } catch {
                    showRuleMsg('규칙 적용 중 오류가 발생했습니다.');
                  }
                }}
                className="rounded border border-emerald-700 px-2 py-0.5 text-[10px] text-emerald-200 hover:bg-emerald-900/30"
                title="현재 규칙을 선택/제외 목록에 반영합니다"
              >
                규칙 적용
              </button>
              <button
                type="button"
                onClick={clearAllRules}
                disabled={ruleBadges.includes.length + ruleBadges.excludes.length === 0}
                className="rounded border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-rose-600/60 hover:text-rose-300 disabled:opacity-50"
                title="모든 자동선택/제외 규칙을 해제합니다"
              >
                모두 해제
              </button>
            </div>
          </div>
        {ruleMsg ? (
          <div className="fixed bottom-4 right-4 z-50 rounded border border-amber-600/60 bg-amber-950/80 px-3 py-2 text-[12px] text-amber-200 shadow-lg">
            {ruleMsg}
          </div>
        ) : null}
        <div className="grid gap-2 md:grid-cols-3">
          {/* 거래량 규칙 제거 요청에 따라 블록 삭제됨 */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 whitespace-nowrap mr-1">일변동률</span>
            <select id="auto-chg-mode" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
              <option value="up">상승</option>
              <option value="down">하락</option>
            </select>
            <input id="auto-chg-n" type="number" min="1" max="1000" defaultValue="10" className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
            <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300" onClick={() => setAutoRule('include', (document.getElementById('auto-chg-mode') as HTMLSelectElement).value === 'up' ? 'changeUp' : 'changeDown', Number((document.getElementById('auto-chg-n') as HTMLInputElement).value))}>선택 추가</button>
            <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300" onClick={() => setAutoRule('exclude', (document.getElementById('auto-chg-mode') as HTMLSelectElement).value === 'up' ? 'changeUp' : 'changeDown', Number((document.getElementById('auto-chg-n') as HTMLInputElement).value))}>제외 추가</button>
          </div>
          <div className="flex items-center gap-2 flex-nowrap">
            <span className="text-zinc-400 whitespace-nowrap mr-1">거래대금</span>
            <select id="auto-tradevalue-mode" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 shrink-0">
              <option value="top">상위</option>
              <option value="bottom">하위</option>
            </select>
            <input id="auto-tradevalue-n" type="number" min="1" max="1000" defaultValue="10" className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-right" />
            <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300 shrink-0" onClick={() => setAutoRule('include', (document.getElementById('auto-tradevalue-mode') as HTMLSelectElement).value === 'top' ? 'tradeValue' : 'tradeValue-bottom', Number((document.getElementById('auto-tradevalue-n') as HTMLInputElement).value))}>선택 추가</button>
            <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300 shrink-0" onClick={() => setAutoRule('exclude', (document.getElementById('auto-tradevalue-mode') as HTMLSelectElement).value === 'top' ? 'tradeValue' : 'tradeValue-bottom', Number((document.getElementById('auto-tradevalue-n') as HTMLInputElement).value))}>제외 추가</button>
          </div>
          <div className="flex items-center gap-2 flex-nowrap">
            <span className="text-zinc-400 whitespace-nowrap mr-1">시가총액</span>
            <select id="auto-marketcap-mode" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 shrink-0">
              <option value="top">상위</option>
              <option value="bottom">하위</option>
            </select>
            <input id="auto-marketcap-n" type="number" min="1" max="1000" defaultValue="10" className="w-16 rounded border border-zinc-700 bg-zinc-900 px-1 py-1 text-right" />
            <button className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-300 shrink-0" onClick={() => setAutoRule('include', (document.getElementById('auto-marketcap-mode') as HTMLSelectElement).value === 'top' ? 'tradeValue' : 'tradeValue-bottom', Number((document.getElementById('auto-marketcap-n') as HTMLInputElement).value))}>선택 추가</button>
            <button className="rounded border border-zinc-600 px-2 py-0.5 text-zinc-300 shrink-0" onClick={() => setAutoRule('exclude', (document.getElementById('auto-marketcap-mode') as HTMLSelectElement).value === 'top' ? 'tradeValue' : 'tradeValue-bottom', Number((document.getElementById('auto-marketcap-n') as HTMLInputElement).value))}>제외 추가</button>
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400">현재 규칙</span>
          </div>
          {/* Include rules with priority */}
          <div className="flex flex-wrap items-center gap-2 max-h-20 overflow-auto pr-2">
            <span className="text-[10px] text-zinc-500">포함 우선순위</span>
            {ruleBadges.includes.length === 0 ? (
              <span className="text-zinc-500">없음</span>
            ) : (
              ruleBadges.includes.map((b, idx) => (
                <span key={b.key} title="자동매매 실행 시 적용되는 자동선택 규칙" className="inline-flex items-center gap-1 rounded border border-emerald-700/50 bg-emerald-950/20 px-2 py-0.5 text-[10px] text-emerald-200">
                  <span className="rounded bg-emerald-700/40 px-1 text-[9px]">#{idx + 1}</span>
                  <span>{b.icon}</span>
                  {b.label}
                  <button onClick={b.onClear} className="rounded border border-emerald-800/50 px-1 text-emerald-300/80 hover:text-rose-300" aria-label={`${b.label} 제거`}>
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          {/* Exclude rules */}
          <div className="flex flex-wrap items-center gap-2 max-h-20 overflow-auto pr-2">
            <span className="text-[10px] text-zinc-500">제외 규칙</span>
            {ruleBadges.excludes.length === 0 ? (
              <span className="text-zinc-500">없음</span>
            ) : (
              ruleBadges.excludes
                .slice()
                .sort((a, b) => a.label.localeCompare(b.label, 'ko'))
                .map((b) => (
                  <span key={b.key} title="자동매매 실행 시 적용되는 자동제외 규칙" className="inline-flex items-center gap-1 rounded border border-rose-700/50 bg-rose-950/20 px-2 py-0.5 text-[10px] text-rose-200">
                    <span>{b.icon}</span>
                    {b.label}
                    <button onClick={b.onClear} className="rounded border border-rose-800/50 px-1 text-rose-300/80 hover:text-rose-300" aria-label={`${b.label} 제거`}>
                      ×
                    </button>
                  </span>
                ))
            )}
          </div>
        </div>
      </div>

      {/* 하단: 선택/제외 표 (위/아래 스택) */}
      <div className="space-y-3">
        <div className="space-y-3">
          <div id="manual-list" tabIndex={-1} className={`rounded bg-emerald-950/30 ${errors?.manualSymbols ? 'border border-rose-700' : 'border border-emerald-900/40'}`} aria-invalid={Boolean(errors?.manualSymbols)} aria-describedby={errors?.manualSymbols ? 'manual-error' : undefined}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
              <span className="font-medium">선택 종목</span>
              <span className="rounded-full border border-emerald-800/60 bg-emerald-950/30 px-2 py-0.5 text-emerald-200">{manual.length} 개</span>
            </div>
            <div className="max-h-40 overflow-auto">
              <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
                <colgroup>
                  <col className="w-32" />
                  <col className="w-32" />
                  <col className="w-28" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-20" />
                  <col className="w-16" />
                </colgroup>
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="px-2 py-1">심볼</th>
                    <th className="px-2 py-1">레버리지</th>
                    <th className="px-2 py-1">포지션</th>
                    <th className="px-2 py-1"><span className="ml-3">추가</span></th>
                    <th className="px-2 py-1"><span className="ml-3">매도</span></th>
                    <th className="px-2 py-1"><span className="ml-3">손절</span></th>
                    <th className="px-2 py-1"> </th>
                  </tr>
                </thead>
                <tbody>
                  {manual.map((sym) => {
                    const up = sym.toUpperCase();
                    const feat = (featureOverrides ?? {})[up] ?? {};
                    const lev = leverageOverrides?.[up];
                    const levMode: 'default' | 'custom' = typeof lev === 'number' && lev > 0 ? 'custom' : 'default';
                    const posPref = (positionOverrides ?? {})[up] as ('long' | 'short' | 'both' | undefined);
                    const posMode: 'default' | 'long' | 'short' | 'both' = posPref ?? 'default';
                    return (
                      <tr key={sym} className="border-b border-zinc-800">
                        <td className="px-2 py-1.5 whitespace-nowrap">{sym}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-2">
                            <select
                              value={levMode}
                              onChange={(e) => {
                                const mode = e.target.value as 'default' | 'custom';
                                if (mode === 'default') clearLev(sym);
                                else setLev(sym, typeof lev === 'number' && lev > 0 ? lev : 10);
                              }}
                          className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          >
                            <option value="default">기본</option>
                            <option value="custom">드롭다운</option>
                          </select>
                            {levMode === 'custom' ? (
                              (() => {
                                const upSym = sym.toUpperCase();
                                const maxForSym = levMaxMap[upSym] ?? 125;
                                const CANDS = [1,2,3,5,10,15,20,25,30,35,40,50,75,100,125].filter((v) => v <= Math.max(1, maxForSym));
                                const current = (typeof lev === 'number' && lev > 0) ? Math.min(maxForSym, lev) : '';
                                return (
                                  <select
                                    value={current as any}
                                    onChange={(e) => setLev(sym, Math.min(maxForSym, Math.max(1, Number(e.target.value) || 1)))}
                                    className="w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center"
                                  >
                                    <option value="" disabled>선택</option>
                                    {CANDS.map((v) => (
                                      <option key={v} value={v}>{v}x</option>
                                    ))}
                                  </select>
                                );
                              })()
                            ) : null}
                          </div>
                        </td>
                        <td className="px-2 py-1.5">
                          <select
                            value={posMode}
                            onChange={(e) => setPos(sym, e.target.value as any)}
                            className="ml-[-10px] w-24 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-center"
                          >
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
                            className="ml-[-20px] w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          >
                            <option value="default">기본</option>
                            <option value="exclude">제외</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select
                            value={feat.exit === false ? 'exclude' : 'default'}
                            onChange={(e) => setFeat(sym, 'exit', e.target.value === 'exclude' ? false : undefined)}
                            className="ml-[-20px] w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
                          >
                            <option value="default">기본</option>
                            <option value="exclude">제외</option>
                          </select>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          <select
                            value={feat.stopLoss === false ? 'exclude' : 'default'}
                            onChange={(e) => setFeat(sym, 'stopLoss', e.target.value === 'exclude' ? false : undefined)}
                            className="ml-[-20px] w-20 rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5"
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
            {errors?.manualSymbols || errors?.leverageOverrides ? (
              <div id="manual-error" className="border-t border-rose-800/50 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300 space-y-1">
                {errors?.manualSymbols ? <div>{errors.manualSymbols}</div> : null}
                {errors?.leverageOverrides ? <div>{errors.leverageOverrides}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
        <div id="excluded-list" tabIndex={-1} className={`rounded bg-rose-950/30 ${errors?.excludedSymbols ? 'border border-rose-700' : 'border border-rose-900/40'}`} aria-invalid={Boolean(errors?.excludedSymbols)} aria-describedby={errors?.excludedSymbols ? 'excluded-error' : undefined}>
            <div className="flex items-center justify-between border-b border-zinc-800 px-2 py-1 text-[11px] text-zinc-300">
              <span className="font-medium">제외 종목</span>
              <span className="rounded-full border border-rose-800/60 bg-rose-950/30 px-2 py-0.5 text-rose-200">{excluded.length} 개</span>
            </div>
            <div className="max-h-32 overflow-auto">
              <ul className="divide-y divide-zinc-800 text-[11px] text-zinc-300">
                {excluded.map((sym) => {
                  const key = normalizeSymbol(sym, quote);
                  return (
                    <li key={sym} className="flex items-center justify-between px-2 py-1">
                      <span>
                        {sym}
                        {excludedReasons[key] ? (
                          <span className="ml-2 rounded border border-zinc-700 px-1 text-[10px] text-zinc-400">
                            {excludedReasons[key]}
                          </span>
                        ) : null}
                      </span>
                      <button className="rounded border border-zinc-700 px-2 py-0.5" onClick={() => removeExcluded(sym)}>
                        제거
                      </button>
                    </li>
                  );
                })}
              </ul>
          </div>
          {errors?.excludedSymbols ? (
            <div id="excluded-error" className="border-t border-rose-800/50 bg-rose-950/30 px-2 py-1 text-[11px] text-rose-300">
              {errors.excludedSymbols}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
