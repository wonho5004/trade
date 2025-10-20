import type { Candle } from '@/types/chart';
import type { IndicatorConditions, IndicatorLeafNode } from '@/types/trading/auto-trading';
import { collectIndicatorNodes } from '@/lib/trading/conditionsTree';

const last = <T>(arr: T[], idxFromEnd = 0): T | undefined => arr[arr.length - 1 - idxFromEnd];

const sma = (values: number[], period: number): number[] => {
  const out: number[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : NaN);
  }
  return out;
};

const ema = (values: number[], period: number): number[] => {
  const out: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
};

const std = (values: number[], period: number): number[] => {
  const out: number[] = [];
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    sum += v;
    sumSq += v * v;
    if (i >= period) {
      const old = values[i - period];
      sum -= old;
      sumSq -= old * old;
    }
    if (i >= period - 1) {
      const mean = sum / period;
      const variance = Math.max(0, sumSq / period - mean * mean);
      out.push(Math.sqrt(variance));
    } else {
      out.push(NaN);
    }
  }
  return out;
};

const rsi = (closes: number[], period: number, method: 'sma' | 'ema' = 'sma'): number[] => {
  const gains: number[] = [];
  const losses: number[] = [];
  gains.push(0);
  losses.push(0);
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(Math.max(0, diff));
    losses.push(Math.max(0, -diff));
  }
  const avgG = method === 'ema' ? ema(gains, period) : sma(gains, period);
  const avgL = method === 'ema' ? ema(losses, period) : sma(losses, period);
  const out: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    const ag = avgG[i];
    const al = avgL[i];
    if (!Number.isFinite(ag) || !Number.isFinite(al) || ag + al === 0) {
      out.push(NaN);
    } else {
      const rs = ag / al;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
};

const macdSeries = (closes: number[], fast: number, slow: number, signal: number, method: 'EMA' | 'SMA' = 'EMA') => {
  const ma = method === 'EMA' ? ema : sma;
  const fastArr = ma(closes, fast);
  const slowArr = ma(closes, slow);
  const macd: number[] = [];
  for (let i = 0; i < closes.length; i++) macd.push(fastArr[i] - slowArr[i]);
  const signalArr = method === 'EMA' ? ema(macd, signal) : sma(macd, signal);
  const hist: number[] = macd.map((v, i) => v - signalArr[i]);
  return { macd, signal: signalArr, hist };
};

function evalMa(node: IndicatorLeafNode, closes: number[]): boolean {
  const period = Math.max(1, Number((node.indicator.config as any)?.period) || 20);
  const m = sma(closes, period);
  const c0 = last(closes);
  const c1 = last(closes, 1);
  const ma0 = last(m);
  const ma1 = last(m, 1);
  if (!Number.isFinite(c0!) || !Number.isFinite(ma0!)) return false;
  const actions: string[] = ((node.indicator.config as any)?.actions ?? []) as string[];
  const or: boolean[] = [];
  if (actions.includes('break_above') && Number.isFinite(c1!) && Number.isFinite(ma1!)) or.push(c1! <= ma1! && c0! > ma0!);
  if (actions.includes('break_below') && Number.isFinite(c1!) && Number.isFinite(ma1!)) or.push(c1! >= ma1! && c0! < ma0!);
  if (actions.includes('stay_above')) or.push(c0! > ma0!);
  if (actions.includes('stay_below')) or.push(c0! < ma0!);
  return or.length > 0 ? or.some(Boolean) : c0! > ma0!; // 기본: 종가>MA
}

