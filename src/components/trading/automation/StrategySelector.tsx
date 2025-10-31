'use client';

import { useState } from 'react';
import { FolderOpen, ChevronDown, Trash2 } from 'lucide-react';

import { useStrategies } from '@/hooks/trading/useStrategies';
import type { Strategy } from '@/types/trading/strategy';

export function StrategySelector() {
  const [isOpen, setIsOpen] = useState(false);
  const { strategies, isLoading, error, loadStrategy, deleteStrategy } = useStrategies();

  const handleLoadStrategy = async (strategy: Strategy) => {
    setIsOpen(false);
    if (confirm(`"${strategy.name}" 전략을 불러오시겠습니까?\n\n현재 설정이 덮어씌워집니다.`)) {
      await loadStrategy(strategy);
    }
  };

  const handleDeleteStrategy = async (strategy: Strategy, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`"${strategy.name}" 전략을 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      await deleteStrategy(strategy.id);
    }
  };

  if (error) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/50 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800/50 transition-colors"
      >
        <FolderOpen className="h-4 w-4" />
        <span>저장된 전략 불러오기</span>
        {strategies.length > 0 && (
          <span className="ml-1 rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
            {strategies.length}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 top-full z-20 mt-2 w-80 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
            <div className="p-2">
              {isLoading ? (
                <div className="py-8 text-center text-sm text-zinc-500">
                  전략 목록을 불러오는 중...
                </div>
              ) : strategies.length === 0 ? (
                <div className="py-8 text-center">
                  <FolderOpen className="mx-auto h-8 w-8 text-zinc-600" />
                  <p className="mt-2 text-sm text-zinc-500">저장된 전략이 없습니다</p>
                </div>
              ) : (
                <div className="max-h-96 space-y-1 overflow-y-auto">
                  {strategies.map(strategy => (
                    <div
                      key={strategy.id}
                      className="group relative flex items-start gap-3 rounded-md p-2 hover:bg-zinc-800 cursor-pointer"
                      onClick={() => handleLoadStrategy(strategy)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-zinc-200 truncate">
                            {strategy.name}
                          </h4>
                          {strategy.is_active && (
                            <span className="inline-flex items-center rounded-full bg-green-500/20 px-1.5 py-0.5 text-[10px] font-medium text-green-300">
                              활성
                            </span>
                          )}
                        </div>
                        {strategy.description && (
                          <p className="mt-0.5 text-xs text-zinc-500 line-clamp-1">
                            {strategy.description}
                          </p>
                        )}
                        <p className="mt-1 text-[10px] text-zinc-600">
                          {new Date(strategy.created_at).toLocaleDateString('ko-KR')}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteStrategy(strategy, e)}
                        className="opacity-0 group-hover:opacity-100 rounded p-1 text-zinc-500 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
