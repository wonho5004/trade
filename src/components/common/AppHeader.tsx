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
    <header className="flex items-center justify-between whitespace-nowrap border-b border-solid border-border-dark bg-panel-dark px-6 py-3 flex-shrink-0">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-4">
          <div className="size-6 text-primary">
            <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path d="M39.5563 34.1455V13.8546C39.5563 15.708 36.8773 17.3437 32.7927 18.3189C30.2914 18.916 27.263 19.2655 24 19.2655C20.737 19.2655 17.7086 18.916 15.2073 18.3189C11.1227 17.3437 8.44365 15.708 8.44365 13.8546V34.1455C8.44365 35.9988 11.1227 37.6346 15.2073 38.6098C17.7086 39.2069 20.737 39.5564 24 39.5564C27.263 39.5564 30.2914 39.2069 32.7927 38.6098C36.8773 37.6346 39.5563 35.9988 39.5563 34.1455Z" fill="currentColor"></path>
              <path clipRule="evenodd" d="M10.4485 13.8519C10.4749 13.9271 10.6203 14.246 11.379 14.7361C12.298 15.3298 13.7492 15.9145 15.6717 16.3735C18.0007 16.9296 20.8712 17.2655 24 17.2655C27.1288 17.2655 29.9993 16.9296 32.3283 16.3735C34.2508 15.9145 35.702 15.3298 36.621 14.7361C37.3796 14.246 37.5251 13.9271 37.5515 13.8519C37.5287 13.7876 37.4333 13.5973 37.0635 13.2931C36.5266 12.8516 35.6288 12.3647 34.343 11.9175C31.79 11.0295 28.1333 10.4437 24 10.4437C19.8667 10.4437 16.2099 11.0295 13.657 11.9175C12.3712 12.3647 11.4734 12.8516 10.9365 13.2931C10.5667 13.5973 10.4713 13.7876 10.4485 13.8519ZM37.5563 18.7877C36.3176 19.3925 34.8502 19.8839 33.2571 20.2642C30.5836 20.9025 27.3973 21.2655 24 21.2655C20.6027 21.2655 17.4164 20.9025 14.7429 20.2642C13.1498 19.8839 11.6824 19.3925 10.4436 18.7877V34.1275C10.4515 34.1545 10.5427 34.4867 11.379 35.027C12.298 35.6207 13.7492 36.2054 15.6717 36.6644C18.0007 37.2205 20.8712 37.5564 24 37.5564C27.1288 37.5564 29.9993 37.2205 32.3283 36.6644C34.2508 36.2054 35.702 35.6207 36.621 35.027C37.4573 34.4867 37.5485 34.1546 37.5563 34.1275V18.7877ZM41.5563 13.8546V34.1455C41.5563 36.1078 40.158 37.5042 38.7915 38.3869C37.3498 39.3182 35.4192 40.0389 33.2571 40.5551C30.5836 41.1934 27.3973 41.5564 24 41.5564C20.6027 41.5564 17.4164 41.1934 14.7429 40.5551C12.5808 40.0389 10.6502 39.3182 9.20848 38.3869C7.84205 37.5042 6.44365 36.1078 6.44365 34.1455L6.44365 13.8546C6.44365 12.2684 7.37223 11.0454 8.39581 10.2036C9.43325 9.3505 10.8137 8.67141 12.343 8.13948C15.4203 7.06909 19.5418 6.44366 24 6.44366C28.4582 6.44366 32.5797 7.06909 35.657 8.13948C37.1863 8.67141 38.5667 9.3505 39.6042 10.2036C40.6278 11.0454 41.5563 12.2684 41.5563 13.8546Z" fill="currentColor" fillRule="evenodd"></path>
            </svg>
          </div>
          <h2 className="text-lg font-bold leading-tight tracking-[-0.015em] text-text-main-dark">자동매매봇</h2>
        </div>
        <nav className="flex items-center gap-6">
          {navItems.map((item, index) => (
            <Link
              key={item.href}
              href={item.href}
              className={index === 0 ? "text-sm font-bold leading-normal text-text-main-dark" : "text-sm font-medium leading-normal text-text-secondary-dark hover:text-text-main-dark"}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex flex-1 justify-end gap-4">
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <button className="flex h-10 w-10 cursor-pointer items-center justify-center overflow-hidden rounded-lg bg-background-dark text-text-main-dark hover:bg-background-dark/70 transition">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-10 bg-zinc-700"></div>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded border border-border-dark px-3 py-2 text-xs font-medium text-text-secondary-dark transition hover:border-negative hover:text-negative"
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <Link
              href={'/login' as Route}
              className="rounded bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-opacity-90"
            >
              로그인
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