function evalRsi(node: IndicatorLeafNode, closes: number[]): boolean {
  const cfg = node.indicator.config as any;
  const period = Math.max(2, Number(cfg?.period) || 14);
  const method = String(cfg?.smoothing || 'sma').toLowerCase() as 'sma' | 'ema';
  const series = rsi(closes, period, method);
  const r0 = last(series);
  const r1 = last(series, 1);
  if (!Number.isFinite(r0!)) return false;
  const th = Number(cfg?.threshold) || 50;
  const actions: string[] = (cfg?.actions ?? []) as string[];
  const or: boolean[] = [];
  if (actions.includes('cross_above') && Number.isFinite(r1!)) or.push(r1! <= th && r0! > th);
  if (actions.includes('cross_below') && Number.isFinite(r1!)) or.push(r1! >= th && r0! < th);
  if (actions.includes('stay_above')) or.push(r0! > th);
  if (actions.includes('stay_below')) or.push(r0! < th);
  return or.length > 0 ? or.some(Boolean) : r0! > th;
}

function evalBollinger(node: IndicatorLeafNode, closes: number[]): boolean {
  const cfg = node.indicator.config as any;
  const len = Math.max(2, Number(cfg?.length) || 20);
  const sd = Math.max(0.1, Number(cfg?.standardDeviation) || 2);
  const mean = sma(closes, len);
  const deviation = std(closes, len);
  const upper = mean.map((m, i) => m + sd * deviation[i]);
  const lower = mean.map((m, i) => m - sd * deviation[i]);
  const c0 = last(closes)!;
  const u0 = last(upper)!;
  const l0 = last(lower)!;
  const u1 = last(upper, 1)!;
  const l1 = last(lower, 1)!;
  const band = (cfg?.band || 'middle') as string;
  const action = (cfg?.action || 'touch') as string;
  const tol = Math.max(0, Number(cfg?.touchTolerancePct ?? 0.2)) / 100; // percent to ratio
  if (band === 'upper') {
    if (action === 'break_above') return c0 > u0 && last(closes, 1)! <= u1;
    if (action === 'break_below') return c0 < u0 && last(closes, 1)! >= u1;
    return Math.abs(c0 - u0) / u0 < tol;
  }
  if (band === 'lower') {
    if (action === 'break_above') return c0 > l0 && last(closes, 1)! <= l1;
    if (action === 'break_below') return c0 < l0 && last(closes, 1)! >= l1;
    return Math.abs(c0 - l0) / l0 < tol;
  }
  // middle = mean
  const m0 = last(mean)!;
  const m1 = last(mean, 1)!;
  if (action === 'break_above') return c0 > m0 && last(closes, 1)! <= m1;
  if (action === 'break_below') return c0 < m0 && last(closes, 1)! >= m1;
  return Math.abs(c0 - m0) / m0 < tol * 0.75; // middle은 약간 타이트하게
}

function evalMacd(node: IndicatorLeafNode, closes: number[]): boolean {
  const cfg = node.indicator.config as any;
  const fast = Number(cfg?.fast) || 12;
  const slow = Number(cfg?.slow) || 26;
  const signal = Number(cfg?.signal) || 9;
  const method = (cfg?.method || 'EMA') as 'EMA' | 'SMA';
  const { macd, signal: sig, hist } = macdSeries(closes, fast, slow, signal, method);
  const m0 = last(macd)!;
  const s0 = last(sig)!;
  const h0 = last(hist)!;
  const h1 = last(hist, 1)!;
  const comparison = cfg?.comparison as string | null;
  const histAct = cfg?.histogramAction as string | null;
  const cmpOk = comparison === 'macd_over_signal' ? m0 > s0 : comparison === 'macd_under_signal' ? m0 < s0 : null;
  const histOk = histAct === 'increasing' ? h0 > h1 : histAct === 'decreasing' ? h0 < h1 : null;
  if (cmpOk != null && histOk != null) return cmpOk && histOk; // 둘 다 설정되면 동시 충족
  if (cmpOk != null) return cmpOk;
  if (histOk != null) return histOk;
  return m0 > s0;
}

