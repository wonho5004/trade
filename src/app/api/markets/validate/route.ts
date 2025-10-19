import { NextResponse } from 'next/server';

type Body = {
  manualSymbols?: string[];
  excludedSymbols?: string[];
  quote?: string;
  leverageOverrides?: Record<string, number>;
};

const SYMBOL_RE = /^[A-Z0-9]+(?:\/[A-Z0-9]+)?$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, invalidSymbols: [], warnings: ['invalid JSON body'] }, { status: 400 });
  }

  const manualSymbols = Array.isArray(body.manualSymbols) ? body.manualSymbols : [];
  const excludedSymbols = Array.isArray(body.excludedSymbols) ? body.excludedSymbols : [];
  const overrides = body.leverageOverrides ?? {};

  const warnings: string[] = [];
  const invalidSymbols: string[] = [];

  const checkList = (list: string[], label: string) => {
    const seen = new Set<string>();
    for (const raw of list) {
      const s = String(raw || '').trim().toUpperCase();
      if (!s) continue;
      if (!SYMBOL_RE.test(s)) invalidSymbols.push(raw);
      if (seen.has(s)) warnings.push(`${label}: duplicate ${s}`);
      seen.add(s);
    }
  };

  checkList(manualSymbols, 'manualSymbols');
  checkList(excludedSymbols, 'excludedSymbols');

  for (const [sym, lev] of Object.entries(overrides)) {
    if (typeof lev !== 'number' || !Number.isFinite(lev)) {
      warnings.push(`leverageOverrides: ${sym} has non-numeric value`);
      continue;
    }
    if (lev < 1 || lev > 125) warnings.push(`leverageOverrides: ${sym} out of range (1-125)`);
    const s = String(sym || '').trim().toUpperCase();
    if (!SYMBOL_RE.test(s)) warnings.push(`leverageOverrides: invalid symbol ${sym}`);
  }

  const ok = invalidSymbols.length === 0;
  return NextResponse.json({ ok, invalidSymbols, warnings });
}

