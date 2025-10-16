import Link from 'next/link';

import { requireAuthenticatedUser } from '@/lib/auth/roles';
import { getAuthenticatedProfile } from '@/lib/users/profile';
import { ProfileSettingsForm } from '@/components/mypage/ProfileSettingsForm';
import { PasswordChangeForm } from '@/components/mypage/PasswordChangeForm';

export default async function MyPage() {
  await requireAuthenticatedUser('/mypage');
  const profileDetails = await getAuthenticatedProfile();

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 px-6 py-10 text-zinc-100">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">마이페이지</h1>
          <p className="text-sm text-zinc-400">회원 정보와 보안 설정을 관리합니다.</p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:border-emerald-500 hover:text-emerald-300"
        >
          대시보드로 돌아가기
        </Link>
      </header>
      <section className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <ProfileSettingsForm details={profileDetails} />
        </article>
        <article className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <PasswordChangeForm />
        </article>
      </section>
    </div>
  );
}