export function computeDmiSnapshot(candles: Candle[], diPeriod: number, adxPeriod: number): { diPlus: number; diMinus: number; adx: number } | null {
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const closes = candles.map((c) => c.close);
  const n = closes.length;
  if (n < Math.max(diPeriod, adxPeriod) + 2) return null;
  const tr: number[] = [NaN];
  const plusDM: number[] = [NaN];
  const minusDM: number[] = [NaN];
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(tr1, tr2, tr3));
  }
  const smooth = (arr: number[], period: number): number[] => {
    const out: number[] = [];
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i] ?? 0;
      if (i < period) {
        sum += v;
        out.push(i === period - 1 ? sum : NaN);
      } else if (i === period) {
        sum += v;
        out.push(sum);
      } else {
        const prev = out[i - 1];
        out.push(prev - prev / period + v);
      }
    }
    return out;
  };
  const smTR = smooth(tr.slice(1), diPeriod);
  const smPlus = smooth(plusDM.slice(1), diPeriod);
  const smMinus = smooth(minusDM.slice(1), diPeriod);
  const diPlus: number[] = smPlus.map((v, i) => (Number.isFinite(v) && Number.isFinite(smTR[i]) && smTR[i] !== 0 ? (100 * v) / smTR[i] : NaN));
  const diMinus: number[] = smMinus.map((v, i) => (Number.isFinite(v) && Number.isFinite(smTR[i]) && smTR[i] !== 0 ? (100 * v) / smTR[i] : NaN));
  const dx: number[] = diPlus.map((dp, i) => {
    const dm = diMinus[i];
    if (!Number.isFinite(dp) || !Number.isFinite(dm) || dp + dm === 0) return NaN;
    return (100 * Math.abs(dp - dm)) / (dp + dm);
  });
  const adxArr = smooth(dx, adxPeriod).map((v) => (Number.isFinite(v) ? v / adxPeriod : NaN));
  const dp0 = last(diPlus);
  const dm0 = last(diMinus);
  const adx0 = last(adxArr);
  if (!Number.isFinite(dp0!) || !Number.isFinite(dm0!) || !Number.isFinite(adx0!)) return null;
  return { diPlus: dp0 as number, diMinus: dm0 as number, adx: adx0 as number };
}

export function buildIndicatorSignalsFromSeries(
  conditions: IndicatorConditions,
  series: { closes: number[]; highs: number[]; lows: number[] }
): Record<string, boolean> {
  const root = (conditions.root as any) || conditions;
  const nodes = collectIndicatorNodes(root);
  const { closes, highs, lows } = series;
  const signals: Record<string, boolean> = {};
  for (const node of nodes) {
    const type = node.indicator.type;
    let v = false;
    try {
      if (type === 'ma') v = evalMa(node, closes);
      else if (type === 'rsi') v = evalRsi(node, closes);
      else if (type === 'bollinger') v = evalBollinger(node, closes);
      else if (type === 'macd') v = evalMacd(node, closes);
      else if (type === 'dmi') v = evalDmi(node, highs, lows, closes);
      else v = false;
    } catch {
      v = false;
    }
    signals[node.id] = !!v;
  }
  return signals;
}

