import type { ReactNode } from 'react';

export type IndicatorToggleCardProps = {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  children: ReactNode;
  badge?: string;
  disabledMessage?: string;
};

/**
 * Reusable wrapper for indicator blocks that share the same heading + toggle + body layout.
 * This component will replace the inline JSX inside AutoTradingSettingsForm once integration is completed.
 */
export function IndicatorToggleCard({
  title,
  description,
  enabled,
  onToggle,
  children,
  badge,
  disabledMessage = '이 조건은 현재 비활성화되어 있습니다.'
}: IndicatorToggleCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800/70 bg-zinc-950/50 p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded bg-emerald-400/70" aria-hidden />
            <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
            {badge ? (
              <span className="rounded-full border border-emerald-500/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-zinc-400">{description}</p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-emerald-200">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => onToggle(event.target.checked)}
            className="h-4 w-4 rounded border border-emerald-400/60 bg-zinc-900"
          />
          사용
        </label>
      </div>
      {enabled ? (
        <div className="mt-4">{children}</div>
      ) : (
        <p className="mt-4 rounded border border-dashed border-zinc-800 bg-zinc-900/40 px-3 py-2 text-[11px] text-zinc-500">
          {disabledMessage}
        </p>
      )}
    </div>
  );
}
