export type CrossDir = 'up' | 'down' | 'both';
export type CrossWhen = 'recent' | 'previous';

export type ExprRef =
  | { type: 'indicator'; id: string }
  | { type: 'expr'; op: 'cross'; a: string; b: string; dir: CrossDir; when: CrossWhen; interp?: 'mid' | 'linear' }
  | { type: 'expr'; op: 'min' | 'max' | 'avg' | 'ratio'; a: string; b: string }
  | { type: 'expr'; op: 'offset'; a: string; pct: number };

export function parseExprRef(input: string | undefined | null): ExprRef | null {
  if (!input) return null;
  const s = String(input);
  if (!s.startsWith('expr:')) return { type: 'indicator', id: s };
  const parts = s.split(':');
  const op = parts[1];
  const a = parts[2];
  let b: string | undefined;
  const kv: Record<string, string> = {};
  for (let i = 3; i < parts.length; i++) {
    const seg = parts[i];
    const idx = seg.indexOf('=');
    if (idx > 0) {
      kv[seg.slice(0, idx)] = seg.slice(idx + 1);
    } else if (!b) {
      b = seg;
    }
  }

  if (op === 'cross') {
    const dir = (kv['dir'] as CrossDir) || 'both';
    const when = (kv['when'] as CrossWhen) || 'recent';
    const interp = (kv['interp'] as any) === 'linear' ? 'linear' : undefined;
    if (!a || !b) return null;
    return { type: 'expr', op: 'cross', a, b, dir, when, interp };
  }
  if (op === 'offset') {
    const pct = Number(kv['pct'] ?? '0');
    if (!a || !Number.isFinite(pct)) return null;
    return { type: 'expr', op: 'offset', a, pct };
  }
  if (op === 'min' || op === 'max' || op === 'avg' || op === 'ratio') {
    if (!a || !b) return null;
    return { type: 'expr', op: op as any, a, b };
  }
  return null;
}
