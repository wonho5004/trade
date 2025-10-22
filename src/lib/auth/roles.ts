import { redirect } from 'next/navigation';
import type { Route } from 'next';

import { readAuthCookies } from '@/lib/supabase/server';

export type UserRole = 'guest' | 'member' | 'admin' | 'sys_admin';

const ROLE_WEIGHT: Record<UserRole, number> = {
  guest: 1,
  member: 2,
  admin: 3,
  sys_admin: 4
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
  const { token, role } = await readAuthCookies();

  if (!token) {
    const target = new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000');
    if (nextUrl) {
      target.searchParams.set('next', nextUrl);
    }
    redirect((target.pathname + target.search) as Route);
  }

  return { token, role: (role ?? 'guest') as UserRole };
}

export async function requireRole(required: UserRole, nextUrl?: string) {
  const session = await requireAuthenticatedUser(nextUrl);
  if (!isRoleAtLeast(session.role, required)) {
    redirect('/unauthorized' as Route);
  }
  return session;
}
