"use client";

import { useEffect, useMemo, useRef, useState } from 'react';

import type { AutoTradingSettings } from '@/types/trading/auto-trading';
import { DEFAULT_EXCLUDED_SYMBOLS } from '@/types/trading/auto-trading';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import { SectionFrame } from './SectionFrame';
import { helpContent } from './helpContent';
import { useSectionDirtyFlag } from '@/hooks/useSectionDirtyFlag';
import { assertSectionReady } from '@/lib/trading/validators/autoTrading';
import { SettingComment } from './SettingComment';
import { SymbolSelector } from './SymbolSelector';
// Legacy SymbolsControlPanel removed
import { SymbolsPickerPanel } from './SymbolsPickerPanel';
import { LogicSummary } from './LogicSummary';
import { FooterActions } from './FooterActions';
import { StrategyManagerPanel } from './StrategyManagerPanel';
import { normalizeSymbol, uniqueAppend, removeSymbol } from '@/lib/trading/symbols';
import { isNameTaken } from '@/lib/trading/strategies/local';
import { LogicNameManagerModal } from './LogicNameManagerModal';
import { GroupListPanel } from './GroupListPanel';
import { GroupListPanelV2 } from './GroupListPanelV2';
import { ConditionsPreview } from './ConditionsPreview';
import { PreviewLauncher } from './PreviewLauncher';
import { createIndicatorConditions, normalizeConditionTree } from '@/lib/trading/autoTradingDefaults';
import { applyAutoSelectionRules } from '@/lib/trading/autoFill';
import { CapitalSettingsPanel } from './CapitalSettingsPanel';
import { InfoTip } from '@/components/common/InfoTip';
import { collectIndicatorNodes } from '@/lib/trading/conditionsTree';
import { useSymbolValidation } from '@/hooks/useSymbolValidation';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { normalizeSymbol as toExchangeSymbol } from '@/lib/trading/symbols';

type Draft = AutoTradingSettings;

