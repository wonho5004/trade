'use client';

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useConditionMonitor } from '@/hooks/trading/useConditionMonitor';

export function ConditionMonitorPanel() {
  const { evaluations, isLoading, activeStrategies } = useConditionMonitor();

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">조건 평가 추적</h2>
        </div>
        <span className="text-sm text-zinc-500">
          {activeStrategies}개 전략 모니터링 중
        </span>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-zinc-500">
          조건 평가 내역을 불러오는 중...
        </div>
      ) : evaluations.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-12 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-zinc-600" />
          <p className="mt-2 text-sm text-zinc-500">아직 평가된 조건이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {evaluations.map(evaluation => (
            <div
              key={evaluation.id}
              className={`rounded-lg border p-3 ${
                evaluation.evaluation_result
                  ? 'border-emerald-700/50 bg-emerald-900/20'
                  : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2">
                  {evaluation.evaluation_result ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-zinc-500" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-100">{evaluation.symbol}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        evaluation.condition_type === 'ENTRY'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : evaluation.condition_type === 'EXIT'
                          ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                          : evaluation.condition_type === 'SCALE_IN'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                      }`}>
                        {evaluation.condition_type}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(evaluation.evaluated_at).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${
                  evaluation.evaluation_result ? 'text-emerald-400' : 'text-zinc-500'
                }`}>
                  {evaluation.evaluation_result ? '조건 충족' : '조건 미충족'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