// Build numeric indicator series per indicator leaf id for use in priceResolver
export function buildIndicatorNumericSeries(
  conditions: IndicatorConditions,
  series: { closes: number[]; highs: number[]; lows: number[] }
): Record<string, number[]> {
  const root = (conditions.root as any) || conditions;
  const nodes = collectIndicatorNodes(root);
  const { closes, highs, lows } = series;
  const out: Record<string, number[]> = {};
  for (const node of nodes) {
    const type = node.indicator.type as string;
    try {
      if (type === 'ma') {
        const period = Math.max(1, Number((node.indicator.config as any)?.period) || 20);
        out[node.id] = sma(closes, period);
      } else if (type === 'rsi') {
        const cfg = node.indicator.config as any;
        const period = Math.max(2, Number(cfg?.period) || 14);
        const method = String(cfg?.smoothing || 'sma').toLowerCase() as 'sma' | 'ema';
        out[node.id] = rsi(closes, period, method);
      } else if (type === 'bollinger') {
        const cfg = node.indicator.config as any;
        const len = Math.max(2, Number(cfg?.length) || 20);
        const deviation = std(closes, len);
        const mean = sma(closes, len);
        const sd = Number(cfg?.standardDeviation) || 2;
        const band = (cfg?.band || 'middle') as string;
        if (band === 'upper') out[node.id] = mean.map((m, i) => m + sd * deviation[i]);
        else if (band === 'lower') out[node.id] = mean.map((m, i) => m - sd * deviation[i]);
        else out[node.id] = mean; // middle
      } else if (type === 'macd') {
        const cfg = node.indicator.config as any;
        const fast = Number(cfg?.fast) || 12;
        const slow = Number(cfg?.slow) || 26;
        const signal = Number(cfg?.signal) || 9;
        const method = (cfg?.method || 'EMA') as 'EMA' | 'SMA';
        const m = macdSeries(closes, fast, slow, signal, method);
        out[node.id] = m.macd; // primary
      } else if (type === 'dmi') {
        const cfg = node.indicator.config as any;
        const diP = Math.max(1, Number(cfg?.diPeriod) || 14);
        const adxP = Math.max(1, Number(cfg?.adxPeriod) || 14);
        // approximate ADX series using compute-like smoother
        // reuse computeDmiSnapshot logic on sliding window — but lightweight approximation here
        const n = closes.length;
        const highsArr = highs.slice();
        const lowsArr = lows.slice();
        const adxSeries: number[] = new Array(n).fill(NaN);
        for (let i = diP + adxP + 1; i < n; i++) {
          const windowHighs = highsArr.slice(0, i + 1);
          const windowLows = lowsArr.slice(0, i + 1);
          const windowCloses = closes.slice(0, i + 1);
          const snap = computeDmiSnapshot(
            windowHighs.map((h, k) => ({ high: h, low: windowLows[k], close: windowCloses[k] })) as any,
            diP,
            adxP
          );
          adxSeries[i] = snap ? snap.adx : NaN;
        }
        out[node.id] = adxSeries;
      } else {
        out[node.id] = new Array(closes.length).fill(NaN);
      }
    } catch {
      out[node.id] = new Array(closes.length).fill(NaN);
    }
  }
  return out;
}

export function buildIndicatorSignals(conditions: IndicatorConditions, candles: Candle[]): Record<string, boolean> {
  const closes = candles.map((c) => c.close);
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  return buildIndicatorSignalsFromSeries(conditions, { closes, highs, lows });
}

export function requiredLookback(conditions: IndicatorConditions): number {
  try {
    const root = (conditions.root as any) || conditions;
    const nodes = collectIndicatorNodes(root);
    let need = 0;
    for (const node of nodes) {
      const t = (node as any).indicator?.type as string;
      const cfg: any = (node as any).indicator?.config || {};
      if (t === 'ma') need = Math.max(need, Number(cfg.period) || 20);
      else if (t === 'rsi') need = Math.max(need, (Number(cfg.period) || 14) + 2);
      else if (t === 'bollinger') need = Math.max(need, (Number(cfg.length) || 20) + 2);
      else if (t === 'macd') need = Math.max(need, (Number(cfg.slow) || 26) + (Number(cfg.signal) || 9) + 2);
      else if (t === 'dmi') need = Math.max(need, (Number(cfg.diPeriod) || 14) + (Number(cfg.adxPeriod) || 14) + 2);
    }
    return Math.max(50, need + 5);
  } catch {
    return 120;
  }
}

