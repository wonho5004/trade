import { NextResponse } from 'next/server';

import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const env = {
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anon),
    hasServiceKey: Boolean(service)
  };

  try {
    const svc = createSupabaseServerClient('service');
    const { count, error: countError } = await svc.from('profiles').select('*', { count: 'exact', head: true });
    const { token } = readAuthCookies();
    const { data: userData, error: userError } = token ? await svc.auth.getUser(token) : { data: null, error: null } as any;
    return NextResponse.json({
      ok: true,
      env,
      profilesCount: countError ? null : (typeof count === 'number' ? count : null),
      hasToken: Boolean(token),
      userId: userData?.user?.id ?? null,
      userEmail: userData?.user?.email ?? null,
      userError: userError?.message ?? null
    });
  } catch (error) {
    return NextResponse.json({ ok: false, env, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
