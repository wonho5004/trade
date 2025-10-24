'use client';

import React from 'react';
import type { ComparisonOperator } from '@/types/trading/auto-trading';

interface ComparatorSelectorProps {
  value: ComparisonOperator;
  onChange: (value: ComparisonOperator) => void;
  className?: string;
}

/**
 * 비교 연산자 선택 컴포넌트
 * - 단순화된 비교 연산자 (>, <, =, >=, <=, 선택안함)
 * - 초보자도 이해하기 쉬운 한글 설명 포함
 */
export const ComparatorSelector: React.FC<ComparatorSelectorProps> = ({
  value,
  onChange,
  className = ''
}) => {
  const options: Array<{ value: ComparisonOperator; label: string; description: string }> = [
    { value: 'over', label: '> (크면)', description: '기준값보다 클 때 (돌파)' },
    { value: 'under', label: '< (작으면)', description: '기준값보다 작을 때 (하락)' },
    { value: 'eq', label: '= (같으면)', description: '기준값과 같을 때 (교차)' },
    { value: 'gte', label: '≥ (이상)', description: '기준값 이상일 때 (유지 이상)' },
    { value: 'lte', label: '≤ (이하)', description: '기준값 이하일 때 (유지 이하)' },
    { value: 'none', label: '선택안함', description: '비교하지 않음 (지표 값만 참조)' }
  ];

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-zinc-300">
        비교 연산자
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ComparisonOperator)}
        className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* 설명 텍스트 */}
      <p className="mt-1 text-xs text-zinc-500">
        {options.find((opt) => opt.value === value)?.description}
      </p>

      {/* 도움말 */}
      <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
        <p className="text-xs font-medium text-blue-300 mb-2">💡 비교 연산자 사용 팁</p>
        <ul className="space-y-1 text-xs text-blue-200">
          <li>• <strong>&gt;</strong>: 지표를 돌파할 때 (예: RSI &gt; 70)</li>
          <li>• <strong>≥</strong>: 지표 위에서 유지할 때 (예: 종가 ≥ MA(20))</li>
          <li>• <strong>=</strong>: 정확히 교차할 때 (드물게 사용)</li>
          <li>• <strong>선택안함</strong>: 다른 조건과 조합 시 사용</li>
        </ul>
      </div>
    </div>
  );
};
