"use client";

import { useEffect, useState } from 'react';

type StrategyRecord = {
  id: string;
  name: string;
  payload: unknown;
  createdAt: string;
};

type StrategiesResponse = {
  limit: number;
  count: number;
  strategy: StrategyRecord | null;
  backups?: StrategyRecord[];
};

export function StrategyManagerPanel() {
  const [data, setData] = useState<StrategiesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/strategies', { cache: 'no-store' });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error || json?.message || '전략 조회 실패');
      setData(json as StrategiesResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleDelete = async () => {
    if (!confirm('현재 전략을 삭제하시겠습니까?')) return;
    try {
      const res = await fetch('/api/strategies', { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || '삭제 실패');
      await refresh();
      alert('전략이 삭제되었습니다.');
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  };

  const exportJson = (record: StrategyRecord | null) => {
    try {
      const blob = new Blob([JSON.stringify(record ?? {}, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const name = record?.name ? record.name.replace(/[^a-z0-9_-]/gi, '_') : 'strategy';
      a.download = `${name}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-zinc-100">전략 관리</h3>
        <div className="flex items-center gap-2">
          <button type="button" onClick={refresh} disabled={loading} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 disabled:opacity-50">새로고침</button>
          <button type="button" onClick={handleDelete} disabled={loading || !data?.strategy} className="rounded border border-rose-600 px-2 py-1 text-xs text-rose-300 disabled:opacity-50">삭제</button>
        </div>
      </div>
      {loading ? <div className="text-zinc-400">불러오는 중…</div> : null}
      {error ? <div className="text-rose-400">{error}</div> : null}
      {!loading && !error ? (
        <div className="space-y-3">
          <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="mb-1 text-zinc-400">현재 전략</div>
            {data?.strategy ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-zinc-100">{data.strategy.name}</div>
                  <div className="text-[11px] text-zinc-500">생성일 {new Date(data.strategy.createdAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300" onClick={() => exportJson(data.strategy)}>내보내기</button>
                </div>
              </div>
            ) : (
              <div className="text-zinc-500">— 없음</div>
            )}
          </div>
          <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3">
            <div className="mb-1 text-zinc-400">백업</div>
            {Array.isArray(data?.backups) && data!.backups!.length > 0 ? (
              <ul className="space-y-1">
                {data!.backups!.slice(0, 10).map((b) => (
                  <li key={b.id} className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-950/40 px-2 py-1">
                    <div>
                      <div className="font-medium text-zinc-100">{b.name}</div>
                      <div className="text-[11px] text-zinc-500">{new Date(b.createdAt).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300" onClick={() => exportJson(b)}>내보내기</button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-zinc-500">— 없음</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

