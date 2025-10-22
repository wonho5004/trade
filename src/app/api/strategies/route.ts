import { NextResponse } from 'next/server';

import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

type StrategyRecord = {
  id: string;
  name: string;
  payload: unknown;
  createdAt: string;
};

function errorJson(status: number, code: string, message: string, details?: Record<string, unknown>) {
  const requestId = (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return NextResponse.json(
    { success: false, error: { code, message, details }, requestId, ts: new Date().toISOString() },
    { status }
  );
}

export async function GET() {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user) return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');

    const user = userData.user;
    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (profileRes.data?.role ?? 'guest') as 'guest' | 'member' | 'admin' | 'sys_admin';

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const current = (meta.auto_trading_strategy as StrategyRecord | undefined) ?? null;
    const backups = Array.isArray(meta.auto_trading_strategy_backups) ? (meta.auto_trading_strategy_backups as StrategyRecord[]) : [];
    const limit = role === 'sys_admin' ? 1000 : 1;

    return NextResponse.json({
      limit,
      count: current ? 1 : 0,
      strategy: current,
      backups: role === 'sys_admin' ? backups : undefined
    });
  } catch (e) {
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}

export async function POST(request: Request) {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user) return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');

    const user = userData.user;
    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (profileRes.data?.role ?? 'guest') as 'guest' | 'member' | 'admin' | 'sys_admin';
    const limit = role === 'sys_admin' ? 1000 : 1;

    const body = (await request.json()) as { name: string; payload: unknown };
    const name = (body?.name ?? '').toString().trim();
    if (!name) return errorJson(400, 'VALIDATION_ERROR', '전략 이름은 필수입니다.', { fieldErrors: [{ field: 'logicName', code: 'REQUIRED', message: '전략 이름을 입력하세요.' }] });

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const current = (meta.auto_trading_strategy as StrategyRecord | undefined) ?? null;
    const backups = Array.isArray(meta.auto_trading_strategy_backups) ? (meta.auto_trading_strategy_backups as StrategyRecord[]) : [];

    const now = new Date().toISOString();
    const newRecord: StrategyRecord = {
      id: `${user.id}-${Date.now()}`,
      name,
      payload: body.payload,
      createdAt: now
    };

    const nextMeta: Record<string, unknown> = {};
    if (current) {
      // move to backups, always keep history; non-admins still see only current via GET
      backups.unshift(current);
    }
    nextMeta.auto_trading_strategy = newRecord;
    nextMeta.auto_trading_strategy_backups = backups.slice(0, 50);

    // Enforce simple per-user limit (1) by design: current is replaced. Admins can manage backups out of band.
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: nextMeta
    });
    if (updateError) return errorJson(500, 'INTERNAL', '전략 저장에 실패했습니다.');

    return NextResponse.json({ ok: true, strategy: newRecord, limit });
  } catch (e) {
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}

export async function DELETE() {
  try {
    const { token } = await readAuthCookies();
    if (!token) return errorJson(401, 'UNAUTHORIZED', '로그인이 필요합니다.');
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user) return errorJson(401, 'UNAUTHORIZED', '인증이 유효하지 않습니다.');
    const user = userData.user;

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { auto_trading_strategy: null }
    });
    if (updateError) return errorJson(500, 'INTERNAL', '전략 삭제에 실패했습니다.');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorJson(500, 'INTERNAL', '서버 오류가 발생했습니다.');
  }
}
