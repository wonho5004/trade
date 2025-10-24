"use client";

import { useEffect, useMemo, useState } from 'react';

import { listLocalStrategyNames, upsertLocalStrategyName, removeLocalStrategyName, renameLocalStrategyName, isNameTaken } from '@/lib/trading/strategies/local';

export function LogicNameManagerModal({ open, current, onApply, onClose }: { open: boolean; current: string; onApply: (name: string) => void; onClose: () => void }) {
  const [names, setNames] = useState<string[]>([]);
  const [input, setInput] = useState<string>(current ?? '');
  const [search, setSearch] = useState<string>('');
  const [status, setStatus] = useState<{ kind: 'ok' | 'warn' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    setNames(listLocalStrategyNames());
    setInput(current ?? '');
    setStatus(null);
    setSearch('');
  }, [open, current]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return names;
    return names.filter((n) => n.toLowerCase().includes(q));
  }, [names, search]);

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,720px)] rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
        <header className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">로직명 관리</h3>
          <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300">닫기</button>
        </header>

        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_auto_auto]">
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <span className="whitespace-nowrap text-zinc-400">로직명</span>
            <input value={input} onChange={(e) => { setInput(e.target.value); setStatus(null); }} className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" />
          </label>
          <button
            type="button"
            onClick={() => {
              const name = input.trim();
              if (!name) { setStatus({ kind: 'error', message: '이름을 입력하세요.' }); return; }
              const taken = isNameTaken(name);
              setStatus({ kind: taken ? 'error' : 'ok', message: taken ? '이미 사용 중입니다.' : '사용 가능합니다.' });
            }}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300"
          >중복확인</button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const name = input.trim();
                if (!name) { setStatus({ kind: 'error', message: '이름을 입력하세요.' }); return; }
                upsertLocalStrategyName(name);
                setNames(listLocalStrategyNames());
                setStatus({ kind: 'ok', message: '저장되었습니다.' });
              }}
              className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-200"
            >저장</button>
            <button
              type="button"
              onClick={() => { const name = input.trim(); if (!name) return; onApply(name); onClose(); }}
              className="rounded border border-sky-600 px-2 py-1 text-xs text-sky-200"
            >적용</button>
          </div>
        </div>

        {status ? (
          <p className={`mb-2 rounded border px-2 py-1 text-[12px] ${status.kind==='ok' ? 'border-emerald-600/60 text-emerald-200' : status.kind==='warn' ? 'border-amber-600/60 text-amber-200' : 'border-rose-600/60 text-rose-200'}`}>{status.message}</p>
        ) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-200">저장된 이름</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="검색" className="w-40 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100" />
          </div>
          <div className="max-h-56 overflow-auto rounded border border-zinc-800">
            <table className="w-full table-fixed text-left text-[12px] text-zinc-300">
              <colgroup>
                <col />
                <col className="w-44" />
              </colgroup>
              <thead className="sticky top-0 bg-zinc-950 text-zinc-400">
                <tr><th className="px-2 py-1">이름</th><th className="px-2 py-1">작업</th></tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td className="px-2 py-2 text-zinc-500" colSpan={2}>저장된 이름이 없습니다.</td></tr>
                ) : filtered.map((n) => (
                  <tr key={n} className="border-t border-zinc-800">
                    <td className="px-2 py-1">{n}</td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <button className="rounded border border-sky-600 px-2 py-0.5 text-[11px] text-sky-200" onClick={() => { onApply(n); onClose(); }}>적용</button>
                        <button className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300" onClick={() => { const next = prompt('새 이름', n) || ''; const t = next.trim(); if (!t) return; renameLocalStrategyName(n, t); setNames(listLocalStrategyNames()); }}>이름변경</button>
                        <button className="rounded border border-rose-600 px-2 py-0.5 text-[11px] text-rose-300" onClick={() => { removeLocalStrategyName(n); setNames(listLocalStrategyNames()); }}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

