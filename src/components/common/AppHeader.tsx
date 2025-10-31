import Link from 'next/link';
import type { Route } from 'next';

import { logoutAction } from '@/app/(auth)/actions';
import type { UserRole } from '@/lib/auth/roles';
import { isRoleAtLeast } from '@/lib/auth/roles';
import { readAuthCookies } from '@/lib/supabase/server';
import { getAuthenticatedProfile } from '@/lib/users/profile';

const baseNavItems: Array<{ href: Route; label: string }> = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/trading', label: '거래' },
  { href: '/trading/automation', label: '자동매매설정' },
  { href: '/trading/monitoring', label: '모니터링' }
];

const ROLE_LABEL: Record<UserRole, string> = {
  guest: 'GUEST',
  member: 'MEMBER',
  admin: '관리자',
  sys_admin: '시스템관리자'
};

export async function AppHeader() {
  const { token, role: cookieRole } = await readAuthCookies();
  const profileDetails = token ? await getAuthenticatedProfile() : null;

  const normalizedRole = (profileDetails?.profile.role ?? cookieRole ?? 'guest') as UserRole;
  const nickname = profileDetails?.displayNickname ?? profileDetails?.email ?? '게스트';

  const isAuthenticated = Boolean(token);
  const navItems = [...baseNavItems];

  if (isAuthenticated) {
    navItems.push({ href: '/mypage', label: '마이페이지' } as { href: Route; label: string });
  }
  if (isRoleAtLeast(normalizedRole, 'admin')) {
    navItems.push({ href: '/admin', label: '관리자' } as { href: Route; label: string });
  }
  if (isRoleAtLeast(normalizedRole, 'sys_admin')) {
    navItems.push({ href: '/ops', label: '시스템' } as { href: Route; label: string });
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href={'/' as Route} className="text-lg font-semibold text-zinc-100">
          Binance Trader
        </Link>
        <nav className="flex items-center gap-4 text-sm text-zinc-400">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-zinc-100">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        {isAuthenticated ? (
          <>
            <div className="flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-zinc-100">{nickname}</span>
              <span className="text-[11px] text-emerald-400">{ROLE_LABEL[normalizedRole]}</span>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-300"
              >
                로그아웃
              </button>
            </form>
          </>
        ) : (
          <Link
            href={'/login' as Route}
            className="rounded border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
