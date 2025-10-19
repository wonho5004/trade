'use client';

import type { ReactNode } from 'react';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';

const links: Array<{ href: Route; label: string }> = [
  { href: '/login', label: '로그인' },
  { href: '/register', label: '회원가입' }
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 py-10 text-zinc-100">
      <header className="mb-6 flex flex-col items-center gap-2">
        <Link href={'/' as Route} className="text-2xl font-semibold text-emerald-400">
          Binance Trader
        </Link>
        <nav className="flex gap-3 text-xs uppercase text-zinc-500">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded px-3 py-1 transition ${
                pathname === link.href ? 'bg-emerald-500/10 text-emerald-300' : 'hover:text-emerald-300'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
