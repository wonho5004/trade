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
    { value: 'unrealizedPnl', label: '미실현 손익', description: '현재 미실현 손익 (USDT)' },
    { value: 'margin', label: '현재 마진 금액', description: '투입된 마진 금액 (USDT/USDC)' },
    { value: 'initialMarginRate', label: '초기 마진 비율', description: '초기 마진 대비 현재 마진 비율 (%)' },
    { value: 'positionSize', label: '포지션 크기', description: '현재 포지션 크기 (USDT)' },
    { value: 'buyCount', label: '매수 횟수', description: '추가매수 포함 총 매수 횟수' },
    { value: 'entryAge', label: '포지션 진입 경과시간', description: '포지션 진입 후 경과 시간' },
    { value: 'walletBalance', label: '잔고', description: '현재 지갑 잔고 (USDT/USDC)' }
  ];

  // metric에 따라 기본 unit 자동 설정
  const getDefaultUnit = (m: StatusMetric): StatusUnit => {
    switch (m) {
      case 'profitRate':
      case 'initialMarginRate':
        return 'percent';
      case 'margin':
      case 'unrealizedPnl':
      case 'positionSize':
      case 'walletBalance':
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
            step={
              metric === 'profitRate' || metric === 'initialMarginRate' ? '0.1' :
              metric === 'entryAge' ? '0.1' :
              metric === 'unrealizedPnl' || metric === 'margin' || metric === 'positionSize' || metric === 'walletBalance' ? '0.01' :
              '1'
            }
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />

          {/* 단위 선택 (금액 관련 필드) */}
          {(metric === 'margin' || metric === 'unrealizedPnl' || metric === 'positionSize' || metric === 'walletBalance') && (
            <select
              value={unit || 'USDT'}
              onChange={(e) => onUnitChange(e.target.value as StatusUnit)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          )}

          {/* 단위 선택 (시간 관련 필드) */}
          {metric === 'entryAge' && (
            <select
              value={unit || 'days'}
              onChange={(e) => onUnitChange(e.target.value as StatusUnit)}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="minutes">분</option>
              <option value="hours">시간</option>
              <option value="days">일</option>
            </select>
          )}

          {/* 단위 표시 (기타) */}
          {metric !== 'margin' && metric !== 'unrealizedPnl' && metric !== 'positionSize' && metric !== 'walletBalance' && metric !== 'entryAge' && (
            <div className="flex items-center px-3 text-sm text-zinc-400">
              {(metric === 'profitRate' || metric === 'initialMarginRate') && '%'}
              {metric === 'buyCount' && '회'}
            </div>
          )}
        </div>
      </div>

      {/* 예시 안내 */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
        <p className="text-xs font-medium text-green-300 mb-2">💡 활용 예시</p>
        <div className="space-y-2 text-xs text-green-200">
          <div>
            <p className="font-semibold mb-1">추가매수 (물타기)</p>
            <ul className="space-y-0.5 ml-3">
              <li>• <strong>현재 수익률 &lt; -3%</strong> AND <strong>매수 횟수 &lt; 3회</strong></li>
              <li className="text-xs text-green-300/80">→ 손실 시 최대 3번까지만 추가 매수</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">손절 (손해 제한)</p>
            <ul className="space-y-0.5 ml-3">
              <li>• <strong>현재 수익률 &lt; -10%</strong> OR <strong>진입 경과시간 &gt; 2일</strong></li>
              <li className="text-xs text-green-300/80">→ 10% 손실 또는 2일 경과 시 강제 청산</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold mb-1">헤지 (양방향 진입)</p>
            <ul className="space-y-0.5 ml-3">
              <li>• <strong>초기 마진 비율 &gt; 150%</strong></li>
              <li className="text-xs text-green-300/80">→ 마진이 초기 투자의 1.5배를 넘으면 반대 포지션</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 경고 메시지 */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
        <p className="text-xs font-medium text-yellow-300 mb-1">⚠️ 주의사항</p>
        <ul className="space-y-0.5 text-xs text-yellow-200">
          <li>• 무분별한 추가매수는 손실을 확대시킬 수 있습니다</li>
          <li>• 명확한 손절 기준을 설정하는 것이 중요합니다</li>
          <li>• 포지션 크기와 레버리지를 고려하여 안전한 기준값을 설정하세요</li>
        </ul>
      </div>
    </div>
  );
};
