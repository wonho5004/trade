import { cookies } from 'next/headers';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

type ClientRole = 'anon' | 'service';

const AUTH_SESSION_COOKIE = 'bt-auth-token';
const AUTH_ROLE_COOKIE = 'bt-auth-role';

export function getAuthCookieNames() {
  return {
    session: AUTH_SESSION_COOKIE,
    role: AUTH_ROLE_COOKIE
  };
}

function resolveSupabaseKey(role: ClientRole) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL 환경 변수가 설정되어 있지 않습니다.');
  }
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY 환경 변수가 설정되어 있지 않습니다.');
  }

  if (role === 'service') {
    return {
      url,
      key: process.env.SUPABASE_SERVICE_ROLE_KEY ?? anon
    };
  }

  return { url, key: anon };
}

export function createSupabaseServerClient(role: ClientRole = 'anon'): SupabaseClient<any> {
  const { url, key } = resolveSupabaseKey(role);
  return createClient<Database, 'public'>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function readAuthCookies() {
  const cookieStore = cookies();
  const names = getAuthCookieNames();
  return {
    token: cookieStore.get(names.session)?.value ?? null,
    role: cookieStore.get(names.role)?.value ?? null
  };
}

export function writeAuthCookies({
  token,
  role,
  maxAgeSeconds = 60 * 60 * 24
}: {
  token: string;
  role: string;
  maxAgeSeconds?: number;
}) {
  const cookieStore = cookies();
  const names = getAuthCookieNames();
  cookieStore.set(names.session, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds
  });
  cookieStore.set(names.role, role, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSeconds
  });
}

export function clearAuthCookies() {
  const cookieStore = cookies();
  const names = getAuthCookieNames();
  cookieStore.delete(names.session);
  cookieStore.delete(names.role);
}
