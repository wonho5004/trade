'use client';

import { Fragment, useEffect, useMemo, useState, useTransition } from 'react';

import { useChartStore } from '@/stores/chartStore';
import type { ChartState } from '@/stores/chartStore';
import { useIndicatorConfigStore } from '@/stores/indicatorConfigStore';
import type { IntervalOption } from '@/types/chart';
import type {
  CandleFieldOption,
  LineStyleOption,
  MaConfig,
  MarkerShapeOption
} from '@/types/indicator';

import { useDebounce } from '@/hooks/useDebounce';
import type { QuoteCurrency, TickerInfo } from '@/types/assets';

const intervalOptions: IntervalOption[] = ['1m', '3m', '5m', '15m', '1h', '4h', '1d', '1w'];
const quoteOptions: QuoteCurrency[] = ['USDT', 'USDC'];
const sortOptions: Array<{
  value: 'volume' | 'tradeValue' | 'changeUp' | 'changeDown' | 'alphabet';
  label: string;
}> = [
  { value: 'volume', label: '거래량순' },
  { value: 'tradeValue', label: '거래금액순' },
  { value: 'changeUp', label: '상승률순' },
  { value: 'changeDown', label: '하락률순' },
  { value: 'alphabet', label: '알파벳순' }
];

const overlayLabels: Array<{
  key: keyof ChartState['overlays'];
  label: string;
  configurable?: boolean;
}> = [
  { key: 'ma', label: 'MA', configurable: true },
  { key: 'bollinger', label: 'Bollinger Bands', configurable: true },
  { key: 'rsi', label: 'RSI', configurable: true },
  { key: 'macd', label: 'MACD', configurable: true },
  { key: 'dmi', label: 'DMI', configurable: true },
  { key: 'highlight', label: '드로잉', configurable: false }
];

const lineStyleOptions: Array<{ value: LineStyleOption; label: string }> = [
  { value: 'solid', label: '실선' },
  { value: 'dashed', label: '파선' },
  { value: 'dotted', label: '점선' }
];

const candleFieldOptions: Array<{ value: CandleFieldOption; label: string }> = [
  { value: 'open', label: '시가' },
  { value: 'high', label: '고가' },
  { value: 'low', label: '저가' },
  { value: 'close', label: '종가' }
];

const markerShapeOptions: Array<{ value: MarkerShapeOption; label: string }> = [
  { value: 'arrowUp', label: '상승 화살표' },
  { value: 'arrowDown', label: '하락 화살표' },
  { value: 'circle', label: '원형' },
  { value: 'square', label: '사각형' }
];

