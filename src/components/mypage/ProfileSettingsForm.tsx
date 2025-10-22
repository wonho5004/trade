'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { myPageDefaultState } from '@/app/mypage/form-state';
import { updateProfileAction } from '@/app/mypage/actions';
import type { ProfileDetails } from '@/lib/users/profile';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {pending ? '저장 중…' : '정보 저장'}
    </button>
  );
}

const ROLE_LABEL: Record<string, string> = {
  guest: 'GUEST',
  member: 'MEMBER',
  admin: '관리자',
  sys_admin: '시스템관리자'
};

export function ProfileSettingsForm({ details }: { details: ProfileDetails | null }) {
  const [state, formAction] = useActionState(updateProfileAction, myPageDefaultState);
  const profile = details?.profile ?? null;
  const roleLabel = profile ? ROLE_LABEL[profile.role] ?? profile.role.toUpperCase() : ROLE_LABEL.guest;
  const emailDisplay = details?.email ?? '등록된 이메일이 없습니다.';
  const fallbackFullName = details?.displayFullName ?? '';
  const fallbackNickname = details?.displayNickname ?? '';
  const nicknameRegistered = details?.hasNickname ?? false;
  const phoneValue = details?.phone ?? '';
  const phoneRegistered = Boolean(phoneValue);

  return (
    <form
      action={formAction}
      className="space-y-6"
      autoComplete="off"
      data-lpignore="true"
      data-1p-ignore="true"
      data-lastpass-icon="false"
    >
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">기본 정보</h2>
        <p className="mt-1 text-sm text-zinc-400">
          이름, 연락처, API 키 등 개인정보를 관리합니다. 현재 권한: <span className="font-medium">{roleLabel}</span>
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>이름</span>
          <input
            name="fullName"
            type="text"
            defaultValue={fallbackFullName ?? ''}
            autoComplete="name"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="홍길동"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>닉네임</span>
          <input
            name="nickname"
            type="text"
            defaultValue={fallbackNickname ?? ''}
            autoComplete="nickname"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder={fallbackNickname || '닉네임을 입력해 주세요'}
          />
          {!nicknameRegistered && (
            <p className="text-xs text-zinc-500">
              미등록 · 기본 닉네임 제안: <span className="font-semibold text-zinc-300">{fallbackNickname || '직접 입력'}</span>
            </p>
          )}
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>휴대전화</span>
          <input
            name="phone"
            type="tel"
            defaultValue={phoneValue}
            autoComplete="tel"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="010-0000-0000"
          />
          {!phoneRegistered && <p className="text-xs text-zinc-500">미등록</p>}
        </label>
        <div className="flex flex-col gap-1 text-sm text-zinc-300 md:col-span-2">
          <span>이메일</span>
          <div className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">{emailDisplay}</div>
          <p className="text-xs text-zinc-500">이메일은 로그인 아이디로 사용되며 변경할 수 없습니다.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Binance API Key</span>
          <input
            name="binanceApiKey"
            type="text"
            defaultValue={details?.binanceApiKey ?? ''}
            autoComplete="off"
            data-lpignore="true"
            data-1p-ignore="true"
            data-lastpass-icon="false"
            inputMode="text"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="API Key"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-zinc-300">
          <span>Binance Secret Key</span>
          <input
            name="binanceApiSecret"
            type="password"
            defaultValue={details?.binanceApiSecret ?? ''}
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            data-lastpass-icon="false"
            className="rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            placeholder="Secret Key"
          />
        </label>
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-sm font-medium text-zinc-200">비밀번호 확인</p>
        <p className="mt-1 text-xs text-zinc-500">
          개인정보를 저장하려면 현재 비밀번호를 다시 입력해 주세요.
        </p>
        <input
          name="currentPassword"
          type="password"
          required
          className="mt-3 w-full rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          placeholder="현재 비밀번호"
        />
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
