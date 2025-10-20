"use client";

export function InfoTip({ title }: { title: string }) {
  return (
    <span
      title={title}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] leading-none text-zinc-400 hover:text-zinc-200"
      aria-label={title}
    >
      i
    </span>
  );
}

