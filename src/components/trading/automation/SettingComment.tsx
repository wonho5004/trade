import type { ReactNode } from 'react';

export function SettingComment({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-950/60 p-3 text-[11px] leading-relaxed text-zinc-400">
      {children}
    </div>
  );
}

