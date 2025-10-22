'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type ToastAction = {
  label: string;
  onClick: () => void;
};

type Toast = {
  id: string;
  title: string;
  description?: string;
  type?: 'success' | 'error' | 'info';
  durationMs?: number;
  actions?: ToastAction[];
};

type ToastContextValue = {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const next: Toast = {
        id,
        title: toast.title,
        description: toast.description,
        type: toast.type ?? 'info',
        durationMs: toast.durationMs ?? 2500,
        actions: toast.actions
      };
      // If description contains a requestId, add a quick copy action for troubleshooting
      try {
        const m = (next.description || '').match(/요청ID:\s*([A-Za-z0-9-]+)/);
        if (m && m[1]) {
          const rid = m[1];
          const hasCopy = Array.isArray(next.actions) && next.actions.some((a) => a.label.includes('복사'));
          if (!hasCopy) {
            next.actions = [...(next.actions ?? []), { label: 'ID 복사', onClick: () => void navigator.clipboard?.writeText(rid) }];
          }
        }
      } catch {}
      setToasts((prev) => [...prev, next]);
      if (next.durationMs && next.durationMs > 0) {
        setTimeout(() => dismiss(id), next.durationMs);
      }
    },
    [dismiss]
  );

  const value = useMemo(() => ({ toasts, show, dismiss }), [toasts, show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[1000] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-md border px-3 py-2 shadow-md ${
              t.type === 'success'
                ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-200'
                : t.type === 'error'
                ? 'border-rose-500/60 bg-rose-500/10 text-rose-200'
                : 'border-zinc-700 bg-zinc-900/90 text-zinc-200'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{t.title}</p>
                {t.description ? <p className="text-xs opacity-80">{t.description}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="rounded border border-zinc-700 px-1 text-[11px] opacity-70 hover:opacity-100"
              >
                닫기
              </button>
            </div>
            {Array.isArray(t.actions) && t.actions.length > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                {t.actions.map((a, idx) => (
                  <button
                    key={`${t.id}-action-${idx}`}
                    type="button"
                    onClick={() => {
                      try {
                        a.onClick();
                      } finally {
                        // keep toast open; user can close or it will auto-dismiss
                      }
                    }}
                    className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] hover:border-emerald-500/60 hover:text-emerald-200"
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function useOptionalToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    const noop = () => undefined as unknown as void;
    return { toasts: [] as Toast[], show: noop as ToastContextValue['show'], dismiss: noop as ToastContextValue['dismiss'] };
  }
  return ctx;
}
