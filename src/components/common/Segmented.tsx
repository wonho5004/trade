"use client";

import React from 'react';

export function Segmented({
  value,
  options,
  onChange,
  ariaLabel
}: {
  value: string;
  options: Array<{ label: string; value: string }>;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="inline-flex rounded-lg border border-zinc-700 bg-zinc-900 p-0.5 text-[11px]">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            type="button"
            key={opt.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={`px-2 py-1 rounded-md transition ${
              active ? 'bg-emerald-600/20 text-emerald-200 border border-emerald-700' : 'text-zinc-300 hover:bg-zinc-800'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

