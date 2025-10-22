'use client';

import { useEffect, useMemo, useState } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { defaultOpsActionState, type OpsActionState } from '@/app/ops/form-state';
import { assignUserRoleAction, bootstrapAdminAccountAction, deleteUserAction } from '@/app/ops/actions';
import type { UserSummary } from '@/lib/users/profile';
import type { AuditLogEntry } from '@/lib/logs/audit';

const ROLE_LABEL: Record<string, string> = {
  guest: 'GUEST',
  member: 'MEMBER',
  admin: '관리자',
  sys_admin: '시스템관리자'
};

const ROLE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'guest', label: 'GUEST' },
  { value: 'member', label: 'MEMBER' },
  { value: 'admin', label: '관리자' },
  { value: 'sys_admin', label: '시스템관리자' }
];

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded border border-emerald-500 px-3 py-1 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
    >
      {pending ? '처리 중…' : label}
    </button>
  );
}

function ActionMessage({ state }: { state: OpsActionState }) {
  if (state.status === 'idle' || !state.message) {
    return null;
  }
  const styles =
    state.status === 'success'
      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
      : 'border-rose-500/60 bg-rose-500/10 text-rose-200';
  return <p className={`rounded border px-3 py-2 text-sm ${styles}`}>{state.message}</p>;
}

