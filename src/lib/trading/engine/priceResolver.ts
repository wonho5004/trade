import { parseExprRef } from '@/lib/trading/expr';

export type IndicatorSeriesMap = Record<string, number[]>; // id -> numeric series (aligned to candle index)

const lastFinite = (arr: number[], idx = 0) => {
  const i = arr.length - 1 - idx;
  if (i < 0) return NaN;
  const v = arr[i];
  return Number.isFinite(v) ? v : NaN;
};

// Find cross index going backward; returns candle index where cross detected
function findCrossIndex(a: number[], b: number[], dir: 'up' | 'down' | 'both', which: 'recent' | 'previous'): number | null {
  let found: number | null = null;
  for (let i = a.length - 1; i >= 1; i--) {
    const a0 = a[i], a1 = a[i - 1];
    const b0 = b[i], b1 = b[i - 1];
    if (!Number.isFinite(a0) || !Number.isFinite(a1) || !Number.isFinite(b0) || !Number.isFinite(b1)) continue;
    const up = a1 <= b1 && a0 > b0;
    const down = a1 >= b1 && a0 < b0;
    const ok = dir === 'both' ? (up || down) : dir === 'up' ? up : down;
    if (ok) {
      if (!found) {
        found = i;
        if (which === 'recent') return found;
      } else {
        // second cross from the end => previous
        return which === 'previous' ? i : found;
      }
    }
  }
  return which === 'previous' ? null : found;
}

function interpolateCross(a1: number, a0: number, b1: number, b0: number): number | null {
  // linear interpolation along segment from index i-1 -> i
  const da = a0 - a1;
  const db = b0 - b1;
  const denom = (da - db);
  if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return null;
  const t = (b1 - a1) / denom; // fraction between 0..1
  if (!(t >= 0 && t <= 1)) return null;
  return a1 + t * da;
}

// Resolve a numeric price from a reference string using indicator series.
// index: price at current last candle; series should be aligned.
export function resolvePriceFromRef(ref: string | undefined | null, series: IndicatorSeriesMap, index?: number): number | null {
  const parsed = parseExprRef(ref ?? '');
  if (!parsed) return null;
  const at = (id: string): number => {
    const arr = series[id];
    if (!arr || arr.length === 0) return NaN;
    if (typeof index === 'number' && index >= 0 && index < arr.length) return arr[index];
    return lastFinite(arr);
  };

  if (parsed.type === 'indicator') {
    const v = at(parsed.id);
    return Number.isFinite(v) ? v : null;
  }

  // Derived expressions
  if (parsed.type === 'expr') {
    if (parsed.op === 'cross') {
      const a = series[parsed.a];
      const b = series[parsed.b];
      if (!a || !b || a.length < 2 || b.length < 2) return null;
      const ci = findCrossIndex(a, b, parsed.dir, parsed.when);
      if (ci == null) return null;
      const aV = a[ci];
      const bV = b[ci];
      if (!Number.isFinite(aV) || !Number.isFinite(bV)) return null;
      if (parsed.interp === 'linear' && ci - 1 >= 0) {
        const a1 = a[ci - 1];
        const b1 = b[ci - 1];
        if (Number.isFinite(a1) && Number.isFinite(b1)) {
          const iv = interpolateCross(a1, aV, b1, bV);
          if (Number.isFinite(iv as number)) return iv as number;
        }
      }
      // 기본(후방 호환): 교차 봉에서 두 값의 평균
      return (aV + bV) / 2;
    }
    if (parsed.op === 'min' || parsed.op === 'max' || parsed.op === 'avg' || parsed.op === 'ratio') {
      const a = at(parsed.a);
      const b = at(parsed.b);
      if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
      if (parsed.op === 'min') return Math.min(a, b);
      if (parsed.op === 'max') return Math.max(a, b);
      if (parsed.op === 'avg') return (a + b) / 2;
      if (parsed.op === 'ratio') return b !== 0 ? a / b : null;
    }
    if (parsed.op === 'offset') {
      const a = at(parsed.a);
      if (!Number.isFinite(a)) return null;
      const pct = (parsed as any).pct as number;
      return a * (1 + (Number.isFinite(pct) ? pct : 0) / 100);
    }
  }
  return null;
}
