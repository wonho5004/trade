'use client';

import { useFormState, useFormStatus } from 'react-dom';

import { myPageDefaultState } from '@/app/mypage/form-state';
import { changePasswordAction } from '@/app/mypage/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {pending ? '변경 중…' : '비밀번호 변경'}
    </button>
  );
}

export function PasswordChangeForm() {
  const [state, formAction] = useFormState(changePasswordAction, myPageDefaultState);

  return (
    <form action={formAction} className="space-y-6">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">비밀번호 변경</h2>
        <p className="mt-1 text-sm text-zinc-400">현재 비밀번호를 확인한 뒤 새 비밀번호를 설정합니다.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-300 md:col-span-2">
          <span>현재 비밀번호</span>
          <input
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="현재 비밀번호"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>새 비밀번호</span>
          <input
            name="newPassword"
            type="password"
            required
            autoComplete="new-password"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="8자 이상"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>새 비밀번호 확인</span>
          <input
            name="confirmPassword"
            type="password"
            required
            autoComplete="new-password"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="새 비밀번호 확인"
          />
        </label>
      </div>
      {state.status !== 'idle' && state.message && (
        <p
          className={`rounded border px-3 py-2 text-sm ${
            state.status === 'success'
              ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/60 bg-rose-500/10 text-rose-200'
          }`}
        >
          {state.message}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
