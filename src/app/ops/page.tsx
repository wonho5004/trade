import Link from 'next/link';
import type { Route } from 'next';

import { requireRole } from '@/lib/auth/roles';
import { listAllProfiles } from '@/lib/users/profile';
import { UserRoleManager } from '@/components/ops/UserRoleManager';
import { PermissionMatrixCard } from '@/components/ops/PermissionMatrixCard';
import { getUserLogsMap } from '@/lib/logs/audit';
import SessionInfoCard from '@/components/ops/SessionInfoCard';
import { StrategyManagerPanel } from '@/components/trading/automation/StrategyManagerPanel';

export default async function OpsPage() {
  await requireRole('sys_admin', '/ops');
  const profiles = await listAllProfiles();
  const logsByUserId = await getUserLogsMap(profiles.map((profile) => profile.id));

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold">시스템 관리자 패널</h1>
            <p className="mt-2 text-sm text-amber-200/70">
              모든 페이지 접근과 권한 부여, 시스템 설정을 제어할 수 있는 최상위 콘솔입니다.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-xs">
            <NavLink href="/dashboard" label="대시보드" />
            <NavLink href="/trading" label="거래" />
            <NavLink href="/analysis" label="분석" />
            <NavLink href="/admin/users" label="사용자 목록" />
            <NavLink href="/admin" label="관리자 패널" />
          </nav>
        </div>
      </div>
      <SessionInfoCard />
      <section className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <UserRoleManager profiles={profiles} logsByUserId={logsByUserId} />
        </article>
        <div className="space-y-6">
          <PermissionMatrixCard />
          <StrategyManagerPanel />
        </div>
      </section>
    </div>
  );
}

function NavLink({ href, label }: { href: Route; label: string }) {
  return (
    <Link
      href={href}
      className="rounded border border-amber-500/40 px-3 py-1 text-xs font-semibold text-amber-200 transition hover:border-emerald-500 hover:text-emerald-300"
    >
      {label}
    </Link>
  );
}
