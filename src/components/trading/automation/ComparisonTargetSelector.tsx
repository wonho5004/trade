'use client';

import React from 'react';
import type { IndicatorComparisonLeaf, CandleFieldOption, CandleReference, ComparisonOperator } from '@/types/trading/auto-trading';

interface ComparisonTargetSelectorProps {
  value: IndicatorComparisonLeaf | { kind: 'none' };
  onChange: (value: IndicatorComparisonLeaf | { kind: 'none' }) => void;
  availableIndicators?: Array<{ id: string; label: string }>;
  className?: string;
}

/**
 * 비교 대상 선택 컴포넌트
 * - 고정값, 캔들 값, 다른 지표 중 선택
 * - 각 타입별 상세 설정 제공
 */
export const ComparisonTargetSelector: React.FC<ComparisonTargetSelectorProps> = ({
  value,
  onChange,
  availableIndicators = [],
  className = ''
}) => {
  const [mode, setMode] = React.useState<'none' | 'value' | 'candle' | 'indicator'>(value.kind);

  const handleModeChange = (newMode: typeof mode) => {
    setMode(newMode);

    if (newMode === 'none') {
      onChange({ kind: 'none' });
    } else if (newMode === 'value') {
      onChange({ kind: 'value', comparator: 'over', value: 0 });
    } else if (newMode === 'candle') {
      onChange({ kind: 'candle', comparator: 'over', field: 'close', reference: 'current' });
    } else if (newMode === 'indicator') {
      onChange({ kind: 'indicator', comparator: 'over', targetIndicatorId: availableIndicators[0]?.id || '' });
    }
  };

  return (
    <div className={className}>
      <label className="mb-1 block text-xs font-medium text-zinc-300">
        비교 대상
      </label>

      {/* 모드 선택 라디오 버튼 */}
      <div className="space-y-2 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="comparison-mode"
            checked={mode === 'value'}
            onChange={() => handleModeChange('value')}
            className="text-blue-500"
          />
          <span className="text-sm text-zinc-200">고정값</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="comparison-mode"
            checked={mode === 'candle'}
            onChange={() => handleModeChange('candle')}
            className="text-blue-500"
          />
          <span className="text-sm text-zinc-200">캔들 값</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="comparison-mode"
            checked={mode === 'indicator'}
            onChange={() => handleModeChange('indicator')}
            className="text-blue-500"
          />
          <span className="text-sm text-zinc-200">다른 지표</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="comparison-mode"
            checked={mode === 'none'}
            onChange={() => handleModeChange('none')}
            className="text-blue-500"
          />
          <span className="text-sm text-zinc-200">선택안함</span>
        </label>
      </div>

      {/* 모드별 상세 설정 */}
      {mode === 'value' && value.kind === 'value' && (
        <div className="space-y-2">
          <label className="block text-xs text-zinc-400">기준값</label>
          <input
            type="number"
            value={value.value}
            onChange={(e) => onChange({ ...value, value: parseFloat(e.target.value) || 0 })}
            step="0.1"
            className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none"
          />
        </div>
      )}

      {mode === 'candle' && value.kind === 'candle' && (
        <div className="space-y-2">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">캔들 필드</label>
            <select
              value={value.field}
              onChange={(e) => onChange({ ...value, field: e.target.value as CandleFieldOption })}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="open">시가 (Open)</option>
              <option value="high">고가 (High)</option>
              <option value="low">저가 (Low)</option>
              <option value="close">종가 (Close)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">캔들 기준</label>
            <select
              value={value.reference}
              onChange={(e) => onChange({ ...value, reference: e.target.value as CandleReference })}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              <option value="current">현재 캔들</option>
              <option value="previous">이전 캔들</option>
            </select>
          </div>
        </div>
      )}

      {mode === 'indicator' && value.kind === 'indicator' && (
        <div className="space-y-2">
          <label className="block text-xs text-zinc-400 mb-1">대상 지표</label>
          {availableIndicators.length > 0 ? (
            <select
              value={value.targetIndicatorId}
              onChange={(e) => onChange({ ...value, targetIndicatorId: e.target.value })}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
            >
              {availableIndicators.map((indicator) => (
                <option key={indicator.id} value={indicator.id}>
                  {indicator.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-amber-400 p-2 border border-amber-500/30 bg-amber-500/10 rounded">
              다른 지표가 없습니다. 먼저 다른 지표를 추가해주세요.
            </p>
          )}
        </div>
      )}

      {mode === 'none' && (
        <p className="text-xs text-zinc-500 p-2 border border-zinc-700 bg-zinc-800/50 rounded">
          비교 대상을 선택하지 않았습니다. 지표 값만 참조합니다.
        </p>
      )}
    </div>
  );
};
