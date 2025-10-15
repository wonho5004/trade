import Link from 'next/link';

import { logoutAction } from '@/app/(auth)/actions';
import { isRoleAtLeast } from '@/lib/auth/roles';
import { readAuthCookies } from '@/lib/supabase/server';

const baseNavItems = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/trading', label: '거래' },
  { href: '/analysis', label: '분석' }
];

const navItems = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/trading', label: '거래' },
  { href: '/analysis', label: '분석' }
];

export async function AppHeader() {
  const { token, role } = readAuthCookies();
  const isAuthenticated = Boolean(token);
  const navItems = [...baseNavItems];

  if (isRoleAtLeast(role, 'admin')) {
    navItems.push({ href: '/admin', label: '관리자' });
  }
  if (isRoleAtLeast(role, 'sys_admin')) {
    navItems.push({ href: '/ops', label: '시스템' });
  }

  return (
    <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
      <Link href="/" className="text-lg font-semibold text-zinc-100">
        Binance Trader
      </Link>
      <nav className="flex items-center gap-6 text-sm text-zinc-400">
        {navItems.map((item) => (
          <Link key={item.href} href={item.href} className="transition hover:text-zinc-100">
            {item.label}
          </Link>
        ))}
        {isAuthenticated ? (
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded border border-zinc-700 px-3 py-1 text-xs font-medium text-zinc-300 transition hover:border-emerald-500 hover:text-emerald-300"
            >
              로그아웃
            </button>
          </form>
        ) : (
          <Link
            href="/login"
            className="rounded border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10"
          >
            로그인
          </Link>
        )}
      </nav>
    </header>
  );
}