export function UserRoleManager({
  profiles,
  logsByUserId
}: {
  profiles: UserSummary[];
  logsByUserId: Record<string, AuditLogEntry[]>;
}) {
  const [roleState, roleAction] = useActionState(assignUserRoleAction, defaultOpsActionState);
  const [bootstrapState, bootstrapAction] = useActionState(bootstrapAdminAccountAction, defaultOpsActionState);
  const [deleteState, deleteAction] = useActionState(deleteUserAction, defaultOpsActionState);

  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(profiles[0]?.id ?? null);

  const filteredProfiles = useMemo(() => {
    if (!search.trim()) {
      return profiles;
    }
    const term = search.trim().toLowerCase();
    return profiles.filter((profile) => {
      const candidates = [profile.email, profile.displayName, profile.nickname];
      return candidates.some((value) => value?.toLowerCase().includes(term));
    });
  }, [profiles, search]);

  useEffect(() => {
    if (filteredProfiles.length === 0) {
      if (selectedUserId !== null) {
        setSelectedUserId(null);
      }
      return;
    }
    if (!selectedUserId || !filteredProfiles.some((profile) => profile.id === selectedUserId)) {
      setSelectedUserId(filteredProfiles[0].id);
    }
  }, [filteredProfiles, selectedUserId]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId) {
      return null;
    }
    return profiles.find((profile) => profile.id === selectedUserId) ?? null;
  }, [profiles, selectedUserId]);

  const selectedLogs = selectedUserId ? logsByUserId[selectedUserId] ?? [] : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">사용자 권한 관리</h2>
            <p className="text-sm text-zinc-400">
              시스템 관리자가 등급을 부여하거나 조정합니다. 권한 변경 시 즉시 적용됩니다.
            </p>
          </div>
          <form action={bootstrapAction} className="flex items-center gap-2">
            <SaveButton label="admin 계정 생성" />
          </form>
        </div>
        <ActionMessage state={bootstrapState} />
      </header>

      <div className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <label className="flex w-full flex-col text-sm text-zinc-300">
          <span className="text-xs uppercase text-zinc-500">사용자 검색</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="이름, 닉네임, 이메일로 검색"
            className="mt-1 rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
          />
        </label>
        <div className="hidden text-xs text-zinc-500 md:block">총 {filteredProfiles.length}명</div>
      </div>

      {filteredProfiles.length === 0 ? (
        <div className="rounded border border-zinc-800 bg-zinc-900 p-6 text-sm text-zinc-400">
          검색 결과가 없습니다. 다른 키워드로 다시 시도해 주세요.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm text-zinc-200">
            <thead className="bg-zinc-900 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">닉네임</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">연락처</th>
                <th className="px-4 py-3">권한</th>
                <th className="px-4 py-3" aria-label="actions" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800 bg-zinc-950">
              {filteredProfiles.map((profile) => {
                const isSelected = profile.id === selectedUserId;
                return (
                  <tr
                    key={profile.id}
                    onClick={() => setSelectedUserId(profile.id)}
                    className={`cursor-pointer transition hover:bg-zinc-900/60 ${
                      isSelected ? 'bg-zinc-900/80' : ''
                    }`}
                  >
                    <td className="px-4 py-3 font-medium text-zinc-100">
                      {profile.displayName ?? '미등록'}
                    </td>
                    <td className="px-4 py-3 text-zinc-300">{profile.nickname ?? '미등록'}</td>
                    <td className="px-4 py-3 text-zinc-300">{profile.email || '미등록'}</td>
                    <td className="px-4 py-3 text-zinc-300">{profile.phone ?? '미등록'}</td>
                    <td className="px-4 py-3 text-zinc-300">
                      <form action={roleAction} className="flex items-center gap-3">
                        <input type="hidden" name="userId" value={profile.id} />
                        <select
                          name="role"
                          defaultValue={profile.role}
                          className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-emerald-500 focus:outline-none"
                        >
                          {ROLE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                        <SaveButton label="변경" />
                      </form>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-zinc-500">
                      최근 업데이트:{' '}
                      {profile.updatedAt ? new Date(profile.updatedAt).toLocaleString('ko-KR') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <ActionMessage state={roleState} />

      <UserActivityPanel
        selectedUser={selectedUser}
        logs={selectedLogs}
        deleteAction={deleteAction}
        deleteState={deleteState}
        isDeleteDisabled={!selectedUser}
      />
    </div>
  );
}

function UserActivityPanel({
  selectedUser,
  logs,
  deleteAction,
  deleteState,
  isDeleteDisabled
}: {
  selectedUser: UserSummary | null;
  logs: AuditLogEntry[];
  deleteAction: (formData: FormData) => void;
  deleteState: OpsActionState;
  isDeleteDisabled: boolean;
}) {
  return (
    <section className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">선택된 사용자</h3>
          {selectedUser ? (
            <ul className="mt-3 space-y-1 text-sm text-zinc-300">
              <li>
                <span className="text-zinc-500">이름:</span> {selectedUser.displayName ?? '미등록'}
              </li>
              <li>
                <span className="text-zinc-500">닉네임:</span> {selectedUser.nickname ?? '미등록'}
              </li>
              <li>
                <span className="text-zinc-500">이메일:</span> {selectedUser.email || '미등록'}
              </li>
              <li>
                <span className="text-zinc-500">연락처:</span> {selectedUser.phone ?? '미등록'}
              </li>
              <li>
                <span className="text-zinc-500">권한:</span> {ROLE_LABEL[selectedUser.role]}
              </li>
              <li>
                <span className="text-zinc-500">최근 업데이트:</span>{' '}
                {selectedUser.updatedAt ? new Date(selectedUser.updatedAt).toLocaleString('ko-KR') : '미등록'}
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-zinc-400">사용자를 선택하면 상세 정보와 로그 요약이 표시됩니다.</p>
          )}
        </div>
        <form action={deleteAction} className="flex flex-col items-end gap-2">
          <input type="hidden" name="userId" value={selectedUser?.id ?? ''} />
          <button
            type="submit"
            disabled={isDeleteDisabled}
            className="rounded border border-rose-500 px-3 py-1 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:text-zinc-500"
          >
            선택 사용자 삭제
          </button>
        </form>
      </div>
      <div className="space-y-2 rounded border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-300">
        <h4 className="text-sm font-semibold text-zinc-100">활동 로그</h4>
        {selectedUser ? (
          logs.length > 0 ? (
            <ul className="space-y-2 text-xs text-zinc-400">
              {logs.map((log) => (
                <li key={log.id} className="rounded border border-zinc-800 bg-zinc-950 p-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <span>{new Date(log.timestamp).toLocaleString('ko-KR')}</span>
                    <span>{log.actorEmail ?? log.actorId ?? ''}</span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-200">{log.action}</p>
                  {log.detail && <p className="text-xs text-zinc-400">{log.detail}</p>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-zinc-500">기록된 활동이 없습니다.</p>
          )
        ) : (
          <p className="text-xs text-zinc-500">사용자를 선택해 로그 요약을 확인하세요.</p>
        )}
      </div>
      <ActionMessage state={deleteState} />
    </section>
  );
}
