import { NextResponse } from 'next/server';

type Body = {
  manualSymbols?: string[];
  excludedSymbols?: string[];
  quote?: string;
  leverageOverrides?: Record<string, number>;
};

const SYMBOL_RE = /^[A-Z0-9]+(?:\/[A-Z0-9]+)?$/;

export async function POST(req: Request) {
  const requestId = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'BAD_REQUEST', message: '유효하지 않은 JSON 본문입니다.' },
        requestId,
        ts: new Date().toISOString()
      },
      { status: 400 }
    );
  }

  const manualSymbols = Array.isArray(body.manualSymbols) ? body.manualSymbols : [];
  const excludedSymbols = Array.isArray(body.excludedSymbols) ? body.excludedSymbols : [];
  const overrides = body.leverageOverrides ?? {};

  const warnings: string[] = [];
  const invalidManual: string[] = [];
  const invalidExcluded: string[] = [];
  const fieldErrors: Array<{ field: string; code: string; message: string }> = [];

  const checkList = (list: string[], label: 'manualSymbols' | 'excludedSymbols') => {
    const seen = new Set<string>();
    for (const raw of list) {
      const s = String(raw || '').trim().toUpperCase();
      if (!s) continue;
      if (!SYMBOL_RE.test(s)) {
        if (label === 'manualSymbols') invalidManual.push(raw);
        else invalidExcluded.push(raw);
      }
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
    if (!SYMBOL_RE.test(s)) {
      fieldErrors.push({ field: 'leverageOverrides', code: 'INVALID_SYMBOL', message: `레버리지 오버라이드의 심볼이 잘못되었습니다: ${sym}` });
    }
  }

  if (invalidManual.length > 0) {
    fieldErrors.push({ field: 'manualSymbols', code: 'INVALID_SYMBOL', message: `유효하지 않은 심볼: ${invalidManual.join(', ')}` });
  }
  if (invalidExcluded.length > 0) {
    fieldErrors.push({ field: 'excludedSymbols', code: 'INVALID_SYMBOL', message: `유효하지 않은 제외 심볼: ${invalidExcluded.join(', ')}` });
  }

  if (fieldErrors.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: '입력한 심볼을 확인해 주세요.',
          details: warnings.length ? { warnings } : undefined,
          fieldErrors
        },
        requestId,
        ts: new Date().toISOString()
      },
      { status: 422 }
    );
  }

  // 성공: 기존 클라이언트 호환을 위해 ok/warnings 유지
  return NextResponse.json({ ok: true, warnings }, { status: 200 });
}
