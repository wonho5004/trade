import Link from 'next/link';

const navItems = [
  { href: '/dashboard', label: '대시보드' },
  { href: '/trading', label: '거래' },
  { href: '/analysis', label: '분석' }
];

export function AppHeader() {
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
      </nav>
    </header>
  );
}
