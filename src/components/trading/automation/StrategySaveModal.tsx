'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, AlertTriangle } from 'lucide-react';

import { useStrategies } from '@/hooks/trading/useStrategies';
import type { AutoTradingSettings } from '@/types/trading/auto-trading';

interface StrategySaveModalProps {
  currentSettings: AutoTradingSettings;
  onClose: () => void;
}

export function StrategySaveModal({ currentSettings, onClose }: StrategySaveModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const [existingStrategyId, setExistingStrategyId] = useState<string | null>(null);

  const { saveStrategy, deleteStrategy, strategies } = useStrategies();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleSave = async () => {
    setError('');

    if (!name.trim()) {
      setError('전략 이름을 입력하세요');
      return;
    }

    // Validate currentSettings before saving
    if (!currentSettings) {
      console.error('[StrategySaveModal] currentSettings is falsy:', currentSettings);
      setError('현재 설정을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }

    // Test if settings can be serialized
    try {
      const testSerialization = JSON.stringify(currentSettings);
      console.log('[StrategySaveModal] Serialization test passed, length:', testSerialization.length);
    } catch (serializationError) {
      console.error('[StrategySaveModal] Serialization failed:', serializationError);
      setError('설정 데이터를 직렬화할 수 없습니다. 설정을 다시 확인해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const request = {
        name: name.trim(),
        description: description.trim() || undefined,
        settings: currentSettings,
        is_active: isActive
      };

      await saveStrategy(request);
      onClose();
    } catch (err) {
      console.error('[StrategySaveModal] Save failed:', err);
      const errorMessage = err instanceof Error ? err.message : '전략 저장에 실패했습니다';

      // Check if it's a duplicate name error
      if (errorMessage.includes('이미 같은 이름의 전략이 존재합니다')) {
        // Find the existing strategy with the same name
        const existing = strategies.find(s => s.name === name.trim());
        if (existing) {
          setExistingStrategyId(existing.id);
          setShowOverwriteConfirm(true);
        } else {
          setError(errorMessage);
        }
      } else {
        setError(errorMessage);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleOverwriteConfirm = async () => {
    if (!existingStrategyId) return;

    setShowOverwriteConfirm(false);
    setIsSaving(true);
    setError('');

    try {
      // Delete existing strategy
      await deleteStrategy(existingStrategyId);

      // Save new strategy
      const request = {
        name: name.trim(),
        description: description.trim() || undefined,
        settings: currentSettings,
        is_active: isActive
      };

      await saveStrategy(request);
      onClose();
    } catch (err) {
      console.error('[StrategySaveModal] Overwrite failed:', err);
      setError(err instanceof Error ? err.message : '전략 저장에 실패했습니다');
    } finally {
      setIsSaving(false);
      setExistingStrategyId(null);
    }
  };

  const handleOverwriteCancel = () => {
    setShowOverwriteConfirm(false);
    setExistingStrategyId(null);
  };

  if (!mounted) return null;

  // Overwrite confirmation modal
  const overwriteConfirmModal = showOverwriteConfirm && (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4" style={{ margin: 0 }}>
      <div className="w-full max-w-md rounded-lg border border-amber-600 bg-zinc-900 p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <AlertTriangle className="h-6 w-6 flex-shrink-0 text-amber-500" />
          <div>
            <h3 className="text-lg font-semibold text-zinc-100">전략 덮어쓰기 확인</h3>
            <p className="mt-2 text-sm text-zinc-300">
              &quot;{name}&quot; 이름의 전략이 이미 존재합니다.
            </p>
            <p className="mt-1 text-sm text-zinc-400">
              기존 전략을 삭제하고 새로 저장하시겠습니까?
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={handleOverwriteCancel}
            disabled={isSaving}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleOverwriteConfirm}
            disabled={isSaving}
            className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? '저장 중...' : '덮어쓰기'}
          </button>
        </div>
      </div>
    </div>
  );

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4" style={{ margin: 0 }}>
      <div className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-2xl" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-zinc-100">전략 저장</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="strategy-name" className="block text-sm font-medium text-zinc-300 mb-1">
              전략 이름 <span className="text-red-400">*</span>
            </label>
            <input
              id="strategy-name"
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="예: RSI 역추세 전략"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={100}
            />
          </div>

          <div>
            <label htmlFor="strategy-description" className="block text-sm font-medium text-zinc-300 mb-1">
              설명 (선택)
            </label>
            <textarea
              id="strategy-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="전략에 대한 설명을 입력하세요"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              rows={3}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-zinc-500">
              {description.length}/500
            </p>
          </div>

          <div className="flex items-center">
            <input
              id="strategy-active"
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="strategy-active" className="ml-2 text-sm text-zinc-300">
              이 전략을 즉시 활성화
            </label>
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/30 border border-red-700/50 p-3">
              <p className="text-sm text-red-200">{error}</p>
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save className="h-4 w-4" />
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(modalContent, document.body)}
      {overwriteConfirmModal && createPortal(overwriteConfirmModal, document.body)}
    </>
  );
}
