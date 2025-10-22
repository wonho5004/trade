import type { ReactNode } from 'react';
import { useState } from 'react';

import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { useOptionalToast } from '@/components/common/ToastProvider';
import { HelpButton, HelpModal } from '@/components/common/HelpModal';

type SectionFrameProps = {
  sectionKey: string;
  title: string;
  description?: string;
  errorMessage?: string;
  isDirty?: boolean;
  onSave?: () => Promise<void | (() => void)> | void | (() => void);
  onReset?: () => void;
  // 자동 저장 섹션에서 버튼을 항상 활성화(재검증/스냅샷 용도)
  forceEnableSave?: boolean;
  helpTitle?: string;
  helpContent?: React.ReactNode;
  children: ReactNode;
};

export function SectionFrame({ sectionKey, title, description, errorMessage, isDirty = false, onSave, onReset, forceEnableSave = false, helpTitle, helpContent, children }: SectionFrameProps) {
  const isCollapsed = useUIPreferencesStore((s) => s.autoTrading.collapsedSections[sectionKey] !== false);
  const toggleCollapsed = useUIPreferencesStore((s) => s.toggleCollapsed);
  const setCollapsed = useUIPreferencesStore((s) => s.setCollapsed);
  const [saving, setSaving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { show } = useOptionalToast();

  const handleToggle = () => toggleCollapsed(sectionKey);

  const handleSave = async () => {
    if (!onSave) return;
    try {
      setSaving(true);
      setLocalError(null);
      const maybeUndo = await Promise.resolve(onSave());
      // collapse after successful save
      toggleCollapsed(sectionKey);
      if (typeof maybeUndo === 'function') {
        show({
          title: '저장 완료',
          description: `${title}이(가) 저장되었습니다.`,
          type: 'success',
          actions: [
            {
              label: '되돌리기',
              onClick: () => {
                try {
                  maybeUndo();
                  setCollapsed(sectionKey, false);
                  show({ title: '변경을 되돌렸습니다.', type: 'info', durationMs: 1800 });
                } catch {
                  show({ title: '되돌리기 실패', type: 'error' });
                }
              }
            }
          ]
        });
      } else {
        show({ title: '저장 완료', description: `${title}이(가) 저장되었습니다.`, type: 'success' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.';
      show({ title: '저장 실패', description: message, type: 'error' });
      setLocalError(message);
      // ensure visible
      setCollapsed(sectionKey, false);
      try {
        const el = document.getElementById(`section-${sectionKey}`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // focus first invalid or interactive element to guide the user
        setTimeout(() => {
          const container = document.getElementById(`section-${sectionKey}`);
          const firstInvalid = container?.querySelector('[aria-invalid="true"]') as HTMLElement | null;
          const firstInteractive = container?.querySelector('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])') as HTMLElement | null;
          (firstInvalid || firstInteractive)?.focus?.();
        }, 80);
      } catch {}
    } finally {
      setSaving(false);
    }
  };

  const hasError = Boolean(localError || errorMessage);
  return (
    <section id={`section-${sectionKey}`} className={`rounded-xl bg-zinc-950 ${hasError ? 'border border-rose-700' : 'border border-zinc-800'}`}>
      <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-4 py-3 md:px-5 md:py-4">
        <button
          type="button"
          aria-expanded={!isCollapsed}
          onClick={handleToggle}
          className="group text-left"
        >
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded bg-emerald-400/70" aria-hidden />
            <h2 className="text-base font-semibold text-zinc-100">{title}</h2>
            {!isDirty ? (
              <span className="rounded-full border border-emerald-500/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                저장됨
              </span>
            ) : null}
          </div>
          {description ? <p className="mt-0.5 text-xs text-zinc-400">{description}</p> : null}
          {hasError ? (
            <p className="mt-1 text-xs font-medium text-rose-300">{localError || errorMessage}</p>
          ) : null}
        </button>
        <div className="flex items-center gap-2">
          {helpContent ? <HelpButton onClick={() => setShowHelp(true)} /> : null}
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-zinc-100"
            >
              초기화
            </button>
          ) : null}
          {onSave ? (
          <button
            type="button"
            disabled={saving || (!forceEnableSave && !isDirty)}
            onClick={handleSave}
            className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? '저장 중…' : '저장'}
          </button>
        ) : null}
        </div>
      </header>
      {!isCollapsed ? <div className="p-4 md:p-5">{children}</div> : null}
      {helpContent ? (
        <HelpModal open={showHelp} title={helpTitle ?? `${title} 도움말`} onClose={() => setShowHelp(false)}>
          {helpContent}
        </HelpModal>
      ) : null}
    </section>
  );
}
