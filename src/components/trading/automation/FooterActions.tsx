'use client';

import { useState } from 'react';

import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import { generateAutoTradingStrategy } from '@/lib/trading/services/autoTradingStrategy';

export function FooterActions() {
  const settings = useAutoTradingSettingsStore((s) => s.settings);
  const updateSettings = useAutoTradingSettingsStore((s) => s.updateSettings);
  const reset = useAutoTradingSettingsStore((s) => (s as any).reset as () => void);
  const [busy, setBusy] = useState<'saving' | 'generating' | null>(null);

  const saveTemp = () => {
    setBusy('saving');
    updateSettings((d) => {
      d.metadata.lastSavedAt = new Date().toISOString();
    });
    setBusy(null);
  };

  const handleGenerate = async () => {
    try {
      setBusy('generating');
      const result = await generateAutoTradingStrategy(settings);
      if (!result.ok) {
        alert(result.message ?? '전략 생성에 실패했습니다.');
        return;
      }
      alert('전략 생성 준비 완료. 자동매매를 시작할 수 있습니다.');
      reset();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        disabled={busy !== null}
        onClick={saveTemp}
        className="rounded border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
      >
        임시 저장
      </button>
      <button
        type="button"
        disabled={busy !== null}
        onClick={handleGenerate}
        className="rounded border border-emerald-500/60 px-3 py-1.5 text-xs font-semibold text-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        로직 생성
      </button>
    </div>
  );
}

