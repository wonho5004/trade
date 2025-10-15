'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { calculateBollingerBands, calculateDMI, calculateMACD, calculateRSI, calculateSMA } from '@/lib/analysis/indicators';
import { fetchFuturesCandles, subscribeKline } from '@/lib/trading/realtime';
import type { Candle } from '@/types/chart';
import { useChartStore } from '@/stores/chartStore';
import { useIndicatorConfigStore } from '@/stores/indicatorConfigStore';
import { useMarketDataStore } from '@/stores/marketDataStore';
import type {
  HighlightThresholdSetting,
  LineStyleOption,
  MarkerShapeOption,
  ValueHighlightSetting
} from '@/types/indicator';
import { useShallow } from 'zustand/react/shallow';

import type {
  CandlestickData,
  CrosshairMoveEventParams,
  HistogramData,
  IChartApi,
  ISeriesApi,
  LineData,
  PriceScaleMargins,
  SeriesMarker,
  Time,
  UTCTimestamp
} from 'lightweight-charts';

type LightweightChartsModule = typeof import('lightweight-charts');

let lightweightChartsPromise: Promise<LightweightChartsModule> | null = null;

async function loadLightweightCharts(): Promise<LightweightChartsModule> {
  if (!lightweightChartsPromise) {
    lightweightChartsPromise = import(
      /* webpackChunkName: "lightweight-charts" */ 'lightweight-charts'
    ) as Promise<LightweightChartsModule>;
  }
  return lightweightChartsPromise;
}

type IndicatorScale = 'rsi' | 'macd' | 'dmi';

type IndicatorVisibility = Record<IndicatorScale, boolean>;

type ScaleLayout = {
  top: number;
  bottom: number;
  visible: boolean;
};

type ScaleLayoutMap = Record<'right' | IndicatorScale, ScaleLayout>;

type HoveredCandleInfo = {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
};

const DEFAULT_BASE_HEIGHT = 520;

const seoulTimeFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

const seoulMonthDayFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  month: '2-digit',
  day: '2-digit'
});

const INDICATOR_ORDER: IndicatorScale[] = ['rsi', 'macd', 'dmi'];

const lineStyleValue: Record<LineStyleOption, number> = {
  solid: 0,
  dotted: 1,
  dashed: 2
};

const markerShapeValue: Record<MarkerShapeOption, SeriesMarker['shape']> = {
  arrowUp: 'arrowUp',
  arrowDown: 'arrowDown',
  circle: 'circle',
  square: 'square'
};

const INITIAL_CANDLE_LIMIT = 1000;
const HISTORY_FETCH_LIMIT = 750;
const HISTORY_TRIGGER_THRESHOLD = 50;

const MIN_PRICE_DECIMALS = 2;
const MAX_PRICE_DECIMALS = 8;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function determinePrecision(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    return MIN_PRICE_DECIMALS;
  }
  const abs = Math.abs(value);
  const decimals = Math.ceil(Math.log10(1 / abs)) + 4;
  return Math.max(MIN_PRICE_DECIMALS, Math.min(MAX_PRICE_DECIMALS, decimals));
}

function normalizePrice(value: number): number {
  const decimals = determinePrecision(value);
  return Number(value.toFixed(decimals));
}

