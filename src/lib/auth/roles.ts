import { redirect } from 'next/navigation';

import { readAuthCookies } from '@/lib/supabase/server';

export type UserRole = 'user' | 'admin' | 'sys_admin';

const ROLE_WEIGHT: Record<UserRole, number> = {
  user: 1,
  admin: 2,
  sys_admin: 3
};

export function isRoleAtLeast(role: UserRole | null | undefined, required: UserRole) {
  if (!role) {
    return false;
  }
  const current = ROLE_WEIGHT[role as UserRole];
  const target = ROLE_WEIGHT[required];
  if (!current) {
    return false;
  }
  return current >= target;
}

export async function requireAuthenticatedUser(nextUrl?: string) {
  const { token, role } = readAuthCookies();

  if (!token) {
    const target = new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
    if (nextUrl) {
      target.searchParams.set('next', nextUrl);
    }
    redirect(target.pathname + target.search);
  }

  return { token, role: (role ?? 'user') as UserRole };
}

export async function requireRole(required: UserRole, nextUrl?: string) {
  const session = await requireAuthenticatedUser(nextUrl);
  if (!isRoleAtLeast(session.role, required)) {
    redirect('/unauthorized');
  }
  return session;
}
