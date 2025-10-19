import Link from 'next/link';
import type { Route } from 'next';

import { requireRole } from '@/lib/auth/roles';

export default async function AdminPage() {
  const session = await requireRole('admin', '/admin');

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
        <h1 className="text-2xl font-semibold">관리자 콘솔</h1>
        <p className="mt-2 text-sm text-zinc-400">
          관리자 권한으로 접근한 계정입니다. 현재 역할:{' '}
          <span className="font-medium text-emerald-400">{session.role}</span>
        </p>
      </div>
      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href={'/admin/users' as Route}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition hover:border-emerald-500"
        >
          <h2 className="text-lg font-semibold text-zinc-100">사용자 관리</h2>
          <p className="mt-2 text-sm text-zinc-400">Supabase 프로필과 권한을 확인·조정합니다.</p>
        </Link>
        <Link
          href={'/admin/audit' as Route}
          className="rounded-lg border border-zinc-800 bg-zinc-900 p-5 transition hover:border-emerald-500"
        >
          <h2 className="text-lg font-semibold text-zinc-100">감사 로그</h2>
          <p className="mt-2 text-sm text-zinc-400">주요 행위 로그를 조회하고 이력 데이터를 분석합니다.</p>
        </Link>
      </section>
    </div>
  );
}