function formatPrice(value: number): string {
  const decimals = determinePrecision(value);
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function toTimestamp(value: number): UTCTimestamp {
  return Math.floor(value / 1000) as UTCTimestamp;
}

function toCandlestickData(candle: Candle): CandlestickData {
  return {
    time: toTimestamp(candle.timestamp),
    open: normalizePrice(candle.open),
    high: normalizePrice(candle.high),
    low: normalizePrice(candle.low),
    close: normalizePrice(candle.close)
  };
}

function buildLineSeries(values: Array<number | null>, candles: Candle[]): LineData<UTCTimestamp>[] {
  const result: LineData<UTCTimestamp>[] = [];
  values.forEach((value, index) => {
    if (value == null) {
      return;
    }
    result.push({
      time: toTimestamp(candles[index].timestamp),
      value: normalizePrice(value)
    });
  });
  return result;
}

function buildHistogramSeries(
  values: Array<number | null>,
  candles: Candle[],
  colorFactory?: (value: number, index: number, previous: number | null) => string | undefined
): HistogramData<UTCTimestamp>[] {
  const result: HistogramData<UTCTimestamp>[] = [];
  let lastNonNull: number | null = null;
  values.forEach((value, index) => {
    if (value == null) {
      lastNonNull = null;
      return;
    }
    const data: HistogramData<UTCTimestamp> = {
      time: toTimestamp(candles[index].timestamp),
      value: normalizePrice(value)
    };
    if (colorFactory) {
      const color = colorFactory(value, index, lastNonNull);
      if (color) {
        data.color = color;
      }
    }
    result.push(data);
    lastNonNull = value;
  });
  return result;
}

function mergeCandles(base: Candle[], updates: Candle[]): Candle[] {
  if (!base.length) {
    return updates.slice().sort((a, b) => a.timestamp - b.timestamp);
  }
  if (!updates.length) {
    return base;
  }
  const merged = new Map<number, Candle>();
  base.forEach((candle) => merged.set(candle.timestamp, candle));
  updates.forEach((candle) => merged.set(candle.timestamp, candle));
  return Array.from(merged.values()).sort((a, b) => a.timestamp - b.timestamp);
}

function getCandleFieldValue(candle: Candle, field: 'open' | 'high' | 'low' | 'close'): number {
  return candle[field];
}

function formatSeoulDateLabel(timestamp: UTCTimestamp): string {
  return seoulMonthDayFormatter.format(new Date(timestamp * 1000));
}

function formatSeoulDisplay(date: Date): string {
  const timePart = seoulTimeFormatter.format(date);
  if (timePart === '00:00') {
    const dayPart = seoulMonthDayFormatter.format(date);
    return `${dayPart} ${timePart}`;
  }
  return timePart;
}

function formatSeoulTime(timestamp: UTCTimestamp): string {
  return formatSeoulDisplay(new Date(timestamp * 1000));
}

function formatSeoulTick(time: Time): string {
  if (typeof time === 'number') {
    return formatSeoulDisplay(new Date(time * 1000));
  }

  if (typeof time === 'string') {
    return time;
  }

  if ('day' in time && 'month' in time && 'year' in time) {
    const utc = Date.UTC(time.year, time.month - 1, time.day);
    const kstDate = new Date(utc - KST_OFFSET_MS);
    return formatSeoulDisplay(kstDate);
  }

  return '';
}

function computeScaleLayout(
  visibility: IndicatorVisibility,
  baseHeight: number,
  totalHeight: number
): ScaleLayoutMap {
  const activeIndicators = INDICATOR_ORDER.filter((scale) => visibility[scale]);
  const indicatorCount = activeIndicators.length;

  const indicatorRatio = indicatorCount > 0 ? 100 / totalHeight : 0;
  const mainHeightRatio = Math.max(0.2, baseHeight / totalHeight);

  const layout: ScaleLayoutMap = {
    right: {
      top: 0,
      bottom: indicatorCount * indicatorRatio,
      visible: true
    },
    rsi: { top: 0, bottom: 1, visible: false },
    macd: { top: 0, bottom: 1, visible: false },
    dmi: { top: 0, bottom: 1, visible: false }
  };

  let cursor = mainHeightRatio;

  activeIndicators.forEach((scale, index) => {
    const remaining = indicatorCount - index - 1;
    layout[scale] = {
      top: Math.min(cursor, 0.95),
      bottom: Math.min(Math.max(remaining * indicatorRatio, 0), 0.95),
      visible: true
    };
    cursor += indicatorRatio;
  });

  return layout;
}

export function CandlestickChart() {
  const symbol = useChartStore((state) => state.symbol);
  const interval = useChartStore((state) => state.interval);
  const overlays = useChartStore((state) => state.overlays);

  const { status: tickerStatus, lastPrice, priceChangePercent } = useMarketDataStore(
    useShallow((state) => ({
      status: state.status,
      lastPrice: state.lastPrice,
      priceChangePercent: state.priceChangePercent
    }))
  );
  const attachTicker = useMarketDataStore((state) => state.attach);

  const [baseHeight, setBaseHeight] = useState(DEFAULT_BASE_HEIGHT);
  const [chartReady, setChartReady] = useState(false);
  const chartHeightRef = useRef(baseHeight);
  const [candles, setCandles] = useState<Candle[]>([]);
  const candlesRef = useRef<Candle[]>([]);
  const historyLoadingRef = useRef(false);
  const hasMoreHistoryRef = useRef(true);
  const loadHistoryRef = useRef<(() => void) | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<HoveredCandleInfo | null>(null);
  const hoveredCandleRef = useRef<HoveredCandleInfo | null>(null);
  const requireAutoscaleRef = useRef(false);

  const mainContainerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const maSeriesRefs = useRef<Record<string, ISeriesApi<'Line'>>>({});
  const bollMedianSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollUpperSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bollLowerSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const rsiSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdLineSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdSignalSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const macdHistogramSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const dmiPlusSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dmiMinusSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dmiDxSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dmiAdxSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const dmiAdxrSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const followRealtimeRef = useRef(true);
  const timeScaleUnsubscribeRef = useRef<(() => void) | null>(null);
  const lastSeriesLengthRef = useRef(0);
  const lastSeriesTimestampRef = useRef<number | null>(null);

  const indicatorVisibility = useMemo<IndicatorVisibility>(
    () => ({
      rsi: overlays.rsi,
      macd: overlays.macd,
      dmi: overlays.dmi
    }),
    [overlays]
  );

  const indicatorCount = useMemo(
    () => Object.values(indicatorVisibility).filter(Boolean).length,
    [indicatorVisibility]
  );

  const totalHeight = useMemo(() => baseHeight + indicatorCount * 100, [baseHeight, indicatorCount]);

  const maConfigs = useIndicatorConfigStore((state) => state.ma);
  const bollingerConfig = useIndicatorConfigStore((state) => state.bollinger);
  const rsiConfig = useIndicatorConfigStore((state) => state.rsi);
  const macdConfig = useIndicatorConfigStore((state) => state.macd);
  const dmiConfig = useIndicatorConfigStore((state) => state.dmi);

  const formattedPrice = useMemo(() => {
    if (tickerStatus !== 'connected' || lastPrice == null) {
      return '-';
    }
    return formatPrice(lastPrice);
  }, [tickerStatus, lastPrice]);

  const formattedChange = useMemo(() => {
    if (tickerStatus !== 'connected' || priceChangePercent == null) {
      return '-';
    }
    const sign = priceChangePercent > 0 ? '+' : '';
    return `${sign}${priceChangePercent.toFixed(2)}%`;
  }, [tickerStatus, priceChangePercent]);

  const changeColor = useMemo(() => {
    if (tickerStatus !== 'connected' || priceChangePercent == null) {
      return 'text-zinc-500';
    }
    return priceChangePercent >= 0 ? 'text-emerald-400' : 'text-rose-400';
  }, [tickerStatus, priceChangePercent]);

  useEffect(() => {
    candlesRef.current = candles;
  }, [candles]);

  const hoveredSnapshot = useMemo(() => {
    if (!hoveredCandle) {
      return null;
    }

    return {
      date: formatSeoulDateLabel(hoveredCandle.time),
      time: formatSeoulTime(hoveredCandle.time),
      open: formatPrice(hoveredCandle.open),
      high: formatPrice(hoveredCandle.high),
      low: formatPrice(hoveredCandle.low),
      close: formatPrice(hoveredCandle.close)
    };
  }, [hoveredCandle]);

  const statusLabel = useMemo(() => {
    switch (tickerStatus) {
      case 'connected':
        return 'LIVE';
      case 'connecting':
        return '연결 중';
      case 'error':
        return '에러';
      default:
        return '대기';
    }
  }, [tickerStatus]);

  const statusBadgeClass = useMemo(() => {
    switch (tickerStatus) {
      case 'connected':
        return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
      case 'connecting':
        return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
      case 'error':
        return 'border-rose-500/40 bg-rose-500/10 text-rose-300';
      default:
        return 'border-zinc-600 bg-zinc-800 text-zinc-300';
    }
  }, [tickerStatus]);

  const applyScaleLayout = useCallback(
    (visibility: IndicatorVisibility) => {
      if (!chartRef.current) {
        return;
      }

      const layout = computeScaleLayout(visibility, baseHeight, totalHeight);
      Object.entries(layout).forEach(([scaleId, value]) => {
        const clamp = (input: number) => Math.min(Math.max(input, 0), 0.95);
        chartRef.current?.priceScale(scaleId as 'right' | IndicatorScale).applyOptions({
          visible: value.visible,
          borderVisible: false,
          drawTicks: false,
          scaleMargins: {
            top: clamp(value.top),
            bottom: clamp(value.bottom)
          } satisfies PriceScaleMargins
        });
      });
    },
    [baseHeight, totalHeight]
  );

  const resizeChart = useCallback(
    (nextWidth?: number, nextHeight?: number) => {
      if (!chartRef.current || !mainContainerRef.current) {
        return;
      }
      const width = nextWidth ?? Math.floor(mainContainerRef.current.clientWidth);
      const height = nextHeight ?? chartHeightRef.current;
      chartRef.current.resize(width, height);
      chartHeightRef.current = height;
    },
    []
  );

  const loadMoreHistory = useCallback(async () => {
    if (historyLoadingRef.current || !hasMoreHistoryRef.current) {
      return;
    }
    const currentCandles = candlesRef.current;
    if (!currentCandles.length || !symbol) {
      return;
    }
    const oldestTimestamp = currentCandles[0]?.timestamp;
    if (oldestTimestamp == null) {
      return;
    }

    historyLoadingRef.current = true;
    const timeScale = chartRef.current?.timeScale();
    const visibleRange = timeScale?.getVisibleLogicalRange();

    try {
      const olderBatch = await fetchFuturesCandles(symbol, interval, HISTORY_FETCH_LIMIT, {
        endTime: oldestTimestamp - 1
      });

      if (!olderBatch.length) {
        hasMoreHistoryRef.current = false;
        return;
      }

      const currentOldest = oldestTimestamp;
      const newUniqueCount = olderBatch.filter((item) => item.timestamp < currentOldest).length;

      setCandles((prev) => mergeCandles(olderBatch, prev));

      if (timeScale && visibleRange != null && newUniqueCount > 0) {
        const from = Number(visibleRange.from);
        const to = Number(visibleRange.to);
        if (Number.isFinite(from) && Number.isFinite(to)) {
          requestAnimationFrame(() => {
            timeScale.setVisibleLogicalRange({
              from: from + newUniqueCount,
              to: to + newUniqueCount
            });
          });
        }
      }
    } catch {
      /* 과거 데이터 로딩 실패 시 무시 */
    } finally {
      historyLoadingRef.current = false;
    }
  }, [interval, setCandles, symbol]);

  useEffect(() => {
    loadHistoryRef.current = loadMoreHistory;
  }, [loadMoreHistory]);

  useEffect(() => {
    chartHeightRef.current = totalHeight;
    resizeChart(undefined, totalHeight);
  }, [totalHeight, resizeChart, candles]);

  useEffect(() => {
    if (!symbol) {
      return;
    }
    const detach = attachTicker(symbol);
    return detach;
  }, [symbol, attachTicker]);

  useEffect(() => {
    let isActive = true;
    let unsubscribe: (() => void) | undefined;
    let fallbackTimer: number | undefined;

    const clearFallback = () => {
      if (typeof window !== 'undefined' && fallbackTimer != null) {
        window.clearInterval(fallbackTimer);
        fallbackTimer = undefined;
      }
    };

    const startFallback = () => {
      if (typeof window === 'undefined' || fallbackTimer != null) {
        return;
      }

      const poll = async () => {
        fetchFuturesCandles(symbol, interval, INITIAL_CANDLE_LIMIT)
          .then((snapshot) => {
            if (isActive) {
              setCandles((prev) => mergeCandles(prev, snapshot));
            }
          })
          .catch(() => {
            /* swallow polling errors */
          });
      };

      poll();
      fallbackTimer = window.setInterval(poll, 10_000);
    };

    setCandles([]);
    candlesRef.current = [];
    hasMoreHistoryRef.current = true;
    historyLoadingRef.current = false;
    lastSeriesLengthRef.current = 0;
    lastSeriesTimestampRef.current = null;
    followRealtimeRef.current = true;
    hoveredCandleRef.current = null;
    setHoveredCandle(null);
    requireAutoscaleRef.current = true;

    async function bootstrap() {
      try {
        const snapshot = await fetchFuturesCandles(symbol, interval, INITIAL_CANDLE_LIMIT);
        if (!isActive) {
          return;
        }
        setCandles(snapshot);

        unsubscribe = subscribeKline(
          symbol,
          interval,
          ({ candle }) => {
            clearFallback();
            setCandles((prev) => {
              if (!prev.length) {
                return [candle];
              }

              const last = prev[prev.length - 1];
              if (candle.timestamp === last.timestamp) {
                const next = [...prev];
                next[next.length - 1] = candle;
                return next;
              }

              if (candle.timestamp > last.timestamp) {
                return [...prev, candle];
              }

              return prev;
            });
          },
          () => {
            startFallback();
          }
        );
      } catch (error) {
        if (!isActive) {
          return;
        }
        startFallback();
      }
    }

    bootstrap();

    return () => {
      isActive = false;
      unsubscribe?.();
      clearFallback();
    };
  }, [symbol, interval]);

  useEffect(() => {
    let isMounted = true;
    let chartLib: typeof import('lightweight-charts') | null = null;

    async function setupChart() {
      chartLib = await loadLightweightCharts();
      if (!isMounted || !mainContainerRef.current) {
        return;
      }

      const { createChart, CrosshairMode, LineStyle } = chartLib;

      chartRef.current = createChart(mainContainerRef.current, {
        width: mainContainerRef.current.clientWidth,
        height: chartHeightRef.current,
        layout: {
          background: { color: '#09090b' },
          textColor: '#d4d4d8',
          fontSize: 12
        },
        crosshair: {
          mode: CrosshairMode.Normal
        },
        grid: {
          vertLines: { color: '#27272a' },
          horzLines: { color: '#27272a' }
        },
        localization: {
          locale: 'ko-KR',
          timeFormatter: formatSeoulTime
        },
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          shiftVisibleRangeOnNewBar: false,
          tickMarkFormatter: (time: Time) => formatSeoulTick(time)
        }
      });

      chartRef.current.priceScale('right').applyOptions({
        autoScale: true,
        alignLabels: true
      });

      candleSeriesRef.current = chartRef.current.addCandlestickSeries({
        priceScaleId: 'right',
        upColor: '#4ade80',
        downColor: '#f87171',
        borderVisible: false,
        wickUpColor: '#22c55e',
        wickDownColor: '#ef4444',
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        }
      });

      bollMedianSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'right',
        color: '#f97316',
        lineWidth: 2,
        lineStyle: LineStyle.Solid,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        }
      });

      bollUpperSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'right',
        color: '#f97316',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        }
      });

      bollLowerSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'right',
        color: '#f97316',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        }
      });

      rsiSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'rsi',
        color: '#60a5fa',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => value.toFixed(2)
        },
        lastValueVisible: false
      });

      macdHistogramSeriesRef.current = chartRef.current.addHistogramSeries({
        priceScaleId: 'macd',
        base: 0,
        color: '#f97316',
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      macdLineSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'macd',
        color: '#facc15',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      macdSignalSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'macd',
        color: '#22d3ee',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      dmiPlusSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'dmi',
        color: '#34d399',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      dmiMinusSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'dmi',
        color: '#f87171',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      dmiDxSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'dmi',
        color: '#facc15',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      dmiAdxSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'dmi',
        color: '#a855f7',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      dmiAdxrSeriesRef.current = chartRef.current.addLineSeries({
        priceScaleId: 'dmi',
        color: '#38bdf8',
        lineWidth: 2,
        priceLineVisible: false,
        priceFormat: {
          type: 'custom',
          formatter: (value: number) => formatPrice(value)
        },
        lastValueVisible: false
      });

      applyScaleLayout(indicatorVisibility);
      setChartReady(true);

      const timeScale = chartRef.current.timeScale();
      const handleLogicalRangeChange = () => {
        const position = timeScale.scrollPosition();
        if (typeof position === 'number') {
          followRealtimeRef.current = Math.abs(position) <= 0.1;
        }
        const logicalRange = timeScale.getVisibleLogicalRange();
        if (logicalRange != null) {
          const from = logicalRange.from;
          if (Number.isFinite(from) && from <= HISTORY_TRIGGER_THRESHOLD) {
            loadHistoryRef.current?.();
          }
        }
      };

      handleLogicalRangeChange();
      timeScale.subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
      timeScaleUnsubscribeRef.current = () =>
        timeScale.unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);

      resizeObserverRef.current = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !chartRef.current || !chartLib) {
          return;
        }
        const { width } = entry.contentRect;
        resizeChart(Math.floor(width), chartHeightRef.current);
        requestAnimationFrame(() => {
          chartRef.current?.timeScale().applyOptions({});
        });
      });
      resizeObserverRef.current.observe(mainContainerRef.current);
    }

    setupChart();

    return () => {
      isMounted = false;
      setChartReady(false);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      timeScaleUnsubscribeRef.current?.();
      timeScaleUnsubscribeRef.current = null;
      const chartInstance = chartRef.current;
      if (chartInstance) {
        Object.values(maSeriesRefs.current).forEach((series) => {
          chartInstance.removeSeries(series);
        });
      }
      maSeriesRefs.current = {};
      chartInstance?.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      bollMedianSeriesRef.current = null;
      bollUpperSeriesRef.current = null;
      bollLowerSeriesRef.current = null;
      rsiSeriesRef.current = null;
      macdHistogramSeriesRef.current = null;
      macdLineSeriesRef.current = null;
      macdSignalSeriesRef.current = null;
      dmiPlusSeriesRef.current = null;
      dmiMinusSeriesRef.current = null;
      dmiAdxSeriesRef.current = null;
      chartLib = null;
      followRealtimeRef.current = true;
      lastSeriesLengthRef.current = 0;
      lastSeriesTimestampRef.current = null;
    };
  }, [applyScaleLayout, indicatorVisibility, resizeChart]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    applyScaleLayout(indicatorVisibility);
  }, [applyScaleLayout, indicatorVisibility]);

  useEffect(() => {
    if (!chartReady || !chartRef.current || !candleSeriesRef.current) {
      return;
    }

    const chart = chartRef.current;
    const series = candleSeriesRef.current;

    const handleCrosshairMove = (param: CrosshairMoveEventParams) => {
      if (!param.point || param.point.x < 0 || param.point.y < 0) {
        if (hoveredCandleRef.current !== null) {
          hoveredCandleRef.current = null;
          setHoveredCandle(null);
        }
        return;
      }

      const dataPoint = param.seriesData.get(series) as CandlestickData | undefined;
      let next: HoveredCandleInfo | null = null;

      if (dataPoint && typeof dataPoint.time === 'number') {
        next = {
          time: dataPoint.time as UTCTimestamp,
          open: dataPoint.open,
          high: dataPoint.high,
          low: dataPoint.low,
          close: dataPoint.close
        };
      } else if (typeof param.time === 'number') {
        const matched = candlesRef.current.find(
          (candle) => toTimestamp(candle.timestamp) === param.time
        );
        if (matched) {
          next = {
            time: toTimestamp(matched.timestamp),
            open: matched.open,
            high: matched.high,
            low: matched.low,
            close: matched.close
          };
        }
      }

      if (!next) {
        if (hoveredCandleRef.current !== null) {
          hoveredCandleRef.current = null;
          setHoveredCandle(null);
        }
        return;
      }

      const previous = hoveredCandleRef.current;
      if (
        previous &&
        previous.time === next.time &&
        previous.open === next.open &&
        previous.high === next.high &&
        previous.low === next.low &&
        previous.close === next.close
      ) {
        return;
      }

      hoveredCandleRef.current = next;
      setHoveredCandle(next);
    };

    chart.subscribeCrosshairMove(handleCrosshairMove);
    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [chartReady]);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const timeScale = chartRef.current.timeScale();
    const handler = () => {
      const position = timeScale.scrollPosition();
      if (typeof position === 'number') {
        followRealtimeRef.current = Math.abs(position) <= 0.1;
      }
      const logicalRange = timeScale.getVisibleLogicalRange();
      if (logicalRange != null) {
        const from = logicalRange.from;
        if (Number.isFinite(from) && from <= HISTORY_TRIGGER_THRESHOLD) {
          loadHistoryRef.current?.();
        }
      }
    };

    handler();
    timeScale.subscribeVisibleLogicalRangeChange(handler);
    return () => {
      timeScale.unsubscribeVisibleLogicalRangeChange(handler);
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current) {
      return;
    }

    const chart = chartRef.current;
    const refs = maSeriesRefs.current;

    if (!overlays.ma) {
      Object.values(refs).forEach((series) => series.setData([]));
      return;
    }

    Object.keys(refs).forEach((id) => {
      if (!maConfigs.some((config) => config.id === id)) {
        chart.removeSeries(refs[id]);
        delete refs[id];
      }
    });

    maConfigs.forEach((config) => {
      const lineStyle = lineStyleValue[config.lineStyle] ?? lineStyleValue.solid;
      let series = refs[config.id];
      if (!series) {
        series = chart.addLineSeries({
          priceScaleId: 'right',
          color: config.color,
          lineWidth: config.lineWidth,
          lineStyle,
          priceLineVisible: false,
          priceFormat: {
            type: 'custom',
            formatter: (value: number) => formatPrice(value)
          }
        });
        refs[config.id] = series;
      } else {
        series.applyOptions({
          color: config.color,
          lineWidth: config.lineWidth,
          lineStyle,
          priceLineVisible: false,
          priceFormat: {
            type: 'custom',
            formatter: (value: number) => formatPrice(value)
          }
        });
      }
    });
  }, [maConfigs, overlays.ma, chartReady]);

  useEffect(() => {
    if (!candles.length || !candleSeriesRef.current) {
      return;
    }

    const chartInstance = chartRef.current;
    const mainTimeScale = chartInstance?.timeScale();
    const latestCandle = candles[candles.length - 1];
    const latestTimestamp = toTimestamp(latestCandle.timestamp);
    const previousLength = lastSeriesLengthRef.current;
    const previousTimestamp = lastSeriesTimestampRef.current;

    const shouldResetSeries =
      previousLength === 0 ||
      candles.length < previousLength ||
      candles.length - previousLength > 2 ||
      (previousTimestamp != null && latestTimestamp < previousTimestamp);

    if (!candleSeriesRef.current) {
      return;
    }

    if (shouldResetSeries) {
      candleSeriesRef.current.setData(candles.map(toCandlestickData));
    } else {
      candleSeriesRef.current.update(toCandlestickData(latestCandle));
    }

    lastSeriesLengthRef.current = candles.length;
    lastSeriesTimestampRef.current = latestTimestamp;

    if (requireAutoscaleRef.current && chartInstance) {
      chartInstance.priceScale('right').applyOptions({ autoScale: true, alignLabels: true });
      requireAutoscaleRef.current = false;
    }

    const enrichedIndicators = (() => {
      const maSeriesData = new Map<string, Array<number | null>>();
      maConfigs.forEach((config) => {
        maSeriesData.set(config.id, calculateSMA(candles, config.length));
      });
      const boll = calculateBollingerBands(candles, bollingerConfig.period, bollingerConfig.multiplier);
      const rsiValues = calculateRSI(candles, rsiConfig.period);
      const macdValues = calculateMACD(
        candles,
        macdConfig.fastLength,
        macdConfig.slowLength,
        macdConfig.signalLength
      );
      const dmiValues = calculateDMI(candles, dmiConfig.diLength, dmiConfig.adxSmoothing);
      return { maSeriesData, boll, rsi: rsiValues, macd: macdValues, dmi: dmiValues };
    })();

    if (overlays.ma) {
      maConfigs.forEach((config) => {
        const series = maSeriesRefs.current[config.id];
        if (!series) {
          return;
        }
        const values = enrichedIndicators.maSeriesData.get(config.id);
        series.setData(values ? buildLineSeries(values, candles) : []);
      });
    } else {
      Object.values(maSeriesRefs.current).forEach((series) => series.setData([]));
    }

    if (bollUpperSeriesRef.current && bollLowerSeriesRef.current && bollMedianSeriesRef.current) {
      bollMedianSeriesRef.current.applyOptions({
        color: bollingerConfig.median.color,
        lineWidth: bollingerConfig.median.lineWidth,
        lineStyle: lineStyleValue[bollingerConfig.median.lineStyle],
        visible: overlays.bollinger
      });
      bollUpperSeriesRef.current.applyOptions({
        color: bollingerConfig.upper.color,
        lineWidth: bollingerConfig.upper.lineWidth,
        lineStyle: lineStyleValue[bollingerConfig.upper.lineStyle],
        visible: overlays.bollinger
      });
      bollLowerSeriesRef.current.applyOptions({
        color: bollingerConfig.lower.color,
        lineWidth: bollingerConfig.lower.lineWidth,
        lineStyle: lineStyleValue[bollingerConfig.lower.lineStyle],
        visible: overlays.bollinger
      });

      const bollData = enrichedIndicators.boll;
      bollMedianSeriesRef.current.setData(
        overlays.bollinger ? buildLineSeries(bollData.mid, candles) : []
      );
      bollUpperSeriesRef.current.setData(
        overlays.bollinger ? buildLineSeries(bollData.upper, candles) : []
      );
      bollLowerSeriesRef.current.setData(
        overlays.bollinger ? buildLineSeries(bollData.lower, candles) : []
      );
    }

    if (rsiSeriesRef.current) {
      rsiSeriesRef.current.setData(
        overlays.rsi ? buildLineSeries(enrichedIndicators.rsi, candles) : []
      );
      rsiSeriesRef.current.applyOptions({
        visible: overlays.rsi,
        color: rsiConfig.plot.color,
        lineWidth: rsiConfig.plot.lineWidth,
        lineStyle: lineStyleValue[rsiConfig.plot.lineStyle]
      });
    }

    if (macdLineSeriesRef.current && macdSignalSeriesRef.current && macdHistogramSeriesRef.current) {
      macdLineSeriesRef.current.setData(
        overlays.macd ? buildLineSeries(enrichedIndicators.macd.macdLine, candles) : []
      );
      macdSignalSeriesRef.current.setData(
        overlays.macd ? buildLineSeries(enrichedIndicators.macd.signalLine, candles) : []
      );
      const histogramData = overlays.macd
        ? buildHistogramSeries(enrichedIndicators.macd.histogram, candles, (value, _index, previous) => {
            const [negWeak, negStrong, posWeak, posStrong] = macdConfig.histogram.colors;
            if (value >= 0) {
              return previous != null && value >= previous ? posStrong : posWeak;
            }
            return previous != null && value <= previous ? negStrong : negWeak;
          })
        : [];
      macdHistogramSeriesRef.current.setData(histogramData);
      macdLineSeriesRef.current.applyOptions({
        visible: overlays.macd && macdConfig.visibility.macdLine,
        color: macdConfig.macdLine.color,
        lineWidth: macdConfig.macdLine.lineWidth,
        lineStyle: lineStyleValue[macdConfig.macdLine.lineStyle]
      });
      macdSignalSeriesRef.current.applyOptions({
        visible: overlays.macd && macdConfig.visibility.signalLine,
        color: macdConfig.signalLine.color,
        lineWidth: macdConfig.signalLine.lineWidth,
        lineStyle: lineStyleValue[macdConfig.signalLine.lineStyle]
      });
      macdHistogramSeriesRef.current.applyOptions({
        visible: overlays.macd && macdConfig.visibility.histogram,
        base: 0
      });
    }

    if (dmiPlusSeriesRef.current && dmiMinusSeriesRef.current && dmiAdxSeriesRef.current) {
      const dmiData = enrichedIndicators.dmi;
      const build = (values: Array<number | null>) =>
        overlays.dmi ? buildLineSeries(values, candles) : [];

      dmiPlusSeriesRef.current.setData(build(dmiData.plusDI));
      dmiMinusSeriesRef.current.setData(build(dmiData.minusDI));
      dmiAdxSeriesRef.current.setData(build(dmiData.adx));

      dmiPlusSeriesRef.current.applyOptions({
        visible: overlays.dmi && dmiConfig.visibility.plusDI,
        color: dmiConfig.plusDI.color,
        lineWidth: dmiConfig.plusDI.lineWidth,
        lineStyle: lineStyleValue[dmiConfig.plusDI.lineStyle]
      });
      dmiMinusSeriesRef.current.applyOptions({
        visible: overlays.dmi && dmiConfig.visibility.minusDI,
        color: dmiConfig.minusDI.color,
        lineWidth: dmiConfig.minusDI.lineWidth,
        lineStyle: lineStyleValue[dmiConfig.minusDI.lineStyle]
      });
      dmiAdxSeriesRef.current.applyOptions({
        visible: overlays.dmi && dmiConfig.visibility.adx,
        color: dmiConfig.adx.color,
        lineWidth: dmiConfig.adx.lineWidth,
        lineStyle: lineStyleValue[dmiConfig.adx.lineStyle]
      });

      if (dmiDxSeriesRef.current) {
        dmiDxSeriesRef.current.setData(build(dmiData.dx));
        dmiDxSeriesRef.current.applyOptions({
          visible: overlays.dmi && dmiConfig.visibility.dx,
          color: dmiConfig.dx.color,
          lineWidth: dmiConfig.dx.lineWidth,
          lineStyle: lineStyleValue[dmiConfig.dx.lineStyle]
        });
      }

      if (dmiAdxrSeriesRef.current) {
        dmiAdxrSeriesRef.current.setData(build(dmiData.adxr));
        dmiAdxrSeriesRef.current.applyOptions({
          visible: overlays.dmi && dmiConfig.visibility.adxr,
          color: dmiConfig.adxr.color,
          lineWidth: dmiConfig.adxr.lineWidth,
          lineStyle: lineStyleValue[dmiConfig.adxr.lineStyle]
        });
      }
    }

    if (candleSeriesRef.current) {
      if (overlays.highlight) {
        const markers: SeriesMarker<UTCTimestamp>[] = [];

        if (overlays.ma) {
          maConfigs.forEach((config) => {
            const values = enrichedIndicators.maSeriesData.get(config.id);
            if (!values) {
              return;
            }
            const { highlight } = config;
            candles.forEach((candle, index) => {
              const maValue = values[index];
              if (maValue == null) {
                return;
              }
              const candleValue = getCandleFieldValue(candle, highlight.candleField);
              if (highlight.over.enabled && candleValue > maValue) {
                markers.push({
                  time: toTimestamp(candle.timestamp),
                  position: 'aboveBar',
                  color: highlight.over.color,
                  shape: markerShapeValue[highlight.over.markerShape],
                  text: highlight.over.label
                });
              }
              if (highlight.under.enabled && candleValue < maValue) {
                markers.push({
                  time: toTimestamp(candle.timestamp),
                  position: 'belowBar',
                  color: highlight.under.color,
                  shape: markerShapeValue[highlight.under.markerShape],
                  text: highlight.under.label
                });
              }
            });
          });
        }

        if (overlays.bollinger) {
          const { upper, lower } = bollingerConfig.highlight;
          candles.forEach((candle, index) => {
            const upperBand = enrichedIndicators.boll.upper[index];
            const lowerBand = enrichedIndicators.boll.lower[index];
            if (upper.enabled && upperBand != null) {
              const reference = getCandleFieldValue(candle, upper.field);
              if (reference > upperBand) {
                markers.push({
                  time: toTimestamp(candle.timestamp),
                  position: 'aboveBar',
                  color: upper.color,
                  shape: markerShapeValue[upper.markerShape],
                  text: upper.label
                });
              }
            }
            if (lower.enabled && lowerBand != null) {
              const reference = getCandleFieldValue(candle, lower.field);
              if (reference < lowerBand) {
                markers.push({
                  time: toTimestamp(candle.timestamp),
                  position: 'belowBar',
                  color: lower.color,
                  shape: markerShapeValue[lower.markerShape],
                  text: lower.label
                });
              }
            }
          });
        }

        if (overlays.macd) {
          const histogramHighlight = macdConfig.highlight.histogram;
          const crossoverHighlight = macdConfig.highlight.crossover;
          const macdData = enrichedIndicators.macd;

          let prevTrend: 'up' | 'down' | null = null;
          for (let index = 1; index < candles.length; index += 1) {
            const prevValue = macdData.histogram[index - 1];
            const currValue = macdData.histogram[index];
            if (prevValue == null || currValue == null) {
              continue;
            }
            const currentTrend = currValue >= prevValue ? 'up' : 'down';
            const time = toTimestamp(candles[index].timestamp);
            if (prevTrend === 'down' && currentTrend === 'up' && histogramHighlight.turnUp.enabled) {
              markers.push({
                time,
                position: 'belowBar',
                color: histogramHighlight.turnUp.color,
                shape: markerShapeValue[histogramHighlight.turnUp.markerShape],
                text: histogramHighlight.turnUp.label
              });
            }
            if (prevTrend === 'up' && currentTrend === 'down' && histogramHighlight.turnDown.enabled) {
              markers.push({
                time,
                position: 'aboveBar',
                color: histogramHighlight.turnDown.color,
                shape: markerShapeValue[histogramHighlight.turnDown.markerShape],
                text: histogramHighlight.turnDown.label
              });
            }
            prevTrend = currentTrend;
          }

          for (let index = 1; index < candles.length; index += 1) {
            const prevMacd = macdData.macdLine[index - 1];
            const prevSignal = macdData.signalLine[index - 1];
            const currMacd = macdData.macdLine[index];
            const currSignal = macdData.signalLine[index];
            if (prevMacd == null || prevSignal == null || currMacd == null || currSignal == null) {
              continue;
            }
            const prevDiff = prevMacd - prevSignal;
            const currDiff = currMacd - currSignal;
            const time = toTimestamp(candles[index].timestamp);
            if (crossoverHighlight.bullish.enabled && prevDiff <= 0 && currDiff > 0) {
              markers.push({
                time,
                position: 'belowBar',
                color: crossoverHighlight.bullish.color,
                shape: markerShapeValue[crossoverHighlight.bullish.markerShape],
                text: crossoverHighlight.bullish.label
              });
            }
            if (crossoverHighlight.bearish.enabled && prevDiff >= 0 && currDiff < 0) {
              markers.push({
                time,
                position: 'aboveBar',
                color: crossoverHighlight.bearish.color,
                shape: markerShapeValue[crossoverHighlight.bearish.markerShape],
                text: crossoverHighlight.bearish.label
              });
            }
          }
        }

        if (overlays.rsi) {
          const { overbought, oversold } = rsiConfig.highlight;
          const upperLimit = rsiConfig.upperLimit;
          const lowerLimit = rsiConfig.lowerLimit;
          enrichedIndicators.rsi.forEach((value, index) => {
            if (value == null) {
              return;
            }
            const time = toTimestamp(candles[index].timestamp);
            if (overbought.enabled && value > upperLimit) {
              markers.push({
                time,
                position: 'aboveBar',
                color: overbought.color,
                shape: markerShapeValue[overbought.markerShape],
                text: overbought.label
              });
            }
            if (oversold.enabled && value < lowerLimit) {
              markers.push({
                time,
                position: 'belowBar',
                color: oversold.color,
                shape: markerShapeValue[oversold.markerShape],
                text: oversold.label
              });
            }
          });
        }

        if (overlays.dmi) {
          const { dominance, adx: adxHighlight, adxr: adxrHighlight } = dmiConfig.highlight;
          const dominanceSettings: Array<{
            enabled: boolean;
            condition: (plus: number, minus: number) => boolean;
            setting: HighlightThresholdSetting;
            position: 'aboveBar' | 'belowBar';
          }> = [
            {
              enabled: dominance.plusOverMinus.enabled,
              condition: (plus, minus) => plus > minus,
              setting: dominance.plusOverMinus,
              position: 'aboveBar'
            },
            {
              enabled: dominance.minusOverPlus.enabled,
              condition: (plus, minus) => minus > plus,
              setting: dominance.minusOverPlus,
              position: 'belowBar'
            }
          ];
          const valueHighlights: Array<{
            data: Array<number | null>;
            config: { over: ValueHighlightSetting; under: ValueHighlightSetting };
          }> = [
            { data: enrichedIndicators.dmi.adx, config: adxHighlight },
            { data: enrichedIndicators.dmi.adxr, config: adxrHighlight }
          ];

          candles.forEach((candle, index) => {
            const plus = enrichedIndicators.dmi.plusDI[index];
            const minus = enrichedIndicators.dmi.minusDI[index];
            const time = toTimestamp(candle.timestamp);

            if (plus != null && minus != null) {
              dominanceSettings.forEach(({ enabled, condition, setting, position }) => {
                if (!enabled || !condition(plus, minus)) {
                  return;
                }
                markers.push({
                  time,
                  position,
                  color: setting.color,
                  shape: markerShapeValue[setting.markerShape],
                  text: setting.label
                });
              });
            }

            valueHighlights.forEach(({ data, config }) => {
              const value = data[index];
              if (value == null) {
                return;
              }
              if (config.over.enabled && value >= config.over.threshold) {
                markers.push({
                  time,
                  position: 'aboveBar',
                  color: config.over.color,
                  shape: markerShapeValue[config.over.markerShape],
                  text: config.over.label
                });
              }
              if (config.under.enabled && value <= config.under.threshold) {
                markers.push({
                  time,
                  position: 'belowBar',
                  color: config.under.color,
                  shape: markerShapeValue[config.under.markerShape],
                  text: config.under.label
                });
              }
            });
          });
        }

        markers.sort((a, b) => Number(a.time) - Number(b.time));
        candleSeriesRef.current.setMarkers(markers);
      } else {
        candleSeriesRef.current.setMarkers([]);
      }
    }

    if (followRealtimeRef.current) {
      mainTimeScale?.scrollToRealTime();
    }
  }, [candles, overlays, maConfigs, bollingerConfig, rsiConfig, macdConfig, dmiConfig]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-xs text-zinc-300 md:text-sm">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3 md:gap-4">
            <span className="text-base font-semibold text-zinc-100 md:text-lg">{symbol}</span>
            <span className="text-lg font-semibold text-zinc-100 md:text-xl">{formattedPrice}</span>
            <span className={`text-sm font-semibold ${changeColor}`}>{formattedChange}</span>
            <span className={`rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${statusBadgeClass}`}>
              {statusLabel}
            </span>
            <span className="rounded bg-zinc-800 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-200">
              {interval}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wide text-zinc-500 md:gap-3 md:text-xs" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBaseHeight((height) => Math.max(320, height - 40))}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            높이 -
          </button>
          <button
            type="button"
            onClick={() => setBaseHeight((height) => Math.min(800, height + 40))}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            높이 +
          </button>
          <button
            type="button"
            onClick={() => setBaseHeight(DEFAULT_BASE_HEIGHT)}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            기본값
          </button>
          <span className="ml-2 text-xs text-zinc-500 md:text-sm">
            {baseHeight}px · total {totalHeight}px
          </span>
        </div>
      </div>
      <div
        ref={mainContainerRef}
        className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
        style={{ height: totalHeight }}
        aria-label="메인 캔들스틱 차트"
      >
        {hoveredSnapshot && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-1 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-100 shadow-sm md:text-xs">
            <span className="font-medium uppercase tracking-wide text-zinc-300">
              {hoveredSnapshot.date} {hoveredSnapshot.time}
            </span>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1">
                <span className="text-zinc-400">O</span>
                <span>{hoveredSnapshot.open}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-zinc-400">H</span>
                <span>{hoveredSnapshot.high}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-zinc-400">L</span>
                <span>{hoveredSnapshot.low}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="text-zinc-400">C</span>
                <span>{hoveredSnapshot.close}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
