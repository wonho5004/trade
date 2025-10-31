"use client";

import { useState } from 'react';
import { Save } from 'lucide-react';

import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import { generateAutoTradingStrategy } from '@/lib/trading/services/autoTradingStrategy';
import { useOptionalToast } from '@/components/common/ToastProvider';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { StrategySaveModal } from './StrategySaveModal';
import { SettingsConfirmModal } from './SettingsConfirmModal';

export function FooterActions() {
  const settings = useAutoTradingSettingsStore((s) => s.settings);
  const updateSettings = useAutoTradingSettingsStore((s) => s.updateSettings);
  const reset = useAutoTradingSettingsStore((s) => (s as any).reset as () => void);
  const [busy, setBusy] = useState<'saving' | 'generating' | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { show } = useOptionalToast();
  const setCollapsed = useUIPreferencesStore((s) => s.setCollapsed);

  const saveTemp = () => {
    setBusy('saving');
    updateSettings((d) => {
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    setBusy(null);
    show({ title: '임시 저장 완료', type: 'success' });
  };

  const handleGenerate = async () => {
    try {
      setBusy('generating');
      const result = await generateAutoTradingStrategy(settings);
      if (!result.ok) {
        const msg = result.message ?? '전략 생성에 실패했습니다.';
        show({ title: '로직 생성 실패', description: msg, type: 'error', durationMs: 5000 });
        // Try to infer the section from message text and focus it
        const lower = msg.toLowerCase();
        const key =
          lower.includes('기본') || lower.includes('basic') ? 'basic' :
          lower.includes('심볼') || lower.includes('종목') || lower.includes('symbols') ? 'symbols' :
          lower.includes('진입') || lower.includes('매수') || lower.includes('entry') ? 'entry' :
          lower.includes('추가') || lower.includes('scalein') ? 'scaleIn' :
          lower.includes('청산') || lower.includes('exit') ? 'exit' :
          lower.includes('손절') || lower.includes('stop') ? 'stopLoss' :
          lower.includes('헤지') || lower.includes('hedge') ? 'hedge' :
          lower.includes('자본') || lower.includes('투자') || lower.includes('capital') || lower.includes('예외') || lower.includes('잔고') ? 'capital' :
          undefined;
        if (key) {
          try {
            setCollapsed(key, false);
            setTimeout(() => {
              const el = document.getElementById(`section-${key}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
          } catch {}
        }
        return;
      }
      show({ title: '로직 생성 준비 완료', description: '자동매매를 시작할 수 있습니다.', type: 'success' });
      reset();
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          disabled={busy !== null}
          onClick={saveTemp}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          설정 저장
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setShowSaveModal(true)}
          className="flex items-center gap-1.5 rounded border border-blue-500/60 px-3 py-1.5 text-xs font-semibold text-blue-200 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          <Save className="h-3.5 w-3.5" />
          전략으로 저장
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => setShowConfirmModal(true)}
          className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          로직 생성
        </button>
      </div>

      {showSaveModal && (
        <StrategySaveModal
          currentSettings={settings}
          onClose={() => setShowSaveModal(false)}
        />
      )}

      <SettingsConfirmModal
        settings={settings}
        isOpen={showConfirmModal}
        onConfirm={async () => {
          setShowConfirmModal(false);
          await handleGenerate();
        }}
        onCancel={() => setShowConfirmModal(false)}
      />
    </>
  );
}
