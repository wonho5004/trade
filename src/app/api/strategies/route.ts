import { NextResponse } from 'next/server';

import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

type StrategyRecord = {
  id: string;
  name: string;
  payload: unknown;
  createdAt: string;
};

export async function GET() {
  try {
    const { token } = readAuthCookies();
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

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
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { token } = readAuthCookies();
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const user = userData.user;
    const profileRes = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    const role = (profileRes.data?.role ?? 'guest') as 'guest' | 'member' | 'admin' | 'sys_admin';
    const limit = role === 'sys_admin' ? 1000 : 1;

    const body = (await request.json()) as { name: string; payload: unknown };
    const name = (body?.name ?? '').toString().trim();
    if (!name) return NextResponse.json({ error: 'invalid_name' }, { status: 400 });

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
    if (updateError) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });

    return NextResponse.json({ ok: true, strategy: newRecord, limit });
  } catch (e) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { token } = readAuthCookies();
    if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const supabase = createSupabaseServerClient('service');
    const { data: userData, error } = await supabase.auth.getUser(token);
    if (error || !userData?.user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const user = userData.user;

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { auto_trading_strategy: null }
    });
    if (updateError) return NextResponse.json({ error: 'persist_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