export function ChartControlPanel() {
  const interval = useChartStore((state) => state.interval);
  const setInterval = useChartStore((state) => state.setInterval);
  const overlays = useChartStore((state) => state.overlays);
  const toggleOverlay = useChartStore((state) => state.toggleOverlay);
  const setOverlay = useChartStore((state) => state.setOverlay);
  const symbol = useChartStore((state) => state.symbol);
  const setSymbol = useChartStore((state) => state.setSymbol);

  const {
    ma,
    addMa,
    updateMa,
    removeMa,
    bollinger,
    updateBollinger,
    updateBollingerStyle,
    updateBollingerHighlightThreshold,
    rsi,
    updateRsi,
    updateRsiStyle,
    updateRsiHighlightThreshold,
    macd,
    updateMacd,
    updateMacdLine,
    updateMacdHighlightThreshold,
    updateMacdHistogramColor,
    updateMacdVisibility,
    dmi,
    updateDmi,
    updateDmiStyle,
    updateDmiVisibility,
    updateDmiDominanceHighlight,
    updateDmiDominanceThreshold,
    updateDmiValueHighlight,
    updateMaHighlight,
    updateMaHighlightThreshold,
    refreshMaLines,
    resetMa,
    resetBollinger,
    resetRsi,
    resetMacd,
    resetDmi,
    resetHighlights,
    reset
  } = useIndicatorConfigStore((state) => ({
    ma: state.ma,
    addMa: state.addMa,
    updateMa: state.updateMa,
    removeMa: state.removeMa,
    bollinger: state.bollinger,
    updateBollinger: state.updateBollinger,
    updateBollingerStyle: state.updateBollingerStyle,
    updateBollingerHighlightThreshold: state.updateBollingerHighlightThreshold,
    rsi: state.rsi,
    updateRsi: state.updateRsi,
    updateRsiStyle: state.updateRsiStyle,
    updateRsiHighlightThreshold: state.updateRsiHighlightThreshold,
    macd: state.macd,
    updateMacd: state.updateMacd,
    updateMacdLine: state.updateMacdLine,
    updateMacdHighlightThreshold: state.updateMacdHighlightThreshold,
    updateMacdHistogramColor: state.updateMacdHistogramColor,
    updateMacdVisibility: state.updateMacdVisibility,
    dmi: state.dmi,
    updateDmi: state.updateDmi,
    updateDmiStyle: state.updateDmiStyle,
    updateDmiVisibility: state.updateDmiVisibility,
    updateDmiDominanceHighlight: state.updateDmiDominanceHighlight,
    updateDmiDominanceThreshold: state.updateDmiDominanceThreshold,
    updateDmiValueHighlight: state.updateDmiValueHighlight,
    updateMaHighlight: state.updateMaHighlight,
    updateMaHighlightThreshold: state.updateMaHighlightThreshold,
    refreshMaLines: state.refreshMa,
    resetMa: state.resetMa,
    resetBollinger: state.resetBollinger,
    resetRsi: state.resetRsi,
    resetMacd: state.resetMacd,
    resetDmi: state.resetDmi,
    resetHighlights: state.resetHighlights,
    reset: state.reset
  }));

  const [isPending, startTransition] = useTransition();
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteCurrency>('USDT');
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<'alphabet' | 'volume' | 'tradeValue' | 'changeUp' | 'changeDown'>(
    'volume'
  );
  const [isSymbolOpen, setIsSymbolOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 200);
  const [isLoadingTickers, setIsLoadingTickers] = useState(false);
  const [tickers, setTickers] = useState<TickerInfo[]>([]);

  useEffect(() => {
    setSearch('');
  }, [symbol]);

  const activeMaCount = useMemo(() => Math.min(5, ma.length), [ma.length]);

  const highlightSummary = useMemo(() => {
    const sections: string[] = [];
    if (ma.some((item) => item.highlight.over.enabled || item.highlight.under.enabled)) {
      sections.push('MA');
    }
    if (bollinger.highlight.upper.enabled || bollinger.highlight.lower.enabled) {
      sections.push('BOLL');
    }
    if (rsi.highlight.overbought.enabled || rsi.highlight.oversold.enabled) {
      sections.push('RSI');
    }
    if (
      macd.highlight.histogram.turnUp.enabled ||
      macd.highlight.histogram.turnDown.enabled ||
      macd.highlight.crossover.bullish.enabled ||
      macd.highlight.crossover.bearish.enabled
    ) {
      sections.push('MACD');
    }
    if (
      dmi.highlight.dominance.plusOverMinus.enabled ||
      dmi.highlight.dominance.minusOverPlus.enabled ||
      dmi.highlight.adx.over.enabled ||
      dmi.highlight.adx.under.enabled ||
      dmi.highlight.adxr.over.enabled ||
      dmi.highlight.adxr.under.enabled
    ) {
      sections.push('DMI');
    }
    return sections.length ? sections.join(', ') : '설정 없음';
  }, [ma, bollinger.highlight, rsi.highlight, macd.highlight, dmi.highlight]);

  const highlightActive = overlays.highlight;

  const ensureMaVisible = () => {
    if (!overlays.ma) {
      setOverlay('ma', true);
    }
    refreshMaLines();
  };

  const handleHighlightEnable = () => {
    if (!overlays.highlight) {
      setOverlay('highlight', true);
    }
    ensureMaVisible();
  };

  useEffect(() => {
    if (!overlays.highlight) {
      return;
    }
    if (!overlays.ma) {
      setOverlay('ma', true);
      return;
    }
    refreshMaLines();
  }, [overlays.highlight, overlays.ma, refreshMaLines, setOverlay]);

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    async function loadTickers() {
      setIsLoadingTickers(true);
      try {
        const params = new URLSearchParams({ quote, sort: sortMode });
        if (debouncedSearch) {
          params.set('search', debouncedSearch);
        }
        const response = await fetch(`/api/markets?${params.toString()}`, {
          signal: controller.signal
        });
        if (!response.ok) {
          throw new Error('failed to load markets');
        }
        const payload = (await response.json()) as { items: TickerInfo[] };
        if (!aborted) {
          setTickers(payload.items);
        }
      } catch (error) {
        if (!aborted) {
          console.error('[ChartControlPanel] ticker fetch failed', error);
          setTickers([]);
        }
      } finally {
        if (!aborted) {
          setIsLoadingTickers(false);
        }
      }
    }

    loadTickers();

    return () => {
      aborted = true;
      controller.abort();
    };
  }, [quote, debouncedSearch, sortMode]);

  const handleIntervalClick = (option: IntervalOption) => {
    startTransition(() => setInterval(option));
  };

  const handleMaLengthChange = (id: string, value: string) => {
    const length = Number(value);
    if (Number.isNaN(length) || length <= 0) {
      return;
    }
    updateMa(id, { length });
  };

  const handleMaLineWidthChange = (id: string, value: string) => {
    const lineWidth = Number(value);
    if (Number.isNaN(lineWidth) || lineWidth < 1) {
      return;
    }
    updateMa(id, { lineWidth });
  };

  const parseNumber = (value: string, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const renderSettings = (key: string) => {
    if (key === 'ma') {
      return (
        <div className="mt-3 space-y-4 rounded border border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500">
            <span>이동평균선 설정 (최대 5개)</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={addMa}
                disabled={ma.length >= 5}
                className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                MA 추가
              </button>
              <button
                type="button"
                onClick={resetMa}
                className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
              >
                기본값
              </button>
            </div>
          </div>
          <div className="space-y-3">
            {ma.map((item: MaConfig, index) => (
              <div key={item.id} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400">MA #{index + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeMa(item.id)}
                    className="text-xs text-zinc-500 transition hover:text-rose-400"
                    disabled={ma.length <= 1}
                  >
                    삭제
                  </button>
                </div>
                <div className="grid gap-3 text-xs text-zinc-300 md:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span>기간</span>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={item.length}
                      onChange={(event) => handleMaLengthChange(item.id, event.target.value)}
                      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>색상</span>
                    <input
                      type="color"
                      value={item.color}
                      onChange={(event) => updateMa(item.id, { color: event.target.value })}
                      className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>선 스타일</span>
                    <select
                      value={item.lineStyle}
                      onChange={(event) => updateMa(item.id, { lineStyle: event.target.value as LineStyleOption })}
                      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    >
                      {lineStyleOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span>선 두께</span>
                    <input
                      type="range"
                      min={1}
                      max={5}
                      value={item.lineWidth}
                      onChange={(event) => handleMaLineWidthChange(item.id, event.target.value)}
                      className="accent-emerald-500"
                    />
                  </label>
                </div>
                <div className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                    <span>조건 시각화</span>
                    <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <span>기준 값</span>
                      <select
                        value={item.highlight.candleField}
                        onChange={(event) =>
                          updateMaHighlight(item.id, {
                            candleField: event.target.value as CandleFieldOption
                          })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      >
                        {candleFieldOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {(['over', 'under'] as const).map((direction) => {
                      const highlight = item.highlight[direction];
                      const title = direction === 'over' ? '상향 조건' : '하향 조건';
                      return (
                        <div key={direction} className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
                          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                            <span>{title}</span>
                            <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                              <input
                                type="checkbox"
                                checked={highlight.enabled}
                                onChange={(event) =>
                                  updateMaHighlightThreshold(item.id, direction, { enabled: event.target.checked })
                                }
                                className="h-4 w-4 accent-emerald-500"
                              />
                              <span>사용</span>
                            </label>
                          </div>
                          <label className="flex flex-col gap-1 text-xs text-zinc-300">
                            <span>표시 라벨</span>
                            <input
                              type="text"
                              value={highlight.label}
                              onChange={(event) =>
                                updateMaHighlightThreshold(item.id, direction, { label: event.target.value })
                              }
                              className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                              placeholder="예: MA 돌파"
                            />
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-zinc-300">
                            <span>마커 종류</span>
                            <select
                              value={highlight.markerShape}
                              onChange={(event) =>
                                updateMaHighlightThreshold(item.id, direction, {
                                  markerShape: event.target.value as MarkerShapeOption
                                })
                              }
                              className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                            >
                              {markerShapeOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="flex flex-col gap-1 text-xs text-zinc-300">
                            <span>마커 색상</span>
                            <input
                              type="color"
                              value={highlight.color}
                              onChange={(event) =>
                                updateMaHighlightThreshold(item.id, direction, { color: event.target.value })
                              }
                              className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    <span>오버레이 투명도</span>
                    <input
                      type="range"
                      min={0}
                      max={0.5}
                      step={0.01}
                      value={item.highlight.opacity}
                      onChange={(event) =>
                        updateMaHighlight(item.id, { opacity: parseNumber(event.target.value, item.highlight.opacity) })
                      }
                      className="accent-emerald-500"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (key === 'bollinger') {
      return (
        <div className="mt-3 space-y-3 rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span>Period</span>
              <input
                type="number"
                min={2}
                max={200}
                value={bollinger.period}
                onChange={(event) => updateBollinger({ period: Number(event.target.value) || bollinger.period })}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Multiplier</span>
              <input
                type="number"
                step={0.1}
                value={bollinger.multiplier}
                onChange={(event) => updateBollinger({ multiplier: Number(event.target.value) || bollinger.multiplier })}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Offset</span>
              <input
                type="number"
                step={1}
                value={bollinger.offset}
                onChange={(event) => updateBollinger({ offset: Number(event.target.value) || 0 })}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { key: 'median' as const, label: 'Median' },
                { key: 'upper' as const, label: 'Upper' },
                { key: 'lower' as const, label: 'Lower' }
              ]
            ).map((item) => (
              <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">{item.label}</span>
                <label className="flex flex-col gap-1">
                  <span>색상</span>
                  <input
                    type="color"
                    value={bollinger[item.key].color}
                    onChange={(event) => updateBollingerStyle(item.key, { color: event.target.value })}
                    className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 스타일</span>
                  <select
                    value={bollinger[item.key].lineStyle}
                    onChange={(event) => updateBollingerStyle(item.key, { lineStyle: event.target.value as LineStyleOption })}
                    className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {lineStyleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 두께</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={bollinger[item.key].lineWidth}
                    onChange={(event) => updateBollingerStyle(item.key, { lineWidth: Number(event.target.value) })}
                    className="accent-emerald-500"
                  />
                </label>
              </div>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span>배경 투명도</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={bollinger.backgroundOpacity}
              onChange={(event) => updateBollinger({ backgroundOpacity: Number(event.target.value) })}
              className="accent-emerald-500"
            />
          </label>
          <div className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">드로잉 조건</div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  { key: 'upper' as const, title: '상단 밴드 돌파' },
                  { key: 'lower' as const, title: '하단 밴드 이탈' }
                ]
              ).map((item) => {
                const highlight = bollinger.highlight[item.key];
                return (
                    <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                        <span>{item.title}</span>
                        <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                          <input
                            type="checkbox"
                            checked={highlight.enabled}
                            onChange={(event) =>
                              updateBollingerHighlightThreshold(item.key, { enabled: event.target.checked })
                            }
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span>사용</span>
                        </label>
                      </div>
                      <label className="flex flex-col gap-1 text-xs text-zinc-300">
                        <span>기준 값</span>
                        <select
                          value={highlight.field}
                          onChange={(event) =>
                            updateBollingerHighlightThreshold(item.key, {
                              field: event.target.value as CandleFieldOption
                            })
                          }
                          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                        >
                          {candleFieldOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-xs text-zinc-300">
                        <span>표시 라벨</span>
                        <input
                          type="text"
                          value={highlight.label}
                        onChange={(event) =>
                          updateBollingerHighlightThreshold(item.key, { label: event.target.value })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="예: 밴드 돌파"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 종류</span>
                      <select
                        value={highlight.markerShape}
                        onChange={(event) =>
                          updateBollingerHighlightThreshold(item.key, {
                            markerShape: event.target.value as MarkerShapeOption
                          })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      >
                        {markerShapeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 색상</span>
                      <input
                        type="color"
                        value={highlight.color}
                        onChange={(event) =>
                          updateBollingerHighlightThreshold(item.key, { color: event.target.value })
                        }
                        className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (key === 'rsi') {
      return (
        <div className="mt-3 space-y-4 rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
            <span>RSI 설정</span>
            <button
              type="button"
              onClick={resetRsi}
              className="rounded border border-zinc-700 px-2 py-1 font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              기본값
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <label className="flex flex-col gap-1">
              <span>기간</span>
              <input
                type="number"
                min={1}
                max={500}
                value={rsi.period}
                onChange={(event) => {
                  const next = Math.max(1, Math.floor(parseNumber(event.target.value, rsi.period)));
                  updateRsi({ period: next });
                }}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            {(
              [
                { key: 'upperLimit' as const, label: '상단 한계' },
                { key: 'middleLimit' as const, label: '중간 값' },
                { key: 'lowerLimit' as const, label: '하단 한계' }
              ]
            ).map((item) => (
              <label key={item.key} className="flex flex-col gap-1">
                <span>{item.label}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={rsi[item.key]}
                  onChange={(event) => {
                    const next = Math.min(100, Math.max(0, parseNumber(event.target.value, rsi[item.key])));
                    updateRsi({ [item.key]: next });
                  }}
                  className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                />
              </label>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                { key: 'plot' as const, label: 'RSI 라인' },
                { key: 'upper' as const, label: 'Upper Line' },
                { key: 'middle' as const, label: 'Middle Line' },
                { key: 'lower' as const, label: 'Lower Line' }
              ]
            ).map((item) => (
              <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">{item.label}</span>
                <label className="flex flex-col gap-1">
                  <span>색상</span>
                  <input
                    type="color"
                    value={rsi[item.key].color}
                    onChange={(event) => updateRsiStyle(item.key, { color: event.target.value })}
                    className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 스타일</span>
                  <select
                    value={rsi[item.key].lineStyle}
                    onChange={(event) => updateRsiStyle(item.key, { lineStyle: event.target.value as LineStyleOption })}
                    className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {lineStyleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 두께</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={rsi[item.key].lineWidth}
                    onChange={(event) => updateRsiStyle(item.key, { lineWidth: Number(event.target.value) })}
                    className="accent-emerald-500"
                  />
                </label>
              </div>
            ))}
          </div>
          <label className="flex flex-col gap-2">
            <span>배경 투명도</span>
            <input
              type="range"
              min={0}
              max={0.5}
              step={0.01}
              value={rsi.backgroundOpacity}
              onChange={(event) => updateRsi({ backgroundOpacity: parseNumber(event.target.value, rsi.backgroundOpacity) })}
              className="accent-emerald-500"
            />
          </label>
          <div className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">드로잉 조건</div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              RSI 값이 상·하한선을 벗어나는 시점을 캔들 마커로 표시합니다.
            </p>
            {(
              [
                { key: 'overbought' as const, title: '과매수(상단 한계 초과)', label: `현재 한계값 ${rsi.upperLimit}` },
                { key: 'oversold' as const, title: '과매도(하단 한계 미만)', label: `현재 한계값 ${rsi.lowerLimit}` }
              ]
            ).map((item) => {
              const highlight = rsi.highlight[item.key];
              return (
                <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                    <span>{item.title}</span>
                    <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={highlight.enabled}
                        onChange={(event) =>
                          updateRsiHighlightThreshold(item.key, { enabled: event.target.checked })
                        }
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span>사용</span>
                    </label>
                  </div>
                  <span className="text-[11px] text-zinc-500">{item.label}</span>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    <span>표시 라벨</span>
                    <input
                      type="text"
                      value={highlight.label}
                      onChange={(event) =>
                        updateRsiHighlightThreshold(item.key, { label: event.target.value })
                      }
                      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      placeholder="예: RSI 과매수"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    <span>마커 종류</span>
                    <select
                      value={highlight.markerShape}
                      onChange={(event) =>
                        updateRsiHighlightThreshold(item.key, {
                          markerShape: event.target.value as MarkerShapeOption
                        })
                      }
                      className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    >
                      {markerShapeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-zinc-300">
                    <span>마커 색상</span>
                    <input
                      type="color"
                      value={highlight.color}
                      onChange={(event) =>
                        updateRsiHighlightThreshold(item.key, { color: event.target.value })
                      }
                      className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                    />
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (key === 'macd') {
      const histogramLabels: [string, string, string, string] = [
        '하락 컬럼 1',
        '하락 컬럼 2',
        '상승 컬럼 1',
        '상승 컬럼 2'
      ];

      return (
        <div className="mt-3 space-y-4 rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
            <span>MACD 설정</span>
            <button
              type="button"
              onClick={resetMacd}
              className="rounded border border-zinc-700 px-2 py-1 font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              기본값
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span>Fast Length</span>
              <input
                type="number"
                min={1}
                max={200}
                value={macd.fastLength}
                onChange={(event) => {
                  const next = Math.max(1, Math.floor(parseNumber(event.target.value, macd.fastLength)));
                  updateMacd({ fastLength: next });
                }}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Slow Length</span>
              <input
                type="number"
                min={1}
                max={200}
                value={macd.slowLength}
                onChange={(event) => {
                  const next = Math.max(1, Math.floor(parseNumber(event.target.value, macd.slowLength)));
                  updateMacd({ slowLength: next });
                }}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Signal Length</span>
              <input
                type="number"
                min={1}
                max={200}
                value={macd.signalLength}
                onChange={(event) => {
                  const next = Math.max(1, Math.floor(parseNumber(event.target.value, macd.signalLength)));
                  updateMacd({ signalLength: next });
                }}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span>Source</span>
              <input
                type="text"
                value={macd.source.toUpperCase()}
                disabled
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Oscillator MA</span>
              <input
                type="text"
                value={macd.oscillatorType.toUpperCase()}
                disabled
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>Signal Line MA</span>
              <input
                type="text"
                value={macd.signalType.toUpperCase()}
                disabled
                className="rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-zinc-500"
              />
            </label>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {(
              [
                { key: 'macdLine' as const, label: 'MACD 라인', visibilityKey: 'macdLine' as const },
                { key: 'signalLine' as const, label: 'Signal 라인', visibilityKey: 'signalLine' as const }
              ]
            ).map((item) => {
              const isVisible = macd.visibility[item.visibilityKey];
              return (
                <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-wide text-zinc-500">{item.label}</span>
                    <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                      <input
                        type="checkbox"
                        checked={isVisible}
                        onChange={(event) =>
                          updateMacdVisibility({ [item.visibilityKey]: event.target.checked })
                        }
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span>표시</span>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1">
                    <span>색상</span>
                    <input
                      type="color"
                      value={macd[item.key].color}
                      onChange={(event) => updateMacdLine(item.key, { color: event.target.value })}
                    className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 스타일</span>
                  <select
                    value={macd[item.key].lineStyle}
                    onChange={(event) => updateMacdLine(item.key, { lineStyle: event.target.value as LineStyleOption })}
                    className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {lineStyleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 두께</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={macd[item.key].lineWidth}
                    onChange={(event) => updateMacdLine(item.key, { lineWidth: Number(event.target.value) })}
                    className="accent-emerald-500"
                  />
                </label>
                </div>
              );
            })}
          </div>
          <div className="space-y-3 rounded border border-zinc-800 bg-zinc-950 p-3">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">히스토그램 컬럼 색상</span>
            <div className="grid gap-3 md:grid-cols-4">
              {macd.histogram.colors.map((color, index) => (
                <label key={index} className="flex flex-col gap-1">
                  <span>{histogramLabels[index]}</span>
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => updateMacdHistogramColor(index as 0 | 1 | 2 | 3, event.target.value)}
                    className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-4 rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">드로잉 조건</div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  {
                    key: 'turnUp' as const,
                    title: '히스토그램 상승 전환',
                    positionLabel: '하락 컬럼이 끝나고 상승 컬럼이 시작될 때'
                  },
                  {
                    key: 'turnDown' as const,
                    title: '히스토그램 하락 전환',
                    positionLabel: '상승 컬럼이 끝나고 하락 컬럼이 시작될 때'
                  }
                ]
              ).map((item) => {
                const highlight = macd.highlight.histogram[item.key];
                return (
                  <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                      <span>{item.title}</span>
                      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={highlight.enabled}
                          onChange={(event) =>
                            updateMacdHighlightThreshold('histogram', item.key, { enabled: event.target.checked })
                          }
                          className="h-4 w-4 accent-emerald-500"
                        />
                        <span>사용</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-zinc-500">{item.positionLabel}</p>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>표시 라벨</span>
                      <input
                        type="text"
                        value={highlight.label}
                        onChange={(event) =>
                          updateMacdHighlightThreshold('histogram', item.key, { label: event.target.value })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="예: 히스토그램 상승"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 종류</span>
                      <select
                        value={highlight.markerShape}
                        onChange={(event) =>
                          updateMacdHighlightThreshold('histogram', item.key, {
                            markerShape: event.target.value as MarkerShapeOption
                          })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      >
                        {markerShapeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 색상</span>
                      <input
                        type="color"
                        value={highlight.color}
                        onChange={(event) =>
                          updateMacdHighlightThreshold('histogram', item.key, { color: event.target.value })
                        }
                        className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {(
                [
                  { key: 'bullish' as const, title: 'MACD 상승 크로스', description: 'MACD가 Signal을 상향 돌파' },
                  { key: 'bearish' as const, title: 'MACD 하락 크로스', description: 'MACD가 Signal을 하향 돌파' }
                ]
              ).map((item) => {
                const highlight = macd.highlight.crossover[item.key];
                return (
                  <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                      <span>{item.title}</span>
                      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={highlight.enabled}
                          onChange={(event) =>
                            updateMacdHighlightThreshold('crossover', item.key, { enabled: event.target.checked })
                          }
                          className="h-4 w-4 accent-emerald-500"
                        />
                        <span>사용</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-zinc-500">{item.description}</p>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>표시 라벨</span>
                      <input
                        type="text"
                        value={highlight.label}
                        onChange={(event) =>
                          updateMacdHighlightThreshold('crossover', item.key, { label: event.target.value })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                        placeholder="예: MACD 크로스"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 종류</span>
                      <select
                        value={highlight.markerShape}
                        onChange={(event) =>
                          updateMacdHighlightThreshold('crossover', item.key, {
                            markerShape: event.target.value as MarkerShapeOption
                          })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      >
                        {markerShapeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 색상</span>
                      <input
                        type="color"
                        value={highlight.color}
                        onChange={(event) =>
                          updateMacdHighlightThreshold('crossover', item.key, { color: event.target.value })
                        }
                        className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (key === 'dmi') {
      return (
        <div className="mt-3 space-y-4 rounded border border-zinc-800 bg-zinc-900 p-3 text-xs text-zinc-300">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
            <span>DMI 설정</span>
            <button
              type="button"
              onClick={resetDmi}
              className="rounded border border-zinc-700 px-2 py-1 font-semibold text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              기본값
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span>DI Length</span>
              <input
                type="number"
                min={1}
                max={200}
                value={dmi.diLength}
                onChange={(event) => {
                  const next = Math.max(1, Math.floor(parseNumber(event.target.value, dmi.diLength)));
                  updateDmi({ diLength: next });
                }}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span>ADX Smoothing</span>
              <input
                type="number"
                min={1}
                max={200}
                value={dmi.adxSmoothing}
                onChange={(event) => {
                  const next = Math.max(1, Math.floor(parseNumber(event.target.value, dmi.adxSmoothing)));
                  updateDmi({ adxSmoothing: next });
                }}
                className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
              />
            </label>
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-900 p-3">
            <span className="text-[11px] uppercase tracking-wide text-zinc-500">라인 표시</span>
            <div className="mt-2 grid gap-2 text-xs text-zinc-300 md:grid-cols-3">
              {(
                [
                  { key: 'plusDI' as const, label: '+DI' },
                  { key: 'minusDI' as const, label: '-DI' },
                  { key: 'dx' as const, label: 'DX' },
                  { key: 'adx' as const, label: 'ADX' },
                  { key: 'adxr' as const, label: 'ADXR' }
                ]
              ).map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-2 rounded border border-zinc-800 bg-zinc-950 px-2 py-1">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={dmi.visibility[item.key]}
                    onChange={(event) => updateDmiVisibility({ [item.key]: event.target.checked })}
                    className="h-4 w-4 accent-emerald-500"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {(
              [
                { key: 'plusDI' as const, label: '+DI' },
                { key: 'minusDI' as const, label: '-DI' },
                { key: 'dx' as const, label: 'DX' },
                { key: 'adx' as const, label: 'ADX' },
                { key: 'adxr' as const, label: 'ADXR' }
              ]
            ).map((item) => (
              <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                <span className="text-[11px] uppercase tracking-wide text-zinc-500">{item.label}</span>
                <label className="flex flex-col gap-1">
                  <span>색상</span>
                  <input
                    type="color"
                    value={dmi[item.key].color}
                    onChange={(event) => updateDmiStyle(item.key, { color: event.target.value })}
                    className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 스타일</span>
                  <select
                    value={dmi[item.key].lineStyle}
                    onChange={(event) => updateDmiStyle(item.key, { lineStyle: event.target.value as LineStyleOption })}
                    className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {lineStyleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span>선 두께</span>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={dmi[item.key].lineWidth}
                    onChange={(event) => updateDmiStyle(item.key, { lineWidth: Number(event.target.value) })}
                    className="accent-emerald-500"
                  />
                </label>
              </div>
            ))}
          </div>
          <div className="space-y-4 rounded border border-zinc-800 bg-zinc-950 p-3">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">드로잉 조건</div>
            <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
              <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                <span>DI 우위</span>
                <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                  <span>비교 기준</span>
                  <select
                    value={dmi.highlight.dominance.candleField}
                    onChange={(event) =>
                      updateDmiDominanceHighlight({ candleField: event.target.value as CandleFieldOption })
                    }
                    className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                  >
                    {candleFieldOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {(
                [
                  { key: 'plusOverMinus' as const, title: '+DI > -DI' },
                  { key: 'minusOverPlus' as const, title: '-DI > +DI' }
                ]
              ).map((item) => {
                const highlight = dmi.highlight.dominance[item.key];
                return (
                  <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                      <span>{item.title}</span>
                      <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                        <input
                          type="checkbox"
                          checked={highlight.enabled}
                          onChange={(event) =>
                            updateDmiDominanceThreshold(item.key, { enabled: event.target.checked })
                          }
                          className="h-4 w-4 accent-emerald-500"
                        />
                        <span>사용</span>
                      </label>
                    </div>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>표시 라벨</span>
                      <input
                        type="text"
                        value={highlight.label}
                        onChange={(event) =>
                          updateDmiDominanceThreshold(item.key, { label: event.target.value })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 종류</span>
                      <select
                        value={highlight.markerShape}
                        onChange={(event) =>
                          updateDmiDominanceThreshold(item.key, {
                            markerShape: event.target.value as MarkerShapeOption
                          })
                        }
                        className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                      >
                        {markerShapeOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-zinc-300">
                      <span>마커 색상</span>
                      <input
                        type="color"
                        value={highlight.color}
                        onChange={(event) =>
                          updateDmiDominanceThreshold(item.key, { color: event.target.value })
                        }
                        className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                      />
                    </label>
                  </div>
                );
              })}
            </div>
            {(
              [
                { key: 'adx' as const, title: 'ADX 임계값' },
                { key: 'adxr' as const, title: 'ADXR 임계값' }
              ]
            ).map((item) => {
              const highlight = dmi.highlight[item.key];
              return (
                <div key={item.key} className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-zinc-500">{item.title}</div>
                  {(['over', 'under'] as const).map((target) => {
                    const setting = highlight[target];
                    const description = target === 'over' ? '상향 돌파' : '하향 이탈';
                    return (
                      <div key={target} className="space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
                        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-zinc-500">
                          <span>{description}</span>
                          <label className="flex items-center gap-2 text-[11px] text-zinc-400">
                            <input
                              type="checkbox"
                              checked={setting.enabled}
                              onChange={(event) =>
                                updateDmiValueHighlight(item.key, target, { enabled: event.target.checked })
                              }
                              className="h-4 w-4 accent-emerald-500"
                            />
                            <span>사용</span>
                          </label>
                        </div>
                        <label className="flex flex-col gap-1 text-xs text-zinc-300">
                          <span>임계값</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={setting.threshold}
                            onChange={(event) =>
                              updateDmiValueHighlight(item.key, target, {
                                threshold: Math.max(0, Math.min(100, parseNumber(event.target.value, setting.threshold)))
                              })
                            }
                            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-zinc-300">
                          <span>표시 라벨</span>
                          <input
                            type="text"
                            value={setting.label}
                            onChange={(event) =>
                              updateDmiValueHighlight(item.key, target, { label: event.target.value })
                            }
                            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                          />
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-zinc-300">
                          <span>마커 종류</span>
                          <select
                            value={setting.markerShape}
                            onChange={(event) =>
                              updateDmiValueHighlight(item.key, target, {
                                markerShape: event.target.value as MarkerShapeOption
                              })
                            }
                            className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
                          >
                            {markerShapeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-1 text-xs text-zinc-300">
                          <span>마커 색상</span>
                          <input
                            type="color"
                            value={setting.color}
                            onChange={(event) =>
                              updateDmiValueHighlight(item.key, target, { color: event.target.value })
                            }
                            className="h-9 w-full rounded border border-zinc-800 bg-zinc-900"
                          />
                        </label>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-500">
        상세 설정은 준비 중입니다. 우선순위를 조정하여 추후 제공할 예정입니다.
      </div>
    );
  };

  return (
    <aside className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm">
      <div className="flex flex-col gap-2">
        <span className="text-xs uppercase tracking-wide text-zinc-500">지표 설정</span>
        <div className="grid gap-2">
          {overlayLabels.map((overlay) => (
            <Fragment key={overlay.key}>
              {overlay.key === 'highlight' ? (
                <div
                  className={`flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs transition ${
                    highlightActive
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-medium">{overlay.label}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleHighlightEnable}
                      className={`rounded border px-2 py-1 text-[11px] font-semibold transition ${
                        highlightActive
                          ? 'border-emerald-500 text-emerald-100'
                          : 'border-zinc-700 text-zinc-300 hover:border-emerald-500 hover:text-emerald-300'
                      }`}
                    >
                      설정
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setOverlay('highlight', false);
                        ensureMaVisible();
                      }}
                      className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-zinc-600 hover:text-zinc-100"
                    >
                      해제
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetHighlights();
                        setOverlay('highlight', false);
                        ensureMaVisible();
                      }}
                      className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-rose-500 hover:text-rose-300"
                    >
                      초기화
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex cursor-pointer items-start gap-3 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 hover:border-zinc-700">
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-zinc-200">{overlay.label}</span>
                      <div className="flex items-center gap-2">
                        {overlay.key === 'ma' && (
                          <span className="text-[11px] text-zinc-500">
                            활성 {activeMaCount}개
                          </span>
                        )}
                        {overlay.configurable && (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              setExpandedIndicator((current) =>
                                current === overlay.key ? null : overlay.key
                              );
                            }}
                            className="rounded border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-300"
                          >
                            설정
                          </button>
                        )}
                        <input
                          type="checkbox"
                          checked={overlays[overlay.key]}
                          onChange={() => toggleOverlay(overlay.key)}
                          className="h-4 w-4"
                        />
                      </div>
                    </div>
                  </div>
                </label>
              )}
              {overlay.configurable && expandedIndicator === overlay.key && renderSettings(overlay.key)}
            </Fragment>
          ))}
        </div>
      </div>
    </aside>
  );
}
