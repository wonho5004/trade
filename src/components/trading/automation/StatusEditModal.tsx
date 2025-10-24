'use client';

import React, { useState, useEffect } from 'react';
import type { StatusLeafNode, StatusMetric, StatusUnit, ComparisonOperator } from '@/types/trading/auto-trading';
import { StatusConditionEditor } from './StatusConditionEditor';

interface StatusEditModalProps {
  open: boolean;
  title?: string;
  statusNode?: StatusLeafNode;
  onSave: (status: StatusLeafNode) => void;
  onClose: () => void;
}

/**
 * Status 조건 편집 모달
 * - 현재 수익률, 마진 금액, 매수 횟수, 진입 경과시간 편집
 */
export const StatusEditModal: React.FC<StatusEditModalProps> = ({
  open,
  title = 'Status 조건 편집',
  statusNode,
  onSave,
  onClose
}) => {
  const [metric, setMetric] = useState<StatusMetric>(statusNode?.metric || 'profitRate');
  const [comparator, setComparator] = useState<ComparisonOperator>(statusNode?.comparator || 'over');
  const [value, setValue] = useState<number>(statusNode?.value || 0);
  const [unit, setUnit] = useState<StatusUnit>(statusNode?.unit || 'percent');

  // statusNode 변경 시 상태 초기화
  useEffect(() => {
    if (statusNode) {
      setMetric(statusNode.metric);
      setComparator(statusNode.comparator);
      setValue(statusNode.value);
      setUnit(statusNode.unit || 'percent');
    } else {
      // 새로운 조건 추가 시 기본값
      setMetric('profitRate');
      setComparator('over');
      setValue(0);
      setUnit('percent');
    }
  }, [statusNode]);

  const handleSave = () => {
    const updatedStatus: StatusLeafNode = {
      kind: 'status',
      id: statusNode?.id || `status-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      metric,
      comparator,
      value,
      unit
    };
    onSave(updatedStatus);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-2xl rounded-lg border border-zinc-700 bg-zinc-900 p-6 shadow-xl">
        {/* 헤더 */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            aria-label="닫기"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 편집기 */}
        <StatusConditionEditor
          metric={metric}
          comparator={comparator}
          value={value}
          unit={unit}
          onMetricChange={setMetric}
          onComparatorChange={setComparator}
          onValueChange={setValue}
          onUnitChange={setUnit}
        />

        {/* 액션 버튼 */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="rounded border border-blue-500 bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/20 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};
