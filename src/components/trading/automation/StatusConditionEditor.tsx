'use client';

import React from 'react';
import type { StatusMetric, StatusUnit, ComparisonOperator } from '@/types/trading/auto-trading';
import { ComparatorSelector } from './ComparatorSelector';

interface StatusConditionEditorProps {
  metric: StatusMetric;
  comparator: ComparisonOperator;
  value: number;
  unit?: StatusUnit;
  onMetricChange: (metric: StatusMetric) => void;
  onComparatorChange: (comparator: ComparisonOperator) => void;
  onValueChange: (value: number) => void;
  onUnitChange: (unit: StatusUnit) => void;
  className?: string;
}

/**
 * Status 조건 편집기
 * - 현재 수익률, 마진 금액, 매수 횟수, 진입 경과시간 설정
 */
export const StatusConditionEditor: React.FC<StatusConditionEditorProps> = ({
  metric,
  comparator,
  value,
  unit,
  onMetricChange,
  onComparatorChange,
  onValueChange,
  onUnitChange,
  className = ''
}) => {
  const metricOptions: Array<{ value: StatusMetric; label: string; description: string }> = [
    { value: 'profitRate', label: '현재 수익률', description: '포지션의 현재 수익률 (%)' },
    { value: 'margin', label: '현재 마진 금액', description: '투입된 마진 금액 (USDT/USDC)' },
    { value: 'buyCount', label: '매수 횟수', description: '추가매수 포함 총 매수 횟수' },
    { value: 'entryAge', label: '포지션 진입 경과시간', description: '포지션 진입 후 경과 시간 (일)' }
  ];

  // metric에 따라 기본 unit 자동 설정
  const getDefaultUnit = (m: StatusMetric): StatusUnit => {
    switch (m) {
      case 'profitRate':
        return 'percent';
      case 'margin':
        return unit === 'USDT' || unit === 'USDC' ? unit : 'USDT';
      case 'buyCount':
        return 'count';
      case 'entryAge':
        return 'days';
      default:
        return 'percent';
    }
  };

  const handleMetricChange = (newMetric: StatusMetric) => {
    onMetricChange(newMetric);
    // metric 변경 시 unit도 기본값으로 변경
    onUnitChange(getDefaultUnit(newMetric));
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 조건 타입 선택 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-300">
          조건 타입
        </label>
        <select
          value={metric}
          onChange={(e) => handleMetricChange(e.target.value as StatusMetric)}
          className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {metricOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-zinc-500">
          {metricOptions.find((opt) => opt.value === metric)?.description}
        </p>
      </div>

      {/* 비교 연산자 */}
      <ComparatorSelector
        value={comparator}
        onChange={onComparatorChange}
      />

      {/* 값 입력 */}
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-300">
          기준값
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={value}
            onChange={(e) => onValueChange(Number(e.target.value))}
            step={metric === 'profitRate' ? '0.1' : metric === 'entryAge' ? '0.01' : '1'}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* 단위 선택 (마진 금액인 경우만) */}
          {metric === 'margin' && (
            <select
              value={unit || 'USDT'}
              onChange={(e) => onUnitChange(e.target.value as StatusUnit)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          )}

          {/* 단위 표시 (기타) */}
          {metric !== 'margin' && (
            <div className="flex items-center px-3 text-sm text-zinc-400">
              {metric === 'profitRate' && '%'}
              {metric === 'buyCount' && '회'}
              {metric === 'entryAge' && '일'}
            </div>
          )}
        </div>
      </div>

      {/* 예시 안내 */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
        <p className="text-xs font-medium text-green-300 mb-2">💡 사용 예시</p>
        <ul className="space-y-1 text-xs text-green-200">
          <li>• <strong>현재 수익률 &gt; 5%</strong>: 수익률이 5%를 초과할 때</li>
          <li>• <strong>현재 마진 금액 ≥ 100 USDT</strong>: 투입 금액이 100 USDT 이상일 때</li>
          <li>• <strong>매수 횟수 ≥ 3회</strong>: 3번 이상 매수했을 때</li>
          <li>• <strong>진입 경과시간 ≥ 1일</strong>: 포지션 진입 후 1일 이상 경과</li>
        </ul>
      </div>
    </div>
  );
};
