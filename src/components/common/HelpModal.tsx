"use client";

import { useState } from 'react';

export function HelpButton({ label = 'ⓘ 도움말', onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200"
      aria-label="도움말"
    >
      {label}
    </button>
  );
}

export function HelpModal({
  open,
  title,
  children,
  onClose
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1200] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,820px)] max-h-[80vh] overflow-auto rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-zinc-500"
          >
            닫기
          </button>
        </div>
        <div className="prose prose-invert max-w-none text-sm text-zinc-200">{children}</div>
      </div>
    </div>
  );
}