// ---- DMI / ADX ----
function evalDmi(node: IndicatorLeafNode, highs: number[], lows: number[], closes: number[]): boolean {
  const cfg = node.indicator.config as any;
  const diPeriod = Math.max(2, Number(cfg?.diPeriod) || 14);
  const adxPeriod = Math.max(2, Number(cfg?.adxPeriod) || 14);
  const n = closes.length;
  if (n < Math.max(diPeriod, adxPeriod) + 2) return false;
  // True Range, +DM, -DM
  const tr: number[] = [NaN];
  const plusDM: number[] = [NaN];
  const minusDM: number[] = [NaN];
  for (let i = 1; i < n; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    const tr1 = highs[i] - lows[i];
    const tr2 = Math.abs(highs[i] - closes[i - 1]);
    const tr3 = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(tr1, tr2, tr3));
  }
  // Wilder smoothing
  const smooth = (arr: number[], period: number): number[] => {
    const out: number[] = [];
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      const v = arr[i] ?? 0;
      if (i < period) {
        sum += v;
        out.push(i === period - 1 ? sum : NaN);
      } else if (i === period) {
        sum += v;
        // first smoothed value per Wilder is initial sum
        out.push(sum);
      } else {
        const prev = out[i - 1];
        out.push(prev - prev / period + v);
      }
    }
    return out;
  };
  const smTR = smooth(tr.slice(1), diPeriod); // align index starting at 0 -> original i=1
  const smPlus = smooth(plusDM.slice(1), diPeriod);
  const smMinus = smooth(minusDM.slice(1), diPeriod);
  const diPlus: number[] = smPlus.map((v, i) => (Number.isFinite(v) && Number.isFinite(smTR[i]) && smTR[i] !== 0 ? (100 * v) / smTR[i] : NaN));
  const diMinus: number[] = smMinus.map((v, i) => (Number.isFinite(v) && Number.isFinite(smTR[i]) && smTR[i] !== 0 ? (100 * v) / smTR[i] : NaN));
  const dx: number[] = diPlus.map((dp, i) => {
    const dm = diMinus[i];
    if (!Number.isFinite(dp) || !Number.isFinite(dm) || dp + dm === 0) return NaN;
    return (100 * Math.abs(dp - dm)) / (dp + dm);
  });
  const adxArr = smooth(dx, adxPeriod).map((v) => (Number.isFinite(v) ? v / adxPeriod : NaN));
  const dp0 = last(diPlus);
  const dm0 = last(diMinus);
  const adx0 = last(adxArr);
  if (!Number.isFinite(dp0!) || !Number.isFinite(dm0!) || !Number.isFinite(adx0!)) return false;
  // Evaluate config
  const checks: boolean[] = [];
  if (cfg?.diComparison === 'plus_over_minus') checks.push(dp0! > dm0!);
  if (cfg?.diComparison === 'minus_over_plus') checks.push(dm0! > dp0!);
  const cmp = (left: number, comparator: string, right: number): boolean => {
    if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
    if (comparator === 'over') return left > right;
    if (comparator === 'under') return left < right;
    if (comparator === 'eq') return Math.abs(left - right) < 1e-12;
    if (comparator === 'lte') return left <= right;
    if (comparator === 'gte') return left >= right;
    return false;
  };
  if (cfg?.adx?.enabled) checks.push(cmp(adx0!, cfg.adx.comparator, Number(cfg.adx.value) || 0));
  if (cfg?.diPlus?.enabled) checks.push(cmp(dp0!, cfg.diPlus.comparator, Number(cfg.diPlus.value) || 0));
  if (cfg?.diMinus?.enabled) checks.push(cmp(dm0!, cfg.diMinus.comparator, Number(cfg.diMinus.value) || 0));
  if (cfg?.adxVsDi === 'adx_gt_di_plus') checks.push(adx0! > dp0!);
  if (cfg?.adxVsDi === 'adx_lt_di_plus') checks.push(adx0! < dp0!);
  if (cfg?.adxVsDi === 'adx_gt_di_minus') checks.push(adx0! > dm0!);
  if (cfg?.adxVsDi === 'adx_lt_di_minus') checks.push(adx0! < dm0!);
  // If no subconditions specified, default to DI+ > DI-
  if (checks.length === 0) return dp0! > dm0!;
  return checks.every(Boolean);
}
