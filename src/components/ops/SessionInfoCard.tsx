import { createSupabaseServerClient, readAuthCookies } from '@/lib/supabase/server';

export default async function SessionInfoCard() {
  const { token } = await readAuthCookies();
  const supabase = createSupabaseServerClient('service');
  let user: any = null;
  let role: string = 'guest';
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    user = data?.user ?? null;
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      role = (prof?.role ?? 'guest') as string;
    }
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-100">접속자 정보</h3>
      </header>
      {user ? (
        <ul className="grid gap-1 md:grid-cols-2">
          <li><span className="text-zinc-500">User ID:</span> {user.id}</li>
          <li><span className="text-zinc-500">Email:</span> {user.email ?? '-'}</li>
          <li><span className="text-zinc-500">Role:</span> {role}</li>
          <li><span className="text-zinc-500">Last Sign In:</span> {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString('ko-KR') : '-'}</li>
        </ul>
      ) : (
        <p className="text-zinc-400">세션이 없습니다.</p>
      )}
    </section>
  );
}