export function AutoTradingSettingsForm() {
  const settings = useAutoTradingSettingsStore((s) => s.settings);
  const updateSettings = useAutoTradingSettingsStore((s) => s.updateSettings);
  const updateIndicatorsRaw = useAutoTradingSettingsStore((s) => (s as any).updateIndicatorsRaw as (
    target:
      | { type: 'entry'; direction: 'long' | 'short' }
      | { type: 'scaleIn'; direction: 'long' | 'short' }
      | { type: 'exit'; direction: 'long' | 'short' }
      | { type: 'hedge' }
      | { type: 'stopLossLine' },
    indicators: any
  ) => void);
  const [draft, setDraft] = useState<Draft>(settings);

  // 전역 settings 변경 시, 심볼 선택 편집 중인 로컬 드래프트의 핵심 필드(수동/제외/오버라이드)는 보존하고
  // 나머지 필드만 최신 settings로 동기화합니다. 자동선택 규칙(랭킹/제외) 변경 시 드래프트가 초기화되는 문제를 방지.
  const lastAppliedSavedAtRef = useRef<string | null>(settings.metadata.lastSavedAt);
  useEffect(() => {
    const savedAt = settings.metadata.lastSavedAt;
    const lastApplied = lastAppliedSavedAtRef.current;
    if (savedAt && savedAt !== lastApplied) {
      setDraft(settings);
      lastAppliedSavedAtRef.current = savedAt;
      try { localStorage.removeItem(DRAFT_SYMBOLS_KEY); } catch {}
    }
    // savedAt가 변하지 않는 일반적인 설정 변경 시에는 심볼 선택 드래프트를 건드리지 않아
    // 수동 선택/제외 목록이 초기화되지 않도록 한다.
  }, [settings]);

  // Local helpers/states
  const [symbolsQuote, setSymbolsQuote] = useState<'USDT' | 'USDC'>('USDT');
  const [previewSymbolInput, setPreviewSymbolInput] = useState<string>('');
  const [previewQuote, setPreviewQuote] = useState<'USDT' | 'USDC'>(symbolsQuote);
  const [filterStable, setFilterStable] = useState<boolean>(true);
  const [minVolume, setMinVolume] = useState<number>(0);
  const [minQuoteVolume, setMinQuoteVolume] = useState<number>(0);
  const excludeUnknownListing = useUIPreferencesStore(
    (s) => s.autoTrading?.symbolsPicker?.filters?.hideUnknownListing ?? false
  );
  const setUIPrefs = useUIPreferencesStore((s) => s.updateSymbolsPickerPrefs);
  const [bulkExcludeText, setBulkExcludeText] = useState<string>('');
  const [recentMax, setRecentMax] = useState<number>(12);
  const [recentRetentionDays, setRecentRetentionDays] = useState<number>(30);
  const excludeImportRef = useRef<HTMLInputElement | null>(null);
  const excludeJsonImportRef = useRef<HTMLInputElement | null>(null);
  const [excludeImportNote, setExcludeImportNote] = useState<string | null>(null);
  const DRAFT_SYMBOLS_KEY = 'auto-trading-draft-symbols-v1';
  // Restore unsaved manual/excluded lists across refresh
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_SYMBOLS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        manualSymbols?: string[];
        excludedSymbols?: string[];
        excludedReasons?: Record<string, string>;
      };
      if (!parsed) return;
      setDraft((d) => ({
        ...d,
        symbolSelection: {
          ...d.symbolSelection,
          manualSymbols: Array.isArray(parsed.manualSymbols) ? parsed.manualSymbols : d.symbolSelection.manualSymbols,
          excludedSymbols: Array.isArray(parsed.excludedSymbols) ? parsed.excludedSymbols : d.symbolSelection.excludedSymbols,
          excludedReasons: parsed.excludedReasons || d.symbolSelection.excludedReasons
        }
      }));
    } catch {}
  }, []);

  // Auto-select rules: mutate draft only (no global store writes)
  const setDraftAutoRule = (
    action: 'include' | 'exclude',
    key: 'volume' | 'volume-bottom' | 'changeUp' | 'changeDown' | 'tradeValue' | 'tradeValue-bottom',
    n: number
  ) => {
    setDraft((d) => {
      const next = { ...d } as Draft;
      const rr = { ...(next.symbolSelection.ranking || {}) } as any;
      if (action === 'include') {
        if (key === 'volume') rr.volume = n;
        else if (key === 'tradeValue') rr.market_cap = n;
        else if (key === 'changeUp') rr.top_gainers = n;
        else if (key === 'changeDown') rr.top_losers = n;
        next.symbolSelection.ranking = rr;
      } else {
        if (key === 'changeUp') next.symbolSelection.excludeTopGainers = n as any;
        else if (key === 'changeDown') next.symbolSelection.excludeTopLosers = n as any;
        else if (key === 'volume-bottom') (next.symbolSelection as any).excludeBottomVolume = Math.max(1, Math.trunc(n));
        else if (key === 'tradeValue-bottom') (next.symbolSelection as any).excludeBottomMarketCap = Math.max(1, Math.trunc(n));
      }
      return next;
    });
  };
  const clearDraftRule = (
    kind: 'ranking' | 'exclude',
    field: 'volume' | 'market_cap' | 'top_gainers' | 'top_losers' | 'bottom_volume' | 'bottom_market_cap'
  ) => {
    setDraft((d) => {
      const next = { ...d } as Draft;
      if (kind === 'ranking') {
        next.symbolSelection.ranking = {
          ...(next.symbolSelection.ranking || {}),
          [field]: null
        } as any;
      } else {
        if (field === 'top_gainers') (next.symbolSelection as any).excludeTopGainers = null;
        else if (field === 'top_losers') (next.symbolSelection as any).excludeTopLosers = null;
        else if (field === 'bottom_volume') (next.symbolSelection as any).excludeBottomVolume = null;
        else if (field === 'bottom_market_cap') (next.symbolSelection as any).excludeBottomMarketCap = null;
      }
      return next;
    });
  };
  const clearAllDraftRules = () => {
    setDraft((d) => {
      const next = { ...d } as Draft;
      next.symbolSelection.ranking = {
        ...(next.symbolSelection.ranking || {}),
        volume: null,
        market_cap: null,
        top_gainers: null,
        top_losers: null
      } as any;
      (next.symbolSelection as any).excludeTopGainers = null;
      (next.symbolSelection as any).excludeTopLosers = null;
      (next.symbolSelection as any).excludeBottomVolume = null;
      (next.symbolSelection as any).excludeBottomMarketCap = null;
      return next;
    });
  };
  const clearMaxListingAgeDays = () => {
    setDraft((d) => ({
      ...d,
      symbolSelection: { ...d.symbolSelection, maxListingAgeDays: null }
    }));
  };

  const defaultExcludedNormalized = useMemo(
    () => DEFAULT_EXCLUDED_SYMBOLS.map((s) => normalizeSymbol(s, symbolsQuote)),
    [symbolsQuote]
  );
  const excludedDisplayList = useMemo(() => {
    const set = new Set<string>();
    for (const s of draft.symbolSelection.excludedSymbols) set.add(normalizeSymbol(s, symbolsQuote));
    if (draft.symbolSelection.respectDefaultExclusions) {
      for (const s of defaultExcludedNormalized) set.add(s);
    }
    return Array.from(set);
  }, [draft.symbolSelection.excludedSymbols, draft.symbolSelection.respectDefaultExclusions, symbolsQuote, defaultExcludedNormalized]);

  // Dirty flags
  const symbolsDirty = useSectionDirtyFlag(settings.symbolSelection, draft.symbolSelection);
  const basicDirty = useSectionDirtyFlag(
    {
      logicName: settings.logicName,
      timeframe: settings.timeframe,
      leverage: settings.leverage,
      symbolCount: settings.symbolCount,
      assetMode: settings.assetMode,
      positionMode: settings.positionMode
    },
    {
      logicName: draft.logicName,
      timeframe: draft.timeframe,
      leverage: draft.leverage,
      symbolCount: draft.symbolCount,
      assetMode: draft.assetMode,
      positionMode: draft.positionMode
    }
  );

  const entryDirty = useSectionDirtyFlag(settings.entry, draft.entry);
  const scaleInDirty = useSectionDirtyFlag(settings.scaleIn, draft.scaleIn);
  const exitDirty = useSectionDirtyFlag(settings.exit, draft.exit);
  const stopLossDirty = useSectionDirtyFlag(settings.stopLoss, draft.stopLoss);
  const hedgeDirty = useSectionDirtyFlag(settings.hedgeActivation, draft.hedgeActivation);

  // Utilities
  const previewInterval = useMemo(() => {
    const tf = draft.timeframe;
    const supported = new Set(['1m','3m','5m','15m','1h','4h','1d','1w']);
    if (supported.has(tf as any)) return (tf as any);
    if (tf === '8h' || tf === '12h') return '4h';
    if (tf === '24h') return '1d';
    return '15m';
  }, [draft.timeframe]);
  const previewSymbol = useMemo(() => {
    const src = previewSymbolInput?.trim() ? previewSymbolInput.trim() : (draft.symbolSelection.manualSymbols[0] || 'BTCUSDT');
    const sx = toExchangeSymbol(src, previewQuote);
    return sx || `BTC${previewQuote}`;
  }, [draft.symbolSelection.manualSymbols, previewQuote, previewSymbolInput]);

  const previewSymbolValidation = useSymbolValidation(previewSymbolInput || previewSymbol, symbolsQuote);
  const previewDatalistOptions = useMemo(() => {
    const m = new Set<string>(draft.symbolSelection.manualSymbols.map((s) => s));
    (previewSymbolValidation.suggestions || []).forEach((s) => m.add(s));
    return Array.from(m).slice(0, 50);
  }, [draft.symbolSelection.manualSymbols, previewSymbolValidation.suggestions]);

  // Global navigation from preview (chips) → expand & scroll to section
  useEffect(() => {
    const handler = (e: any) => {
      try {
        const key = String(e?.detail || '');
        if (!key) return;
        // Expand via UI store
        try {
          const mod = require('@/stores/uiPreferencesStore');
          mod.useUIPreferencesStore?.getState?.().setCollapsed(key, false);
        } catch {}
        const el = document.getElementById(`section-${key}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch {}
    };
    window.addEventListener('jump-to-section', handler as any);
    return () => window.removeEventListener('jump-to-section', handler as any);
  }, []);
  const buildSignals = (conds: any, on: boolean) => {
    try {
      if (!on) return undefined;
      const ids = collectIndicatorNodes((conds?.root as any) || conds).map((n) => n.id);
      return Object.fromEntries(ids.map((id) => [id, true]));
    } catch {
      return undefined;
    }
  };
  const [assumeSignalsOn, setAssumeSignalsOn] = useState(true);
  const copyToClipboard = async (items: string[]) => {
    try {
      await navigator.clipboard.writeText(items.join('\n'));
    } catch {}
  };
  const exportList = (items: string[], filename: string) => {
    try {
      const blob = new Blob([items.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };
  type ExportListType = 'manual' | 'exclude';
  type ExportSchemaV1 = { version: 1; type: ExportListType; quote: 'USDT' | 'USDC'; generatedAt: string; items: string[] };
  const exportJsonList = (items: string[], filename: string, type: ExportListType) => {
    try {
      const payload: ExportSchemaV1 = { version: 1, type, quote: symbolsQuote, generatedAt: new Date().toISOString(), items };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };
  // Persist unsaved edits for manual/excluded lists in localStorage
  useEffect(() => {
    try {
      const payload = JSON.stringify({
        manualSymbols: draft.symbolSelection.manualSymbols,
        excludedSymbols: draft.symbolSelection.excludedSymbols,
        excludedReasons: draft.symbolSelection.excludedReasons
      });
      localStorage.setItem(DRAFT_SYMBOLS_KEY, payload);
    } catch {}
  }, [draft.symbolSelection.manualSymbols, draft.symbolSelection.excludedSymbols, draft.symbolSelection.excludedReasons]);
  const importFromFile = async (file: File, apply: (symbols: string[]) => void) => {
    const text = await file.text();
    const parts = text
      .split(/[^A-Za-z0-9]+/g)
      .map((t) => normalizeSymbol(t, symbolsQuote))
      .filter((s) => s.length > 0);
    apply(parts);
  };
  const parseJsonSymbols = async (
    file: File
  ): Promise<{ items: string[]; version?: number; quote?: 'USDT' | 'USDC' }> => {
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Partial<ExportSchemaV1> | { items?: unknown } | unknown;
      const version = (data as any)?.version as number | undefined;
      const quote = (data as any)?.quote as 'USDT' | 'USDC' | undefined;
      const arr = (data as any)?.items;
      let candidates: string[] = [];
      if (Array.isArray(arr) && arr.every((v) => typeof v === 'string')) candidates = arr as string[];
      return { items: candidates, version, quote };
    } catch {
      return { items: [] };
    }
  };

  // ---- Shared small editors ----
  const ProfitRateEditor = ({
    label,
    value,
    onChange
  }: {
    label: string;
    value: { enabled: boolean; comparator: 'over' | 'under' | 'eq' | 'gte' | 'lte' | 'none'; value: number };
    onChange: (next: { enabled: boolean; comparator: 'over' | 'under' | 'eq' | 'gte' | 'lte' | 'none'; value: number }) => void;
  }) => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
      <span className="text-zinc-400">{label}</span>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
          className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
        />
        사용
      </label>
      <select
        value={value.comparator}
        onChange={(e) => onChange({ ...value, comparator: e.target.value as any })}
        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
      >
        <option value="over">보다 큼({">"})</option>
        <option value="gte">크거나같음(≥)</option>
        <option value="eq">같음(=)</option>
        <option value="lte">작거나같음(≤)</option>
        <option value="under">보다 작음({"<"})</option>
      </select>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={-10000}
          max={10000}
          step={0.01}
          value={value.value}
          onChange={(e) => {
            const v = Number.isFinite(Number(e.target.value)) ? Number(e.target.value) : value.value;
            const clamped = Math.max(-10000, Math.min(10000, v));
            onChange({ ...value, value: clamped });
          }}
          className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
        <span className="text-zinc-400">%</span>
      </div>
    </div>
  );

  // Save handlers
  const handleSaveSymbols = async () => {
    const prev = settings.symbolSelection;
    const normalizeList = (list: string[]) =>
      Array.from(new Set(list.map((s) => normalizeSymbol(s, symbolsQuote)).filter((s) => s.length > 0)));
    const normalizeOverrides = (ov: Record<string, number>) =>
      Object.fromEntries(
        Object.entries(ov).map(([k, v]) => [normalizeSymbol(k, symbolsQuote), Math.min(125, Math.max(1, Number(v) || 1))])
      );
    const normalizePosOverrides = (ov: Record<string, 'long' | 'short' | 'both'> | undefined) =>
      Object.fromEntries(
        Object.entries(ov ?? {}).map(([k, v]) => [normalizeSymbol(k, symbolsQuote), v === 'both' || v === 'short' || v === 'long' ? v : 'long'])
      );
    let cleaned = {
      manualSymbols: normalizeList(draft.symbolSelection.manualSymbols),
      excludedSymbols: normalizeList(draft.symbolSelection.excludedSymbols),
      excludedReasons: Object.fromEntries(
        Object.entries(draft.symbolSelection.excludedReasons ?? {}).map(([k, v]) => [normalizeSymbol(k, symbolsQuote), String(v || '')])
      ),
      leverageOverrides: normalizeOverrides(draft.symbolSelection.leverageOverrides),
      positionOverrides: normalizePosOverrides(draft.symbolSelection.positionOverrides),
      maxListingAgeDays:
        typeof draft.symbolSelection.maxListingAgeDays === 'number' && draft.symbolSelection.maxListingAgeDays > 0
          ? draft.symbolSelection.maxListingAgeDays
          : null
    } as const;

    // 정책: 수동 선택이 우선. 부족한 수량은 규칙으로 보충
    try {
      const need = Math.max(0, draft.symbolCount - cleaned.manualSymbols.length);
      if (need > 0) {
        const params = new URLSearchParams({ quote: symbolsQuote, sort: 'tradeValue', limit: '2000' });
        const res = await fetch(`/api/markets?${params.toString()}`);
        if (res.ok) {
          const json = (await res.json()) as { items: any[] };
          const markets = Array.isArray(json.items) ? json.items : [];
          const settingsLike: any = {
            symbolSelection: {
              ranking: draft.symbolSelection.ranking || {},
              excludeTopGainers: (draft.symbolSelection as any).excludeTopGainers || null,
              excludeTopLosers: (draft.symbolSelection as any).excludeTopLosers || null,
              excludeBottomMarketCap: (draft.symbolSelection as any).excludeBottomMarketCap || null
            }
          };
          const out = applyAutoSelectionRules(settingsLike, markets);
          const inc = new Set(out.include.map((s) => normalizeSymbol(s, symbolsQuote)));
          const exc = new Set([
            ...out.exclude.map((s) => normalizeSymbol(s, symbolsQuote)),
            ...cleaned.excludedSymbols
          ]);
          const curr = new Set(cleaned.manualSymbols);
          for (const s of curr) exc.delete(s);
          let available = Array.from(inc).filter((s) => !curr.has(s) && !exc.has(s));
          // Fallback: if no rules produce candidates, fill by top 거래대금
          if (available.length === 0) {
            const order = [...markets].sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0));
            available = order.map((it) => normalizeSymbol(`${it.base}/${it.quote}`, symbolsQuote)).filter((s) => !curr.has(s) && !exc.has(s));
          }
          const fill = available.slice(0, need);
          cleaned = {
            ...cleaned,
            manualSymbols: Array.from(new Set([...cleaned.manualSymbols, ...fill]))
          } as typeof cleaned;
        }
      }
    } catch {}

    // 최소 개수 검증: 랭킹이 비활성인 경우, 수동 선택 개수가 설정한 종목 수보다 적으면 오류
    const rankingValues = Object.values(draft.symbolSelection.ranking ?? {});
    const rankingActive = rankingValues.some((v) => typeof v === 'number' && v != null);
    if (!rankingActive && cleaned.manualSymbols.length < draft.symbolCount) {
      throw new Error(`거래 종목 수가 부족합니다. 선택 ${cleaned.manualSymbols.length} / 최소 ${draft.symbolCount}`);
    }

    // server validation
    try {
      const res = await fetch('/api/markets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manualSymbols: cleaned.manualSymbols,
          excludedSymbols: cleaned.excludedSymbols,
          quote: symbolsQuote,
          leverageOverrides: cleaned.leverageOverrides
        })
      });
      if (res.ok) {
        const json = (await res.json()) as { ok: boolean; invalidSymbols?: string[]; warnings?: string[] };
        if (!json.ok) {
          const parts: string[] = [];
          if (json.invalidSymbols && json.invalidSymbols.length > 0) parts.push(`유효하지 않은 심볼: ${json.invalidSymbols.join(', ')}`);
          if (json.warnings && json.warnings.length > 0) parts.push(json.warnings.join('\n'));
          throw new Error(parts.join('\n') || '심볼 검증에 실패했습니다.');
        }
      } else {
        const json = await res.json().catch(() => ({} as any));
        const msg = (json?.error?.message as string)
          || (json?.error as string)
          || '심볼 검증에 실패했습니다.';
        const fe = (json?.error?.fieldErrors as Array<{ field: string; message?: string }>) ?? [];
        const errs: { manualSymbols?: string; excludedSymbols?: string; leverageOverrides?: string } = {};
        for (const e of fe) {
          const f = (e as any).field;
          const m = (e as any).message as string | undefined;
          if (f === 'manualSymbols') errs.manualSymbols = m || '선택 종목 목록을 확인하세요.';
          if (f === 'excludedSymbols') errs.excludedSymbols = m || '제외 종목 목록을 확인하세요.';
          if (f === 'leverageOverrides') errs.leverageOverrides = m || '레버리지 오버라이드를 확인하세요.';
        }
        setSymbolsErrors(errs);
        const anchor = errs.manualSymbols ? 'manual-list' : errs.excludedSymbols ? 'excluded-list' : undefined;
        if (anchor) {
          const target = document.getElementById(anchor);
          target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => target?.focus?.(), 60);
        }
        const details = fe.map((e: any) => e?.message).filter(Boolean).join('\n');
        const rid = (json?.requestId as string | undefined) ?? '';
        const composed = [msg, details, rid ? `요청ID: ${rid}` : ''].filter(Boolean).join('\n');
        throw new Error(composed);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '심볼 검증 실패';
      throw new Error(msg);
    }

    updateSettings((d) => {
      d.symbolSelection = {
        ...d.symbolSelection,
        manualSymbols: cleaned.manualSymbols,
        excludedSymbols: cleaned.excludedSymbols,
        excludedReasons: cleaned.excludedReasons,
        leverageOverrides: cleaned.leverageOverrides,
        positionOverrides: cleaned.positionOverrides,
        maxListingAgeDays: cleaned.maxListingAgeDays,
        // persist auto-select rules to global settings as well
        ranking: { ...(draft.symbolSelection.ranking as any) } as any,
        excludeTopGainers: (draft.symbolSelection as any).excludeTopGainers ?? null,
        excludeTopLosers: (draft.symbolSelection as any).excludeTopLosers ?? null,
        excludeBottomVolume: (draft.symbolSelection as any).excludeBottomVolume ?? null,
        excludeBottomMarketCap: (draft.symbolSelection as any).excludeBottomMarketCap ?? null
      };
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    try { localStorage.removeItem(DRAFT_SYMBOLS_KEY); } catch {}
    return () => {
      setDraft((dr) => ({ ...dr, symbolSelection: prev }));
      updateSettings((d) => {
        d.symbolSelection = prev;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  const logicNameRef = useRef<HTMLInputElement | null>(null);
  const leverageRef = useRef<HTMLInputElement | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [errors, setErrors] = useState({ basic: { logicName: false, leverage: false } });
  const [symbolsErrors, setSymbolsErrors] = useState<{ manualSymbols?: string; excludedSymbols?: string; leverageOverrides?: string }>({});
  const handleSaveBasic = async () => {
    setErrors({ basic: { logicName: false, leverage: false } });
    if (!draft.logicName.trim()) {
      setErrors((e) => ({ ...e, basic: { ...e.basic, logicName: true } } as any));
      logicNameRef.current?.focus();
      throw new Error('전략 이름을 입력하세요.');
    }
    if (!(draft.leverage >= 1 && draft.leverage <= 125)) {
      setErrors((e) => ({ ...e, basic: { ...e.basic, leverage: true } } as any));
      leverageRef.current?.focus();
      throw new Error('레버리지는 1~125 사이여야 합니다.');
    }
    const taken = isNameTaken(draft.logicName);
    const sameAsCurrent = draft.logicName.trim() === settings.logicName.trim();
    if (taken && !sameAsCurrent) {
      logicNameRef.current?.focus();
      throw new Error('이미 사용 중인 이름입니다. 기존 이름으로 수정 저장은 가능합니다.');
    }
    const prev = {
      logicName: settings.logicName,
      timeframe: settings.timeframe,
      leverage: settings.leverage,
      symbolCount: settings.symbolCount,
      assetMode: settings.assetMode,
      positionMode: settings.positionMode
    } as const;
    updateSettings((d) => {
      d.logicName = draft.logicName.trim();
      d.timeframe = draft.timeframe;
      d.leverage = Math.min(125, Math.max(1, Math.round(draft.leverage)));
      d.symbolCount = Math.min(50, Math.max(1, Math.round(draft.symbolCount)));
      d.assetMode = draft.assetMode;
      d.positionMode = draft.positionMode;
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    return () => {
      setDraft((dr) => ({
        ...dr,
        logicName: prev.logicName,
        timeframe: prev.timeframe,
        leverage: prev.leverage,
        symbolCount: prev.symbolCount,
        assetMode: prev.assetMode,
        positionMode: prev.positionMode
      }));
      updateSettings((d) => {
        d.logicName = prev.logicName;
        d.timeframe = prev.timeframe;
        d.leverage = prev.leverage;
        d.symbolCount = prev.symbolCount;
        d.assetMode = prev.assetMode;
        d.positionMode = prev.positionMode;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  const ensureIndicators = (v: any) => {
    try {
      if (v && typeof v === 'object' && v.root && (v.root as any).kind === 'group') return v as any;
    } catch {}
    return createIndicatorConditions();
  };

  // 공통: IndicatorConditions를 안전한 정규화 형태로 변환
  const toNormalizedIndicatorConditions = (v: any) => {
    try {
      const root = (v?.root ?? null) as any;
      if (root && typeof root === 'object' && typeof root.kind === 'string') {
        return { root: normalizeConditionTree(root) } as any;
      }
    } catch {}
    return createIndicatorConditions();
  };

  // 정규화 + 호환 필드(entries/defaultAggregator) 동시 세팅
  const toNormalizedCompatIndicatorConditions = (v: any) => {
    const normalized = toNormalizedIndicatorConditions(v) as any;
    try {
      const nodes = collectIndicatorNodes(normalized.root as any);
      normalized.entries = nodes.map((n: any) => ({
        id: n.id,
        type: n.indicator?.type,
        aggregator: 'and',
        config: n.indicator?.config,
        comparison: { mode: 'none' }
      }));
      normalized.defaultAggregator = (normalized.root as any).operator ?? 'and';
      if (v && typeof v === 'object' && 'candle' in v) {
        normalized.candle = (v as any).candle;
      }
    } catch {
      // entries/candle는 생략 가능
    }
    return normalized;
  };

  const handleSaveEntry = async () => {
    const prev = settings.entry;
    // 안전한 정규화 형태(compat 포함)로 변환
    const safeLong = toNormalizedCompatIndicatorConditions(draft.entry.long?.indicators);
    const safeShort = toNormalizedCompatIndicatorConditions(draft.entry.short?.indicators);
    // 검증(실패 시 메시지 표시)
    try {
      const next: AutoTradingSettings = {
        ...settings,
        entry: {
          long: { ...draft.entry.long, indicators: safeLong },
          short: { ...draft.entry.short, indicators: safeShort }
        }
      } as AutoTradingSettings;
      assertSectionReady('entry', next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
    // 1) 인디케이터 트리는 raw 저장(정규화 우회)
    updateIndicatorsRaw({ type: 'entry', direction: 'long' }, safeLong);
    updateIndicatorsRaw({ type: 'entry', direction: 'short' }, safeShort);
    // 2) 토글/메타는 정상 경로로 저장
    updateSettings((d) => {
      d.entry.long.enabled = draft.entry.long.enabled;
      d.entry.long.immediate = draft.entry.long.immediate;
      d.entry.short.enabled = draft.entry.short.enabled;
      d.entry.short.immediate = draft.entry.short.immediate;
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    // undo
    return () => {
      setDraft((dr) => ({ ...dr, entry: prev }));
      updateIndicatorsRaw({ type: 'entry', direction: 'long' }, prev.long.indicators as any);
      updateIndicatorsRaw({ type: 'entry', direction: 'short' }, prev.short.indicators as any);
      updateSettings((d) => {
        d.entry.long.enabled = prev.long.enabled;
        d.entry.long.immediate = prev.long.immediate;
        d.entry.short.enabled = prev.short.enabled;
        d.entry.short.immediate = prev.short.immediate;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  const handleSaveScaleIn = async () => {
    const prev = settings.scaleIn;
    try {
      const next = { ...settings, scaleIn: draft.scaleIn } as AutoTradingSettings;
      assertSectionReady('scaleIn', next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
    updateSettings((d) => {
      d.scaleIn = draft.scaleIn;
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    return () => {
      setDraft((dr) => ({ ...dr, scaleIn: prev }));
      updateSettings((d) => {
        d.scaleIn = prev;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  const handleSaveExit = async () => {
    const prev = settings.exit;
    try {
      const next = { ...settings, exit: draft.exit } as AutoTradingSettings;
      assertSectionReady('exit', next);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(msg);
    }
    updateSettings((d) => {
      d.exit = draft.exit;
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    return () => {
      setDraft((dr) => ({ ...dr, exit: prev }));
      updateSettings((d) => {
        d.exit = prev;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  const handleSaveStopLoss = async () => {
    const prev = settings.stopLoss;
    updateSettings((d) => {
      d.stopLoss = draft.stopLoss;
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    return () => {
      setDraft((dr) => ({ ...dr, stopLoss: prev }));
      updateSettings((d) => {
        d.stopLoss = prev;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  const handleSaveHedge = async () => {
    const prev = settings.hedgeActivation;
    updateSettings((d) => {
      d.hedgeActivation = draft.hedgeActivation;
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    return () => {
      setDraft((dr) => ({ ...dr, hedgeActivation: prev }));
      updateSettings((d) => {
        d.hedgeActivation = prev;
        d.metadata.lastSavedAt = new Date().toISOString();
      });
    };
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Symbols section */}
      <div className="order-2">
        <SectionFrame
          sectionKey="symbols"
          title="종목 선택 / 제외 & 레버리지"
          description="종목 풀을 구성하고 레버리지/포지션 종목별 설정(기본보다 우선)을 적용합니다."
          isDirty={symbolsDirty}
          helpTitle="종목 선택 도움말"
          helpContent={helpContent.symbols}
          onSave={handleSaveSymbols}
          onReset={() => {
            updateSettings((d) => {
              d.symbolSelection = {
                ...d.symbolSelection,
                manualSymbols: [],
                excludedSymbols: [],
                excludedReasons: {},
                ranking: { volume: null, market_cap: null, top_gainers: null, top_losers: null } as any,
                excludeTopGainers: null,
                excludeTopLosers: null,
                leverageOverrides: {},
                positionOverrides: {},
                featureOverrides: {}
              } as any;
              d.metadata.lastSavedAt = new Date().toISOString();
            });
            try { localStorage.removeItem(DRAFT_SYMBOLS_KEY); } catch {}
          }}
        >
          <div className="space-y-4">
            {/* Controls removed: 최근N/보관/최소 거래량/최소 거래대금/상장일 제외는 아래 패널로 이동 */}
            <div className="hidden" />

            {/* 신규: 심볼 검색/추가/제외 + 표형식 오버라이드 */}
            <SymbolsPickerPanel
              quote={symbolsQuote}
              symbolCount={draft.symbolCount}
              onChangeQuote={(q) => {
                setSymbolsQuote(q);
                // 쿼트 변경 시, 기존 선택/제외/오버라이드/기능 키를 모두 새 쿼트로 정규화하여 혼용 방지
                setDraft((d) => {
                  const normList = (list: string[]) => list.map((s) => normalizeSymbol(s, q)).filter(Boolean);
                  const normMap = (m: Record<string, any>) => {
                    const next: Record<string, any> = {};
                    Object.entries(m || {}).forEach(([k, v]) => {
                      const nk = normalizeSymbol(String(k), q);
                      if (nk) next[nk] = v;
                    });
                    return next;
                  };
                  return {
                    ...d,
                    symbolSelection: {
                      ...d.symbolSelection,
                      manualSymbols: normList(d.symbolSelection.manualSymbols),
                      excludedSymbols: normList(d.symbolSelection.excludedSymbols),
                      excludedReasons: Object.fromEntries(
                        Object.entries(d.symbolSelection.excludedReasons || {}).map(([k, v]) => [normalizeSymbol(k, q), v]).filter(([k]) => Boolean(k))
                      ) as any,
                      leverageOverrides: normMap(d.symbolSelection.leverageOverrides as any),
                      positionOverrides: normMap(d.symbolSelection.positionOverrides as any),
                      featureOverrides: normMap((d.symbolSelection as any).featureOverrides || {})
                    }
                  } as Draft;
                });
              }}
              manual={draft.symbolSelection.manualSymbols}
              excluded={draft.symbolSelection.excludedSymbols}
              excludedReasons={draft.symbolSelection.excludedReasons ?? {}}
              leverageOverrides={draft.symbolSelection.leverageOverrides}
              positionOverrides={draft.symbolSelection.positionOverrides}
              featureOverrides={(draft.symbolSelection as any).featureOverrides ?? {}}
              errors={symbolsErrors}
              rules={{
                ranking: (draft.symbolSelection.ranking as any) || {},
                excludeTopGainers: (draft.symbolSelection as any).excludeTopGainers ?? null,
                excludeTopLosers: (draft.symbolSelection as any).excludeTopLosers ?? null,
                maxListingAgeDays: draft.symbolSelection.maxListingAgeDays ?? null,
                excludeBottomVolume: (draft.symbolSelection as any).excludeBottomVolume ?? null,
                excludeBottomMarketCap: (draft.symbolSelection as any).excludeBottomMarketCap ?? null
              }}
              onSetRule={setDraftAutoRule}
              onClearRule={clearDraftRule}
              onClearAllRules={clearAllDraftRules}
              onClearMaxListingAgeDays={clearMaxListingAgeDays}
              onChange={(next) =>
                setDraft((d) => ({
                  ...d,
                  symbolSelection: {
                    ...d.symbolSelection,
                    manualSymbols: next.manual,
                    excludedSymbols: next.excluded,
                    excludedReasons: next.excludedReasons,
                    leverageOverrides: next.leverageOverrides,
                    positionOverrides: next.positionOverrides,
                    featureOverrides: next.featureOverrides
                  }
                }))
              }
            />

            {/* 제외 규칙(상장일) — 제외 표 아래 배치 */}
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.symbolSelection.maxListingAgeDays != null || false}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: {
                          ...d.symbolSelection,
                          maxListingAgeDays: e.target.checked ? (d.symbolSelection.maxListingAgeDays ?? 30) : null
                        }
                      }))
                    }
                    className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                  />
                  <span>상장일 N일 이하 제외</span>
                </label>
                {draft.symbolSelection.maxListingAgeDays != null ? (
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={draft.symbolSelection.maxListingAgeDays}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: {
                          ...d.symbolSelection,
                          maxListingAgeDays: Math.min(1000, Math.max(1, Number(e.target.value) || 1))
                        }
                      }))
                    }
                    className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                  />
                ) : null}
                <label className="ml-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={excludeUnknownListing}
                    onChange={(e) => setUIPrefs({ filters: { hideUnknownListing: e.target.checked } as any })}
                    className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                  />
                  <span>상장일 정보 없음 제외</span>
                </label>
              </div>
            </div>

            {/* Ranking sort / autofill controls (removed) */}
            {false && (
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                  <label className="flex items-center gap-2">
                    <span className="text-zinc-400">정렬</span>
                    <select
                      value={draft.symbolSelection.rankingSort ?? 'alphabet'}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          symbolSelection: { ...d.symbolSelection, rankingSort: e.target.value as any }
                        }))
                      }
                      className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                    >
                      <option value="alphabet">알파벳순</option>
                      <option value="volume">거래량순</option>
                      <option value="tradeValue">시가총액순(거래대금)</option>
                      <option value="changeUp">상승률순</option>
                      <option value="changeDown">하락률순</option>
                    </select>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.symbolSelection.autoFillRecheck ?? false}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          symbolSelection: { ...d.symbolSelection, autoFillRecheck: e.target.checked }
                        }))
                      }
                      className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                    />
                    <span>랭킹 1시간마다 재확인</span>
                  </label>
                  <button
                    type="button"
                    onClick={async () => {
                      const sort = draft.symbolSelection.rankingSort ?? 'alphabet';
                      const need = Math.max(
                        0,
                        Math.min(1000, Math.max(0, draft.symbolCount)) -
                          draft.symbolSelection.manualSymbols.length
                      );
                      if (need <= 0) return;
                      const params = new URLSearchParams({ quote: symbolsQuote, sort });
                      const res = await fetch(`/api/markets?${params.toString()}`);
                      if (!res.ok) return;
                      const json = (await res.json()) as {
                        items: { symbol: string; volume: number; quoteVolume: number; listedDays?: number | null }[];
                      };
                      // Rank-based excludes
                      const excludeSet = new Set<string>();
                      const fetchTopSet = async (s: 'changeUp' | 'changeDown', n: number) => {
                        const p = new URLSearchParams({ quote: symbolsQuote, sort: s });
                        const r = await fetch(`/api/markets?${p.toString()}`);
                        if (!r.ok) return [] as string[];
                        const j = (await r.json()) as { items: { symbol: string }[] };
                        return (j.items ?? [])
                          .slice(0, n)
                          .map((i) => normalizeSymbol(i.symbol, symbolsQuote));
                      };
                      if (draft.symbolSelection.excludeTopGainers) {
                        const arr = await fetchTopSet('changeUp', draft.symbolSelection.excludeTopGainers);
                        arr.forEach((s) => excludeSet.add(s));
                      }
                      if (draft.symbolSelection.excludeTopLosers) {
                        const arr = await fetchTopSet('changeDown', draft.symbolSelection.excludeTopLosers);
                        arr.forEach((s) => excludeSet.add(s));
                      }
                      const filtered = (json.items ?? []).filter((i) => {
                        const volOk = minVolume > 0 ? (Number(i.volume) || 0) >= minVolume : true;
                        const qvOk =
                          minQuoteVolume > 0 ? (Number(i.quoteVolume) || 0) >= minQuoteVolume : true;
                        const tooNew =
                          typeof draft.symbolSelection.maxListingAgeDays === 'number' &&
                          draft.symbolSelection.maxListingAgeDays > 0
                            ? (i.listedDays ?? Number.MAX_SAFE_INTEGER) <=
                              draft.symbolSelection.maxListingAgeDays
                            : false;
                        const unknownExcluded = excludeUnknownListing ? i.listedDays == null : false;
                        const norm = normalizeSymbol(i.symbol, symbolsQuote);
                        const inRankExclude = excludeSet.has(norm);
                        return volOk && qvOk && !tooNew && !unknownExcluded && !inRankExclude;
                      });
                      const current = new Set(
                        draft.symbolSelection.manualSymbols.map((s) => normalizeSymbol(s, symbolsQuote))
                      );
                      const excluded = new Set(excludedDisplayList);
                      const addList: string[] = [];
                      for (const i of filtered) {
                        const s = normalizeSymbol(i.symbol, symbolsQuote);
                        if (!current.has(s) && !excluded.has(s)) {
                          addList.push(s);
                          if (addList.length >= need) break;
                        }
                      }
                      if (addList.length > 0) {
                        setDraft((d) => ({
                          ...d,
                          symbolSelection: {
                            ...d.symbolSelection,
                            manualSymbols: Array.from(
                              new Set([...d.symbolSelection.manualSymbols, ...addList])
                            )
                          }
                        }));
                      }
                    }}
                    className="rounded border border-emerald-500/50 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10"
                  >
                    나머지 자동 채우기
                  </button>
                </div>

                {/* Manual table bulk overrides */}
                <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                    <span className="text-zinc-400">선택 종목에 일괄 적용:</span>
                    <label className="flex items-center gap-1">
                      <span className="text-zinc-500">레버리지</span>
                      <input
                        type="number"
                        min={1}
                        max={125}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter') return;
                          const value = Math.min(
                            125,
                            Math.max(1, Number((e.target as HTMLInputElement).value) || 1)
                          );
                          const selected = new Set<string>();
                          (document.querySelectorAll(
                            'input[name="sel-manual"]:checked'
                          ) as NodeListOf<HTMLInputElement>).forEach((el) => selected.add(el.value));
                          if (selected.size === 0) return;
                          setDraft((d) => ({
                            ...d,
                            symbolSelection: {
                              ...d.symbolSelection,
                              leverageOverrides: {
                                ...d.symbolSelection.leverageOverrides,
                                ...Object.fromEntries(Array.from(selected).map((s) => [s, value]))
                              }
                            }
                          }));
                          (e.target as HTMLInputElement).value = '';
                        }}
                        placeholder="입력 후 Enter"
                        className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-zinc-500">포지션</span>
                      <select
                        onChange={(e) => {
                          const pref = e.target.value as 'long' | 'short' | 'both';
                          const selected = new Set<string>();
                          (document.querySelectorAll(
                            'input[name="sel-manual"]:checked'
                          ) as NodeListOf<HTMLInputElement>).forEach((el) => selected.add(el.value));
                          if (selected.size === 0) return;
                          setDraft((d) => ({
                            ...d,
                            symbolSelection: {
                              ...d.symbolSelection,
                              positionOverrides: {
                                ...(d.symbolSelection.positionOverrides ?? {}),
                                ...Object.fromEntries(Array.from(selected).map((s) => [s, pref]))
                              }
                            }
                          }));
                          e.currentTarget.selectedIndex = 0;
                        }}
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      >
                        <option value="">선택</option>
                        <option value="long">롱</option>
                        <option value="short">숏</option>
                        <option value="both">헤지(롱+숏)</option>
                      </select>
                    </label>
                  </div>
                  <div className="max-h-56 overflow-auto">
                    <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
                      <colgroup>
                        <col className="w-10" />
                        <col className="w-[40%]" />
                        <col className="w-[25%]" />
                        <col className="w-[25%]" />
                      </colgroup>
                      <thead className="sticky top-0 bg-zinc-950">
                        <tr className="border-b border-zinc-800">
                          <th className="px-2 py-1">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const checked = e.target.checked;
                                (document.querySelectorAll(
                                  'input[name="sel-manual"]'
                                ) as NodeListOf<HTMLInputElement>).forEach((el) => (el.checked = checked));
                              }}
                            />
                          </th>
                          <th className="px-2 py-1">심볼</th>
                          <th className="px-2 py-1">레버리지</th>
                          <th className="px-2 py-1">포지션</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.symbolSelection.manualSymbols.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-2 py-2 text-zinc-500">
                              표시할 종목이 없습니다.
                            </td>
                          </tr>
                        ) : (
                          draft.symbolSelection.manualSymbols.map((s) => {
                            const sym = normalizeSymbol(s, symbolsQuote);
                            const lev = draft.symbolSelection.leverageOverrides[sym] ?? '';
                            const pref = (draft.symbolSelection.positionOverrides ?? {})[sym] ?? '';
                            return (
                              <tr key={`man-row-${sym}`} className="border-b border-zinc-900">
                                <td className="px-2 py-1">
                                  <input name="sel-manual" type="checkbox" value={sym} />
                                </td>
                                <td className="px-2 py-1">
                                  <span className="inline-block max-w-[12rem] truncate align-middle">{sym}</span>
                                </td>
                                <td className="px-2 py-1">
                                  <input
                                    type="number"
                                    min={1}
                                    max={125}
                                    value={lev}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...d,
                                        symbolSelection: {
                                          ...d.symbolSelection,
                                          leverageOverrides: {
                                            ...d.symbolSelection.leverageOverrides,
                                            [sym]: Math.min(125, Math.max(1, Number(e.target.value) || 1))
                                          }
                                        }
                                      }))
                                    }
                                    className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                                  />
                                </td>
                                <td className="px-2 py-1">
                                  <select
                                    value={pref}
                                    onChange={(e) =>
                                      setDraft((d) => ({
                                        ...d,
                                        symbolSelection: {
                                          ...d.symbolSelection,
                                          positionOverrides: {
                                            ...(d.symbolSelection.positionOverrides ?? {}),
                                            [sym]: e.target.value as any
                                          }
                                        }
                                      }))
                                    }
                                    className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                                  >
                                    <option value="">미설정</option>
                                    <option value="long">롱</option>
                                    <option value="short">숏</option>
                                    <option value="both">헤지(롱+숏)</option>
                                  </select>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Ranking fields + recommend */}
              <div className="space-y-3 text-xs text-zinc-300">
                <span className="block">랭킹 기준 (상위 N개, 비우면 제외)</span>
                <div className="grid grid-cols-2 gap-2">
                  {(['market_cap', 'volume', 'top_gainers', 'top_losers'] as const).map((k) => (
                    <label key={k} className="flex items-center gap-2">
                      <span className="w-24 whitespace-nowrap text-zinc-400">{k}</span>
                      <input
                        type="number"
                        value={draft.symbolSelection.ranking[k] ?? ''}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            symbolSelection: {
                              ...d.symbolSelection,
                              ranking: {
                                ...d.symbolSelection.ranking,
                                [k]: e.target.value === '' ? null : Math.max(0, Number(e.target.value) || 0)
                              }
                            }
                          }))
                        }
                        className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      />
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const wanted = draft.symbolSelection.ranking;
                      const fetchTop = async (
                        sort: 'volume' | 'changeUp' | 'changeDown' | 'tradeValue',
                        n: number
                      ) => {
                        if (!n || n <= 0) return [] as string[];
                        const params = new URLSearchParams({ quote: symbolsQuote, sort });
                        const res = await fetch(`/api/markets?${params.toString()}`);
                        if (!res.ok) return [] as string[];
                        const json = (await res.json()) as {
                          items: {
                            symbol: string;
                            volume: number;
                            quoteVolume: number;
                            listedDays?: number | null;
                          }[];
                        };
                        const filtered = (json.items ?? []).filter((i) => {
                          const volOk = minVolume > 0 ? (Number(i.volume) || 0) >= minVolume : true;
                          const qvOk =
                            minQuoteVolume > 0 ? (Number(i.quoteVolume) || 0) >= minQuoteVolume : true;
                          const tooNew =
                            typeof draft.symbolSelection.maxListingAgeDays === 'number' &&
                            draft.symbolSelection.maxListingAgeDays > 0
                              ? (i.listedDays ?? Number.MAX_SAFE_INTEGER) <=
                                draft.symbolSelection.maxListingAgeDays
                              : false;
                          const unknownExcluded = excludeUnknownListing ? i.listedDays == null : false;
                          return volOk && qvOk && !tooNew && !unknownExcluded;
                        });
                        return filtered.slice(0, n).map((i) => i.symbol);
                      };
                      const [vol, up, down, tv] = await Promise.all([
                        fetchTop('volume', wanted.volume ?? 0),
                        fetchTop('changeUp', wanted.top_gainers ?? 0),
                        fetchTop('changeDown', wanted.top_losers ?? 0),
                        fetchTop('tradeValue', wanted.market_cap ?? 0)
                      ]);
                      const applyFilter = (syms: string[]) => {
                        if (!filterStable) return syms;
                        const STABLES = new Set([
                          'USDT',
                          'USDC',
                          'BUSD',
                          'DAI',
                          'TUSD',
                          'FDUSD',
                          'USDP',
                          'USTC'
                        ]);
                        return syms.filter((sym) => {
                          const u = sym.toUpperCase();
                          const base = u.endsWith(symbolsQuote) ? u.slice(0, -symbolsQuote.length) : u;
                          return !STABLES.has(base);
                        });
                      };
                      const union = new Set<string>([
                        ...draft.symbolSelection.manualSymbols,
                        ...applyFilter(vol),
                        ...applyFilter(up),
                        ...applyFilter(down),
                        ...applyFilter(tv)
                      ]);
                      for (const ex of draft.symbolSelection.excludedSymbols) union.delete(ex);
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: { ...d.symbolSelection, manualSymbols: Array.from(union) }
                      }));
                    }}
                    className="rounded border border-emerald-500/50 px-3 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/10"
                  >
                    랭킹으로 추천 추가
                  </button>
                  <span className="text-[11px] text-zinc-500">볼륨/상승/하락/거래대금 상위 N</span>
                </div>
              </div>
            </div>
            )}

            {/* Search (add/exclude) — legacy hidden */}
            <div className="hidden grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <SymbolSelector
                  title="심볼 검색 (추가/제외)"
                  placeholder="심볼 검색 (예: BTC, ETH)"
                  quote={symbolsQuote}
                  recentKey="search"
                  recentMax={recentMax}
                  recentRetentionDays={recentRetentionDays}
                  symbols={draft.symbolSelection.manualSymbols}
                  onAdd={(s) =>
                    setDraft((d) => ({
                      ...d,
                      symbolSelection: {
                        ...d.symbolSelection,
                        manualSymbols: uniqueAppend(d.symbolSelection.manualSymbols, normalizeSymbol(s, symbolsQuote))
                      }
                    }))
                  }
                  onRemove={(s) =>
                    setDraft((d) => ({
                      ...d,
                      symbolSelection: {
                        ...d.symbolSelection,
                        manualSymbols: removeSymbol(
                          d.symbolSelection.manualSymbols,
                          normalizeSymbol(s, symbolsQuote)
                        )
                      }
                    }))
                  }
                  onExcludeAdd={(s) =>
                    setDraft((d) => ({
                      ...d,
                      symbolSelection: {
                        ...d.symbolSelection,
                        excludedSymbols: uniqueAppend(d.symbolSelection.excludedSymbols, s)
                      }
                    }))
                  }
                  enableSort
                />
                <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                  <span>현재 {excludedDisplayList.length}개</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(excludedDisplayList)}
                    className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    복사
                  </button>
                  <button
                    type="button"
                    onClick={() => exportList(excludedDisplayList, `exclude-${symbolsQuote.toLowerCase()}.txt`)}
                    className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    내보내기
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      exportJsonList(
                        excludedDisplayList,
                        `exclude-${symbolsQuote.toLowerCase()}.json`,
                        'exclude'
                      )
                    }
                    className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    JSON 내보내기
                  </button>
                  <button
                    type="button"
                    onClick={() => excludeImportRef.current?.click()}
                    className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    가져오기
                  </button>
                  <input
                    type="file"
                    accept=".txt,.csv,text/plain"
                    ref={excludeImportRef}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      await importFromFile(f, (syms) => {
                        const nextSet = new Set([
                          ...draft.symbolSelection.excludedSymbols,
                          ...syms
                        ]);
                        setDraft((d) => ({
                          ...d,
                          symbolSelection: {
                            ...d.symbolSelection,
                            excludedSymbols: Array.from(nextSet)
                          }
                        }));
                      });
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => excludeJsonImportRef.current?.click()}
                    className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    JSON 가져오기
                  </button>
                  <input
                    type="file"
                    accept="application/json,.json"
                    ref={excludeJsonImportRef}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const parsed = await parseJsonSymbols(f);
                      const sourceQuote = parsed.quote;
                      const normalized = parsed.items
                        .map((t) => normalizeSymbol(t, symbolsQuote))
                        .filter((s) => s.length > 0);
                      const before = draft.symbolSelection.excludedSymbols.length;
                      const nextSet = new Set([
                        ...draft.symbolSelection.excludedSymbols,
                        ...normalized
                      ]);
                      const after = nextSet.size;
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: {
                          ...d.symbolSelection,
                          excludedSymbols: Array.from(nextSet)
                        }
                      }));
                      const added = Math.max(0, after - before);
                      const dup = Math.max(0, normalized.length - added);
                      const mismatch = sourceQuote && sourceQuote !== symbolsQuote;
                      setExcludeImportNote(
                        `JSON 가져오기: ${added}개 추가${dup ? ', ' + dup + '개 중복 제외' : ''}${
                          mismatch
                            ? ' (파일 쿼트 ' + sourceQuote + ' → 현재 ' + symbolsQuote + ')'
                            : ''
                        }`
                      );
                      e.currentTarget.value = '';
                    }}
                    className="hidden"
                  />
                </div>
              </div>

              {/* Exclude bulk + rules */}
              <div className="space-y-2">
                <label className="text-xs text-zinc-300">제외 종목 일괄 추가</label>
                <textarea
                  value={bulkExcludeText}
                  onChange={(e) => setBulkExcludeText(e.target.value)}
                  placeholder="심볼을 쉼표, 공백, 줄바꿈으로 구분해 입력 (예: BTC/USDT,ethusdt sol/usdt)"
                  className="h-20 w-full rounded border border-zinc-700 bg-zinc-900 p-2 text-xs text-zinc-100"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const parts = bulkExcludeText
                        .split(/[^A-Za-z0-9]+/g)
                        .map((t) => normalizeSymbol(t, symbolsQuote))
                        .filter((s) => s.length > 0);
                      if (parts.length === 0) return;
                      const nextSet = new Set([
                        ...draft.symbolSelection.excludedSymbols,
                        ...parts
                      ]);
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: {
                          ...d.symbolSelection,
                          excludedSymbols: Array.from(nextSet)
                        }
                      }));
                      setBulkExcludeText('');
                    }}
                    className="rounded border border-zinc-700 px-3 py-1 text-[11px] font-semibold text-zinc-300 hover:border-emerald-500 hover:text-emerald-300"
                  >
                    일괄 추가
                  </button>
                  <button
                    type="button"
                    onClick={() => setBulkExcludeText('')}
                    className="rounded border border-zinc-800 px-3 py-1 text-[11px] text-zinc-400 hover:text-zinc-200"
                  >
                    입력 지우기
                  </button>
                  <div className="ml-auto" />
                </div>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-300">
                    <label className="flex items-center gap-1">
                      <span className="text-zinc-400">상승률 상위 제외</span>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={draft.symbolSelection.excludeTopGainers ?? ''}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            symbolSelection: {
                              ...d.symbolSelection,
                              excludeTopGainers:
                                e.target.value === ''
                                  ? null
                                  : Math.min(1000, Math.max(1, Number(e.target.value) || 1))
                            }
                          }))
                        }
                        placeholder="예: 20"
                        className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-zinc-400">하락률 상위 제외</span>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={draft.symbolSelection.excludeTopLosers ?? ''}
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            symbolSelection: {
                              ...d.symbolSelection,
                              excludeTopLosers:
                                e.target.value === ''
                                  ? null
                                  : Math.min(1000, Math.max(1, Number(e.target.value) || 1))
                            }
                          }))
                        }
                        placeholder="예: 100"
                        className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      />
                    </label>
                  </div>
                  {draft.symbolSelection.respectDefaultExclusions ? (
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {defaultExcludedNormalized.map((s) => (
                        <span
                          key={`def-${s}`}
                          className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-200"
                        >
                          {s}
                          <span className="rounded border border-amber-500/40 px-1 text-[10px]">기본</span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className="max-h-56 overflow-auto rounded border border-zinc-800 bg-zinc-950/60">
                    <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
                      <colgroup>
                        <col className="w-12" />
                        <col />
                      </colgroup>
                      <thead className="sticky top-0 bg-zinc-950">
                        <tr className="border-b border-zinc-800">
                          <th className="px-2 py-1">#</th>
                          <th className="px-2 py-1">심볼 / 규칙</th>
                        </tr>
                      </thead>
                      <tbody>
                        {draft.symbolSelection.maxListingAgeDays ? (
                          <tr>
                            <td className="px-2 py-1 text-zinc-500">1</td>
                            <td className="px-2 py-1 text-amber-300">
                              상장일 {draft.symbolSelection.maxListingAgeDays}일 이하 제외
                            </td>
                          </tr>
                        ) : null}
                        {draft.symbolSelection.excludeTopGainers ? (
                          <tr>
                            <td className="px-2 py-1 text-zinc-500">2</td>
                            <td className="px-2 py-1 text-amber-300">
                              상승률 상위 {draft.symbolSelection.excludeTopGainers}위 제외
                            </td>
                          </tr>
                        ) : null}
                        {draft.symbolSelection.excludeTopLosers ? (
                          <tr>
                            <td className="px-2 py-1 text-zinc-500">3</td>
                            <td className="px-2 py-1 text-amber-300">
                              하락률 상위 {draft.symbolSelection.excludeTopLosers}위 제외
                            </td>
                          </tr>
                        ) : null}
                        {excludedDisplayList.length === 0 ? (
                          <tr>
                            <td className="px-2 py-2 text-zinc-500">-</td>
                            <td className="px-2 py-2 text-zinc-500">제외 목록이 비어 있습니다.</td>
                          </tr>
                        ) : (
                          excludedDisplayList.map((s, idx) => (
                            <tr key={`ex-row-${s}`} className="border-b border-zinc-900">
                              <td className="px-2 py-1 text-zinc-500">{idx + 1}</td>
                              <td className="px-2 py-1">
                                <div className="flex items-center gap-2">
                                  <span className="max-w-[12rem] truncate">{s}</span>
                                  {!defaultExcludedNormalized.includes(s) ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setDraft((d) => ({
                                          ...d,
                                          symbolSelection: {
                                            ...d.symbolSelection,
                                            excludedSymbols: removeSymbol(
                                              d.symbolSelection.excludedSymbols,
                                              s
                                            )
                                          }
                                        }))
                                      }
                                      className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-400 hover:text-rose-300"
                                    >
                                      해제
                                    </button>
                                  ) : (
                                    <span className="rounded border border-amber-500/40 px-1 text-[10px] text-amber-300">
                                      기본
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                {excludeImportNote ? (
                  <div className="rounded border border-emerald-500/40 bg-emerald-500/10 p-2 text-[11px] text-emerald-300">
                    {excludeImportNote}
                  </div>
                ) : null}
                <label className="mt-4 flex items-center gap-2 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    checked={draft.symbolSelection.respectDefaultExclusions}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: {
                          ...d.symbolSelection,
                          respectDefaultExclusions: e.target.checked
                        }
                      }))
                    }
                    className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                  />
                  기본 제외 목록 존중 (스테이블 페어 등)
                </label>
              </div>
            </div>

            {/* Overrides (hidden) */}
            {false && (
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs text-zinc-300">
                <span className="w-28 text-zinc-400">레버리지 모드</span>
                <select
                  value={draft.symbolSelection.leverageMode}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      symbolSelection: {
                        ...d.symbolSelection,
                        leverageMode: e.target.value as Draft['symbolSelection']['leverageMode']
                      }
                    }))
                  }
                  className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
                >
                  <option value="uniform">일괄</option>
                  <option value="custom">종목별</option>
                </select>
              </label>
              {draft.symbolSelection.leverageMode === 'custom' ? (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <SymbolSelector
                      title="오버라이드 추가"
                      placeholder="심볼 검색"
                      quote={symbolsQuote}
                      recentMax={recentMax}
                      recentRetentionDays={recentRetentionDays}
                      symbols={[]}
                      onAdd={(sym) =>
                        setDraft((d) => ({
                          ...d,
                          symbolSelection: {
                            ...d.symbolSelection,
                            leverageOverrides: {
                              ...d.symbolSelection.leverageOverrides,
                              [normalizeSymbol(sym, symbolsQuote)]:
                                d.symbolSelection.leverageOverrides[
                                  normalizeSymbol(sym, symbolsQuote)
                                ] ?? 5
                            }
                          }
                        }))
                      }
                      onRemove={() => {}}
                    />
                    <span className="text-[11px] text-zinc-500">클릭 후 우측에서 레버리지 조정</span>
                    {Object.keys(draft.symbolSelection.leverageOverrides).length > 0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            symbolSelection: { ...d.symbolSelection, leverageOverrides: {} }
                          }))
                        }
                        className="ml-auto rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-300"
                      >
                        전체 삭제
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {Object.entries(draft.symbolSelection.leverageOverrides).length === 0 ? (
                      <p className="text-[11px] text-zinc-500">오버라이드가 없습니다.</p>
                    ) : (
                      Object.entries(draft.symbolSelection.leverageOverrides)
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([symbol, lev]) => (
                          <div
                            key={symbol}
                            className="flex flex-wrap items-center gap-2 text-xs text-zinc-300"
                          >
                            <span className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]">
                              {symbol}
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={125}
                              step={1}
                              value={lev}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  symbolSelection: {
                                    ...d.symbolSelection,
                                    leverageOverrides: {
                                      ...d.symbolSelection.leverageOverrides,
                                      [symbol]: Math.min(125, Math.max(1, Number(e.target.value) || 1))
                                    }
                                  }
                                }))
                              }
                              className="w-24 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                            />
                            <input
                              type="range"
                              min={1}
                              max={125}
                              step={1}
                              value={lev}
                              onChange={(e) =>
                                setDraft((d) => ({
                                  ...d,
                                  symbolSelection: {
                                    ...d.symbolSelection,
                                    leverageOverrides: {
                                      ...d.symbolSelection.leverageOverrides,
                                      [symbol]: Math.min(125, Math.max(1, Number(e.target.value) || 1))
                                    }
                                  }
                                }))
                              }
                              className="w-48 accent-emerald-400"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setDraft((d) => ({
                                  ...d,
                                  symbolSelection: {
                                    ...d.symbolSelection,
                                    leverageOverrides: Object.fromEntries(
                                      Object.entries(d.symbolSelection.leverageOverrides).filter(
                                        ([k]) => k !== symbol
                                      )
                                    )
                                  }
                                }))
                              }
                              className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-300"
                            >
                              제거
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 text-xs text-zinc-300">
                  <span className="w-28 text-zinc-400">포지션 오버라이드</span>
                </div>
                <div className="flex items-center gap-2">
                  <SymbolSelector
                    title="오버라이드 추가"
                    placeholder="심볼 검색"
                    quote={symbolsQuote}
                    recentMax={recentMax}
                    recentRetentionDays={recentRetentionDays}
                    symbols={[]}
                    onAdd={(sym) =>
                      setDraft((d) => ({
                        ...d,
                        symbolSelection: {
                          ...d.symbolSelection,
                          positionOverrides: {
                            ...(d.symbolSelection.positionOverrides ?? {}),
                            [normalizeSymbol(sym, symbolsQuote)]:
                              (d.symbolSelection.positionOverrides ?? {})[
                                normalizeSymbol(sym, symbolsQuote)
                              ] ?? 'long'
                          }
                        }
                      }))
                    }
                    onRemove={() => {}}
                  />
                  {Object.keys(draft.symbolSelection.positionOverrides ?? {}).length > 0 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          symbolSelection: { ...d.symbolSelection, positionOverrides: {} }
                        }))
                      }
                      className="ml-auto rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-300"
                    >
                      전체 삭제
                    </button>
                  ) : null}
                </div>
                <div className="space-y-2">
                  {Object.entries(draft.symbolSelection.positionOverrides ?? {}).length === 0 ? (
                    <p className="text-[11px] text-zinc-500">오버라이드가 없습니다.</p>
                  ) : (
                    Object.entries(draft.symbolSelection.positionOverrides ?? {})
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([symbol, pref]) => (
                        <div
                          key={`pos-${symbol}`}
                          className="flex flex-wrap items-center gap-2 text-xs text-zinc-300"
                        >
                          <span className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px]">
                            {symbol}
                          </span>
                          <select
                            value={pref}
                            onChange={(e) =>
                              setDraft((d) => ({
                                ...d,
                                symbolSelection: {
                                  ...d.symbolSelection,
                                  positionOverrides: {
                                    ...(d.symbolSelection.positionOverrides ?? {}),
                                    [symbol]: (e.target.value as 'long' | 'short' | 'both')
                                  }
                                }
                              }))
                            }
                            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                          >
                            <option value="long">롱</option>
                            <option value="short">숏</option>
                            <option value="both">헤지(롱+숏)</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                symbolSelection: {
                                  ...d.symbolSelection,
                                  positionOverrides: Object.fromEntries(
                                    Object.entries(d.symbolSelection.positionOverrides ?? {}).filter(
                                      ([k]) => k !== symbol
                                    )
                                  )
                                }
                              }))
                            }
                            className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-400 hover:text-rose-300"
                          >
                            제거
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        </SectionFrame>
      </div>

      {/* Basic section */}
      <div className="order-1">
        <SectionFrame
          sectionKey="basic"
          title="기본 설정"
          description="레버리지, 종목 수, 포지션/자산 모드를 설정합니다."
          isDirty={basicDirty}
          helpTitle="기본 설정 도움말"
          helpContent={helpContent.basic}
          onSave={handleSaveBasic}
        >
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 text-xs text-zinc-300">
            <label className="flex items-center gap-2">
              <span className="w-24 whitespace-nowrap text-zinc-400 inline-flex items-center gap-1">로직명 <InfoTip title="전략을 식별하기 위한 이름" /></span>
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <input
                  type="text"
                  value={draft.logicName}
                  onChange={(e) => setDraft((d) => ({ ...d, logicName: e.target.value }))}
                  onBlur={() => {
                    /* noop: 중복확인은 모달에서 처리 */
                  }}
                  ref={logicNameRef}
                  className={`flex-1 rounded border bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100 ${
                    (errors as any).basic.logicName ? 'border-rose-500/70' : 'border-zinc-700'
                  }`}
                />
                <button type="button" onClick={() => setShowNameModal(true)} className="whitespace-nowrap rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300">관리…</button>
              </div>
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 whitespace-nowrap text-zinc-400 inline-flex items-center gap-1">데이터 프레임 <InfoTip title="캔들 인터벌(예: 15m, 1h)" /></span>
              <select
                value={draft.timeframe}
                onChange={(e) => setDraft((d) => ({ ...d, timeframe: e.target.value as Draft['timeframe'] }))}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
              >
                {(['1m','3m','5m','15m','1h','4h','8h','12h','24h'] as const).map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 whitespace-nowrap text-zinc-400 inline-flex items-center gap-1">레버리지 <InfoTip title="전역 기본 레버리지(종목별 오버라이드로 대체 가능)" /></span>
              <input
                type="number"
                min={1}
                max={125}
                value={draft.leverage}
                onChange={(e) => setDraft((d) => ({ ...d, leverage: Math.min(125, Math.max(1, Number(e.target.value) || 1)) }))}
                ref={leverageRef}
                className={`flex-1 rounded border bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100 ${
                  (errors as any).basic.leverage ? 'border-rose-500/70' : 'border-zinc-700'
                }`}
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 whitespace-nowrap text-zinc-400 inline-flex items-center gap-1">종목 수 <InfoTip title="선택 목표 종목 개수" /></span>
              <input
                type="number"
                min={1}
                max={50}
                value={draft.symbolCount}
                onChange={(e) => setDraft((d) => ({ ...d, symbolCount: Math.min(50, Math.max(1, Number(e.target.value) || 1)) }))}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
              />
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 whitespace-nowrap text-zinc-400 inline-flex items-center gap-1">자산 모드 <InfoTip title="Single: 단일 자산, Multi: 여러 자산 간 상쇄" /></span>
              <select
                value={draft.assetMode}
                onChange={(e) => setDraft((d) => ({ ...d, assetMode: e.target.value as Draft['assetMode'] }))}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
              >
                <option value="single">Single-Asset</option>
                <option value="multi">Multi-Assets</option>
              </select>
            </label>

            <label className="flex items-center gap-2">
              <span className="w-24 whitespace-nowrap text-zinc-400 inline-flex items-center gap-1">포지션 모드 <InfoTip title="One-Way: 단일 방향, Hedge: 롱/숏 동시 보유" /></span>
              <select
                value={draft.positionMode}
                onChange={(e) => setDraft((d) => ({ ...d, positionMode: e.target.value as Draft['positionMode'] }))}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[12px] text-zinc-100"
              >
                <option value="one_way">One-Way</option>
                <option value="hedge">Hedge</option>
              </select>
              <ServerModeBadge />
            </label>

            {/* 인라인 이름 관리는 제거하고 모달로 통합 */}

            <p className="col-span-full text-[10px] text-zinc-500">
              교차 마진/거래소 제한 고려 · 분산/집중에 맞춘 종목 수 선택
            </p>
          </div>
        </SectionFrame>
      </div>

      {/* Capital (투자 자금) section */}
      <div className="order-3">
      <SectionFrame
        sectionKey="capital"
        title="투자 자금 설정"
        description="종목 선택의 쿼트를 기준으로 투자금/최초·추가 매수 금액과 한도를 설정합니다."
        isDirty={useSectionDirtyFlag(settings.capital, draft.capital)}
        helpTitle="투자 자금 설정"
        helpContent={helpContent.capital}
        onSave={async () => {
          // Validate budget vs max limit before saving
          const prev = settings.capital;
          const cap = draft.capital as any;
          const count = Math.max(1, draft.symbolCount || 1);
          const base = Number(cap.estimatedBalance) || 0;
          const maxPct = Math.max(0, Math.min(100, cap.maxMargin?.percentage ?? 0));
          const basis = String(cap.maxMargin?.basis ?? 'wallet');
          const balances = { wallet: base, total: base, free: base } as any;
          // compute base by basis using last fetched balances when available would be better; here we use estimatedBalance as base.
          const basisAmount = (b: string, perSymbol: boolean) => {
            const bb = b === 'wallet' ? (balances.wallet ?? base) : b === 'total' ? (balances.total ?? base) : (balances.free ?? base);
            return perSymbol ? bb / count : bb;
          };
          const maxBudget = (basisAmount(basis, false) * maxPct) / 100;
          // initial total
          const im = cap.initialMargin;
          let initialTotal = 0;
          if (im?.mode === 'usdt_amount') initialTotal = Number(im.usdtAmount) || 0;
          else if (im?.mode === 'min_notional') initialTotal = Number(im.minNotional || 0) * count;
          else if (im?.mode === 'per_symbol_percentage') initialTotal = basisAmount(im.basis ?? basis, true) * ((Number(im.percentage) || 0) / 100) * count;
          else if (im?.mode === 'all_symbols_percentage') initialTotal = basisAmount(im.basis ?? basis, false) * ((Number(im.percentage) || 0) / 100);
          // scale total
          const sb = cap.scaleInBudget;
          let scaleTotal = 0;
          if (sb?.mode === 'usdt_amount') scaleTotal = Number(sb.usdtAmount) || 0;
          else if (sb?.mode === 'min_notional') scaleTotal = Number(sb.minNotional || 0) * count;
          else if (sb?.mode === 'per_symbol_percentage') scaleTotal = basisAmount(sb.basis ?? basis, true) * ((Number(sb.percentage) || 0) / 100) * count;
          else if (sb?.mode === 'balance_percentage') scaleTotal = basisAmount(sb.basis ?? basis, false) * ((Number(sb.percentage) || 0) / 100);
          const used = Math.max(0, initialTotal) + Math.max(0, scaleTotal);
          if (used > maxBudget + 1e-8) {
            // Auto-rescale if enabled
            if ((cap as any).autoRescale) {
              let newInitialTotal = initialTotal;
              let newScaleTotal = scaleTotal;
              const keepRatio = Boolean((cap as any).preserveRatio);
              if (keepRatio && used > 0) {
                const k = maxBudget / used;
                newInitialTotal = newInitialTotal * k;
                newScaleTotal = newScaleTotal * k;
              } else {
                const delta = used - maxBudget;
                const reduceScale = Math.min(newScaleTotal, delta);
                newScaleTotal -= reduceScale;
                const remaining = delta - reduceScale;
                if (remaining > 0) newInitialTotal = Math.max(0, newInitialTotal - remaining);
              }

              const clampPct = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
              const round2 = (v: number) => Math.round(v * 100) / 100;
              const basisFor = (b?: string) => String(b ?? basis);
              const perBase = (b?: string) => basisAmount(basisFor(b), true);
              const totBase = (b?: string) => basisAmount(basisFor(b), false);

              const im = { ...cap.initialMargin } as any;
              if (im.mode === 'usdt_amount') im.usdtAmount = round2(newInitialTotal);
              else if (im.mode === 'min_notional') im.minNotional = round2(newInitialTotal / count);
              else if (im.mode === 'per_symbol_percentage') im.percentage = clampPct((newInitialTotal / count / Math.max(1e-9, perBase(im.basis))) * 100);
              else if (im.mode === 'all_symbols_percentage') im.percentage = clampPct((newInitialTotal / Math.max(1e-9, totBase(im.basis))) * 100);

              const sb = { ...cap.scaleInBudget } as any;
              if (sb.mode === 'usdt_amount') sb.usdtAmount = round2(newScaleTotal);
              else if (sb.mode === 'min_notional') sb.minNotional = round2(newScaleTotal / count);
              else if (sb.mode === 'per_symbol_percentage') sb.percentage = clampPct((newScaleTotal / count / Math.max(1e-9, perBase(sb.basis))) * 100);
              else if (sb.mode === 'balance_percentage') sb.percentage = clampPct((newScaleTotal / Math.max(1e-9, totBase(sb.basis))) * 100);

              const adjusted = { ...(cap as any), initialMargin: im, scaleInBudget: sb } as any;
              updateSettings((d) => { d.capital = adjusted; d.metadata.lastSavedAt = new Date().toISOString(); });
              return () => { setDraft((dr) => ({ ...dr, capital: prev })); updateSettings((d) => { d.capital = prev; d.metadata.lastSavedAt = new Date().toISOString(); }); };
            } else {
              const fmt = (n: number) => (n >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n.toFixed(2));
              const diff = used - maxBudget;
              throw new Error(`투자 한도 초과: 사용 ${fmt(used)} / 한도 ${fmt(maxBudget)} (초과 ${fmt(diff)})\n초기·추매 금액을 줄이거나 한도를 높여주세요.`);
            }
          }
          updateSettings((d) => { d.capital = draft.capital; d.metadata.lastSavedAt = new Date().toISOString(); });
          return () => { setDraft((dr) => ({ ...dr, capital: prev })); updateSettings((d) => { d.capital = prev; d.metadata.lastSavedAt = new Date().toISOString(); }); };
        }}
      >
        <div className="space-y-3">
          <CapitalSettingsPanel
            capital={draft.capital as any}
            symbolCount={draft.symbolCount}
            manualSymbols={draft.symbolSelection.manualSymbols}
            leverage={settings.leverage}
            quoteFromSymbols={symbolsQuote}
            onChange={(next) => setDraft((d) => ({ ...d, capital: next as any }))}
          />
        </div>
      </SectionFrame>
      </div>

      {/* Entry (매수) section */}
      <div className="order-4">
        <SectionFrame
          sectionKey="entry"
          title="진입(매수) 설정"
          description="즉시 매수 또는 지표 기반 진입 조건을 설정합니다."
          isDirty={entryDirty}
          forceEnableSave
          helpTitle="진입(매수) 도움말"
          helpContent={helpContent.entry}
          onSave={handleSaveEntry}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {(['long', 'short'] as const).map((dir) => (
              <div key={`entry-${dir}`} className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3">
                  <span className="w-10 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-[11px]">{dir === 'long' ? '롱' : '숏'}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.entry[dir].enabled}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, entry: { ...d.entry, [dir]: { ...d.entry[dir], enabled: e.target.checked } } }))
                      }
                      className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                    />
                    사용
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.entry[dir].immediate}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, entry: { ...d.entry, [dir]: { ...d.entry[dir], immediate: e.target.checked } } }))
                      }
                      className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                    />
                    즉시 매수
                  </label>
                  <span className="ml-auto text-[11px] text-zinc-500">그룹 내 지표를 아래에서 편집하세요 (변경 시 자동 저장됩니다)</span>
                </div>
                  <div className={draft.entry[dir].immediate ? 'pointer-events-none opacity-40' : ''}>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <PreviewLauncher
                        conditions={ensureIndicators(draft.entry[dir].indicators)}
                        symbol={previewSymbol}
                        interval={previewInterval as any}
                        direction={dir}
                        indicatorSignals={undefined}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-zinc-400" />
                  </div>
                  <GroupListPanelV2
                  value={ensureIndicators(draft.entry[dir].indicators)}
                  onChange={(next) => {
                    // 1) 로컬 드래프트 갱신
                    setDraft((d) => ({
                      ...d,
                      entry: { ...d.entry, [dir]: { ...d.entry[dir], indicators: next } }
                    }));
                    // 2) 즉시 영속화(섹션 저장 없이도 유지)
                    // Raw 저장으로 즉시 보존(정규화 우회)
                    updateIndicatorsRaw({ type: 'entry', direction: dir }, toNormalizedCompatIndicatorConditions(next));
                  }}
                  preview={{ symbol: previewSymbol, interval: previewInterval as any, direction: dir }}
                />
                </div>
              </div>
            ))}
          </div>
        </SectionFrame>
      </div>

      {/* Scale-in section */}
      <div className="order-5">
        <SectionFrame
          sectionKey="scaleIn"
          title="추가매수 설정"
          description="조건 충족 시 추가 매수를 수행합니다."
          isDirty={scaleInDirty}
          forceEnableSave
          helpTitle="추가매수 도움말"
          helpContent={helpContent.scaleIn}
          onSave={handleSaveScaleIn}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {(['long', 'short'] as const).map((dir) => (
              <div key={`scalein-${dir}`} className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3">
                  <span className="w-10 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-[11px]">{dir === 'long' ? '롱' : '숏'}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.scaleIn[dir].enabled}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, scaleIn: { ...d.scaleIn, [dir]: { ...d.scaleIn[dir], enabled: e.target.checked } } }))
                      }
                      className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                    />
                    사용
                  </label>
                  <span className="ml-auto text-[11px] text-zinc-500">그룹 내 지표를 아래에서 편집하세요 (변경 시 자동 저장됩니다)</span>
                </div>
                <ProfitRateEditor
                  label="현재 수익률"
                  value={(draft.scaleIn[dir].currentProfitRate ?? { enabled: false, comparator: 'over', value: 0 }) as any}
                  onChange={(next) =>
                    setDraft((d) => ({
                      ...d,
                      scaleIn: { ...d.scaleIn, [dir]: { ...d.scaleIn[dir], currentProfitRate: next } }
                    }))
                  }
                />
                <GroupListPanel
                  value={ensureIndicators(draft.scaleIn[dir].indicators)}
                  preview={{ symbol: previewSymbol, symbolInput: previewSymbolInput, onSymbolChange: setPreviewSymbolInput, quote: previewQuote, datalistOptions: previewDatalistOptions, interval: previewInterval as any, direction: dir, indicatorSignals: buildSignals(ensureIndicators(draft.scaleIn[dir].indicators), assumeSignalsOn) as any, assumeSignalsOn, onToggle: setAssumeSignalsOn, onQuoteChange: setPreviewQuote as any }}
                  groupPreviewInModal={false}
                  onChange={(next) => {
                    setDraft((d) => ({
                      ...d,
                      scaleIn: { ...d.scaleIn, [dir]: { ...d.scaleIn[dir], indicators: next } }
                    }));
                    updateIndicatorsRaw({ type: 'scaleIn', direction: dir }, toNormalizedCompatIndicatorConditions(next));
                  }}
                />
              </div>
            ))}
          </div>
        </SectionFrame>
      </div>

      {/* Exit section */}
      <div className="order-6">
        <SectionFrame
          sectionKey="exit"
          title="매도(청산) 설정"
          description="목표 수익율 및 지표 조건으로 청산 규칙을 구성합니다."
          isDirty={exitDirty}
          forceEnableSave
          helpTitle="매도(청산) 도움말"
          helpContent={helpContent.exit}
          onSave={handleSaveExit}
        >
          <div className="grid gap-4 md:grid-cols-2">
            {(['long', 'short'] as const).map((dir) => (
              <div key={`exit-${dir}`} className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
                <div className="flex items-center gap-3">
                  <span className="w-10 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-center text-[11px]">{dir === 'long' ? '롱' : '숏'}</span>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.exit[dir].enabled}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, exit: { ...d.exit, [dir]: { ...d.exit[dir], enabled: e.target.checked } } }))
                      }
                      className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                    />
                    사용
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.exit[dir].includeFeesFunding)}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, exit: { ...d.exit, [dir]: { ...d.exit[dir], includeFeesFunding: e.target.checked } } }))
                      }
                      className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                    />
                    수수료/펀딩 고려
                  </label>
                  <span className="ml-auto text-[11px] text-zinc-500">그룹 내 지표를 아래에서 편집하세요 (변경 시 자동 저장됩니다)</span>
                </div>
                <ProfitRateEditor
                  label="현재 수익률"
                  value={(draft.exit[dir].currentProfitRate ?? { enabled: false, comparator: 'over', value: 0 }) as any}
                  onChange={(next) => setDraft((d) => ({ ...d, exit: { ...d.exit, [dir]: { ...d.exit[dir], currentProfitRate: next } } }))}
                />
                <GroupListPanel
                  value={ensureIndicators(draft.exit[dir].indicators)}
                  preview={{ symbol: previewSymbol, symbolInput: previewSymbolInput, onSymbolChange: setPreviewSymbolInput, quote: previewQuote, datalistOptions: previewDatalistOptions, interval: previewInterval as any, direction: dir, indicatorSignals: buildSignals(ensureIndicators(draft.exit[dir].indicators), assumeSignalsOn) as any, assumeSignalsOn, onToggle: setAssumeSignalsOn, onQuoteChange: setPreviewQuote as any, enabledDefault: false }}
                  onChange={(next) => {
                    setDraft((d) => ({
                      ...d,
                      exit: { ...d.exit, [dir]: { ...d.exit[dir], indicators: next } }
                    }));
                    updateIndicatorsRaw({ type: 'exit', direction: dir }, toNormalizedCompatIndicatorConditions(next));
                  }}
                />
              </div>
            ))}
          </div>
        </SectionFrame>
      </div>

      {/* Hedge activation section */}
      <div className="order-8">
        <SectionFrame
          sectionKey="hedge"
          title="헤지 모드 설정"
          description="특정 조건에서 헤지(롱+숏)를 활성화합니다."
          isDirty={hedgeDirty}
          forceEnableSave
          helpTitle="헤지 모드 도움말"
          helpContent={helpContent.hedge}
          onSave={handleSaveHedge}
        >
          <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.hedgeActivation.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      hedgeActivation: { ...d.hedgeActivation, enabled: e.target.checked }
                    }))
                  }
                  className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                />
                사용
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.hedgeActivation.directions.includes('long')}
                  onChange={(e) =>
                    setDraft((d) => {
                      const set = new Set(d.hedgeActivation.directions);
                      if (e.target.checked) set.add('long');
                      else set.delete('long');
                      return { ...d, hedgeActivation: { ...d.hedgeActivation, directions: Array.from(set) as any } };
                    })
                  }
                  className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                />
                롱
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.hedgeActivation.directions.includes('short')}
                  onChange={(e) =>
                    setDraft((d) => {
                      const set = new Set(d.hedgeActivation.directions);
                      if (e.target.checked) set.add('short');
                      else set.delete('short');
                      return { ...d, hedgeActivation: { ...d.hedgeActivation, directions: Array.from(set) as any } };
                    })
                  }
                  className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                />
                숏
              </label>
              <span className="ml-auto text-[11px] text-zinc-500">그룹 내 지표를 아래에서 편집하세요 (변경 시 자동 저장됩니다)</span>
            </div>
            <ProfitRateEditor
              label="현재 수익률"
              value={(draft.hedgeActivation.currentProfitRate ?? { enabled: false, comparator: 'over', value: 0 }) as any}
              onChange={(next) => setDraft((d) => ({ ...d, hedgeActivation: { ...d.hedgeActivation, currentProfitRate: next } }))}
            />
            <GroupListPanel
              value={ensureIndicators(draft.hedgeActivation.indicators)}
              preview={{ symbol: previewSymbol, symbolInput: previewSymbolInput, onSymbolChange: setPreviewSymbolInput, quote: previewQuote, datalistOptions: previewDatalistOptions, interval: previewInterval as any, direction: 'long', indicatorSignals: buildSignals(ensureIndicators(draft.hedgeActivation.indicators), assumeSignalsOn) as any, assumeSignalsOn, onToggle: setAssumeSignalsOn, onQuoteChange: setPreviewQuote as any }}
              onChange={(next) => {
                setDraft((d) => ({ ...d, hedgeActivation: { ...d.hedgeActivation, indicators: next } }));
                updateIndicatorsRaw({ type: 'hedge' }, toNormalizedCompatIndicatorConditions(next));
              }}
            />
          </div>
        </SectionFrame>
      </div>

      {/* Stop-loss section */}
      <div className="order-7">
        <SectionFrame
          sectionKey="stopLoss"
          title="포지션 포기(손절) 설정"
          description="손절 라인 및 부가 조건을 설정합니다."
          isDirty={stopLossDirty}
          forceEnableSave
          helpTitle="포지션 포기(손절) 도움말"
          helpContent={helpContent.stopLoss}
          onSave={handleSaveStopLoss}
        >
          <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.stopLoss.stopLossLine.enabled}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      stopLoss: {
                        ...d.stopLoss,
                        stopLossLine: { ...d.stopLoss.stopLossLine, enabled: e.target.checked }
                      }
                    }))
                  }
                  className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                />
                손절 라인 사용
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.stopLoss.stopLossLine.autoRecreate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      stopLoss: {
                        ...d.stopLoss,
                        stopLossLine: { ...d.stopLoss.stopLossLine, autoRecreate: e.target.checked }
                      }
                    }))
                  }
                  className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
                />
                자동 재생성
              </label>
              <span className="ml-auto text-[11px] text-zinc-500">그룹 내 지표를 아래에서 편집하세요 (변경 시 자동 저장됩니다)</span>
            </div>
            <ProfitRateEditor
              label="현재 수익률"
              value={(draft.stopLoss.currentProfitRate ?? { enabled: false, comparator: 'over', value: 0 }) as any}
              onChange={(next) => setDraft((d) => ({ ...d, stopLoss: { ...d.stopLoss, currentProfitRate: next } }))}
            />
            <GroupListPanel
              value={ensureIndicators(draft.stopLoss.stopLossLine.indicators)}
              preview={{ symbol: previewSymbol, symbolInput: previewSymbolInput, onSymbolChange: setPreviewSymbolInput, quote: previewQuote, datalistOptions: previewDatalistOptions, interval: previewInterval as any, direction: 'long', indicatorSignals: buildSignals(ensureIndicators(draft.stopLoss.stopLossLine.indicators), assumeSignalsOn) as any, assumeSignalsOn, onToggle: setAssumeSignalsOn, onQuoteChange: setPreviewQuote as any }}
              onChange={(next) => {
                setDraft((d) => ({
                  ...d,
                  stopLoss: { ...d.stopLoss, stopLossLine: { ...d.stopLoss.stopLossLine, indicators: next } }
                }));
                updateIndicatorsRaw({ type: 'stopLossLine' }, toNormalizedCompatIndicatorConditions(next));
              }}
            />
          </div>
        </SectionFrame>
  </div>

  {/* Footer */}
  <div className="order-10">
    <LogicSummary settings={draft} />
  </div>
  <div className="order-11">
    <FooterActions />
  </div>
  <div className="order-12">
    <StrategyManagerPanel />
  </div>
  <LogicNameManagerModal
    open={showNameModal}
    current={draft.logicName}
    onApply={(name) => setDraft((d) => ({ ...d, logicName: name }))}
    onClose={() => setShowNameModal(false)}
  />
</div>
  );
}

function ServerModeBadge() {
  const [serverMode, setServerMode] = useState<'one_way' | 'hedge' | 'unknown'>('unknown');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/trading/binance/position-mode');
        const json = await res.json();
        if (!alive) return;
        if (json?.ok && (json.positionMode === 'one_way' || json.positionMode === 'hedge')) setServerMode(json.positionMode);
      } catch {
        /* noop */
      }
    })();
    return () => { alive = false; };
  }, []);
  if (serverMode === 'unknown') return <span className="text-[11px] text-zinc-500">서버 모드 알 수 없음</span>;
  return <span className="text-[11px] text-zinc-400">서버 모드: {serverMode === 'one_way' ? 'One-Way' : 'Hedge'}</span>;
}
