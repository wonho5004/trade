import { listAllProfiles } from '@/lib/users/profile';

export default async function AdminUsersPage() {
  const profiles = await listAllProfiles();

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 px-6 py-10 text-zinc-100">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">사용자 목록</h1>
        <p className="text-sm text-zinc-400">관리자는 사용자 정보를 열람할 수 있으며, 권한 변경은 시스템 관리자에게 요청해야 합니다.</p>
      </header>
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
        <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-200">
          <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">닉네임</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">권한</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950">
            {profiles.map((profile) => (
              <tr key={profile.id}>
                <td className="px-4 py-3 font-medium text-zinc-100">{profile.displayName ?? '미등록'}</td>
                <td className="px-4 py-3 text-zinc-300">{profile.nickname ?? '미등록'}</td>
                <td className="px-4 py-3 text-zinc-300">{profile.email || '미등록'}</td>
                <td className="px-4 py-3 text-zinc-300">{profile.phone ?? '미등록'}</td>
                <td className="px-4 py-3 text-zinc-300">{profile.role.toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
