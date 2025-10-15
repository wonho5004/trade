'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { loginAction } from '@/app/(auth)/actions';

const initialState = { status: 'idle' as const, message: '' };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-600 disabled:text-zinc-300"
    >
      {pending ? '처리 중…' : label}
    </button>
  );
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('next') ?? '/dashboard';
  const [state, dispatch] = useFormState(loginAction, initialState);

  return (
    <form action={dispatch} className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">로그인</h1>
        <p className="text-xs text-zinc-400">등록된 이메일과 비밀번호를 입력해 주세요.</p>
      </div>
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <div className="space-y-4">
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>이메일</span>
          <input
            name="email"
            type="email"
            required
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>비밀번호</span>
          <input
            name="password"
            type="password"
            required
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="********"
          />
        </label>
        {state.status === 'error' && state.message && (
          <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{state.message}</p>
        )}
      </div>
      <SubmitButton label="로그인" />
      <div className="text-center text-xs text-zinc-400">
        계정이 없다면{' '}
        <Link href="/register" className="font-medium text-emerald-300 hover:underline">
          회원가입
        </Link>
        을 진행해 주세요.
      </div>
    </form>
  );
}
