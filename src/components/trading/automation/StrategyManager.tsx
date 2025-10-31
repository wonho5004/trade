'use client';

import { useState } from 'react';
import { Save, FolderOpen, Trash2, Plus } from 'lucide-react';

import { useStrategies } from '@/hooks/trading/useStrategies';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import { StrategySaveModal } from './StrategySaveModal';
import type { Strategy } from '@/types/trading/strategy';

export function StrategyManager() {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);

  const { strategies, isLoading, error, loadStrategy, deleteStrategy } = useStrategies();
  const currentSettings = useAutoTradingSettingsStore(state => state.settings);

  const handleLoadStrategy = async (strategy: Strategy) => {
    if (confirm(`"${strategy.name}" 전략을 불러오시겠습니까?\n\n현재 설정이 덮어씌워집니다.`)) {
      await loadStrategy(strategy);
    }
  };

  const handleDeleteStrategy = async (strategy: Strategy) => {
    if (confirm(`"${strategy.name}" 전략을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      await deleteStrategy(strategy.id);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">전략 관리</h2>
            <p className="text-sm text-gray-500">저장된 전략을 불러오거나 현재 설정을 새 전략으로 저장하세요</p>
          </div>
          <button
            onClick={() => setShowSaveModal(true)}
            disabled={!!error}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-4 w-4" />
            현재 설정 저장
          </button>
        </div>

        {error ? (
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="mb-1 text-sm font-semibold text-red-900">전략 목록을 불러올 수 없습니다</h3>
            <p className="mb-4 text-sm text-red-700">{error}</p>
            {error.includes('인증') && (
              <a
                href="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
              >
                로그인 페이지로 이동
              </a>
            )}
          </div>
        ) : isLoading ? (
          <div className="py-8 text-center text-gray-500">
            전략 목록을 불러오는 중...
          </div>
        ) : strategies.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 py-12 text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">저장된 전략이 없습니다</h3>
            <p className="mt-1 text-sm text-gray-500">
              현재 설정을 저장하여 나중에 다시 사용할 수 있습니다
            </p>
            <button
              onClick={() => setShowSaveModal(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              첫 번째 전략 저장
            </button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {strategies.map(strategy => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                onLoad={handleLoadStrategy}
                onDelete={handleDeleteStrategy}
              />
            ))}
          </div>
        )}
      </div>

      {showSaveModal && (
        <StrategySaveModal
          currentSettings={currentSettings}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </>
  );
}

interface StrategyCardProps {
  strategy: Strategy;
  onLoad: (strategy: Strategy) => void;
  onDelete: (strategy: Strategy) => void;
}

function StrategyCard({ strategy, onLoad, onDelete }: StrategyCardProps) {
  return (
    <div className="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {strategy.is_active && (
        <div className="absolute right-2 top-2">
          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
            활성
          </span>
        </div>
      )}

      <div className="mb-3">
        <h3 className="font-semibold text-gray-900 truncate" title={strategy.name}>
          {strategy.name}
        </h3>
        {strategy.description && (
          <p className="mt-1 text-sm text-gray-500 line-clamp-2" title={strategy.description}>
            {strategy.description}
          </p>
        )}
      </div>

      <div className="mb-3 text-xs text-gray-400">
        생성일: {new Date(strategy.created_at).toLocaleDateString('ko-KR')}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onLoad(strategy)}
          className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100 transition-colors"
        >
          <FolderOpen className="h-3.5 w-3.5" />
          불러오기
        </button>
        <button
          onClick={() => onDelete(strategy)}
          className="flex items-center justify-center rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
          title="삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
