'use client';

import { useFormState, useFormStatus } from 'react-dom';
import Link from 'next/link';

import { registerAction } from '@/app/(auth)/actions';

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

export function RegisterForm() {
  const [state, dispatch] = useFormState(registerAction, initialState);

  return (
    <form action={dispatch} className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900 p-6 shadow-lg">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-semibold text-zinc-100">회원가입</h1>
        <p className="text-xs text-zinc-400">필수 정보를 입력하고 계정을 생성하세요.</p>
      </div>
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
          <span>표시 이름 (선택)</span>
          <input
            name="displayName"
            type="text"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="홍길동"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>비밀번호</span>
          <input
            name="password"
            type="password"
            minLength={8}
            required
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="8자 이상"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>비밀번호 확인</span>
          <input
            name="confirmPassword"
            type="password"
            minLength={8}
            required
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="비밀번호 재입력"
          />
        </label>
        {state.status === 'error' && state.message && (
          <p className="rounded border border-rose-500/60 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{state.message}</p>
        )}
        {state.status === 'success' && state.message && (
          <p className="rounded border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
            {state.message}
          </p>
        )}
      </div>
      <SubmitButton label="회원가입" />
      <div className="text-center text-xs text-zinc-400">
        이미 계정이 있다면{' '}
        <Link href="/login" className="font-medium text-emerald-300 hover:underline">
          로그인
        </Link>
        해 주세요.
      </div>
    </form>
  );
}
