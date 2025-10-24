'use client';

import React, { useState } from 'react';
import type { MarginBasis } from '@/types/trading/auto-trading';

type BuyAmountMode = 'usdt_fixed' | 'per_symbol_percent' | 'total_percent' | 'position_percent';

interface BuyAmountConfig {
  mode: BuyAmountMode;
  // USDT 고정 금액
  usdtAmount?: number;
  asset?: 'USDT' | 'USDC';
  // 퍼센티지 기반
  percentage?: number;
  basis?: MarginBasis; // wallet | total | free
  // 최소 주문 단위 처리
  useMinNotionalIfBelow?: boolean;
  minNotional?: number;
}

interface BuyAmountSettingsProps {
  value: BuyAmountConfig;
  onChange: (config: BuyAmountConfig) => void;
  // 계산용 정보
  estimatedBalance?: number;
  symbolCount?: number;
  currentPositionSize?: number; // 추가매수용
  label?: string;
  className?: string;
}

/**
 * 매수 금액 설정 컴포넌트
 * - USDT 고정 금액
 * - 종목별 잔고 기준 %
 * - 총 잔고 기준 %
 * - 현재 포지션 기준 % (추가매수)
 */
export const BuyAmountSettings: React.FC<BuyAmountSettingsProps> = ({
  value,
  onChange,
  estimatedBalance = 0,
  symbolCount = 1,
  currentPositionSize = 0,
  label = '매수 금액 설정',
  className = ''
}) => {
  const [showBalanceFetch, setShowBalanceFetch] = useState(false);

  const handleModeChange = (mode: BuyAmountMode) => {
    onChange({
      ...value,
      mode,
      // mode 변경 시 기본값 설정
      percentage: mode.includes('percent') ? (value.percentage || 10) : undefined,
      usdtAmount: mode === 'usdt_fixed' ? (value.usdtAmount || 100) : undefined,
      basis: mode.includes('percent') && mode !== 'position_percent' ? (value.basis || 'wallet') : undefined
    });
  };

  const handleUsdtAmountChange = (amount: number) => {
    onChange({ ...value, usdtAmount: amount });
  };

  const handleAssetChange = (asset: 'USDT' | 'USDC') => {
    onChange({ ...value, asset });
  };

  const handlePercentageChange = (percentage: number) => {
    onChange({ ...value, percentage: Math.max(0.01, Math.min(100, percentage)) });
  };

  const handleBasisChange = (basis: MarginBasis) => {
    onChange({ ...value, basis });
  };

  const handleMinNotionalToggle = (enabled: boolean) => {
    onChange({ ...value, useMinNotionalIfBelow: enabled });
  };

  // 예상 주문 금액 계산
  const calculateEstimatedAmount = (): number => {
    if (value.mode === 'usdt_fixed') {
      return value.usdtAmount || 0;
    }

    if (value.mode === 'per_symbol_percent') {
      // 총 잔고 / 거래종목수 * 입력값%
      return (estimatedBalance / Math.max(1, symbolCount)) * ((value.percentage || 0) / 100);
    }

    if (value.mode === 'total_percent') {
      // 총 잔고 * 입력값%
      return estimatedBalance * ((value.percentage || 0) / 100);
    }

    if (value.mode === 'position_percent') {
      // 현재 포지션 * 입력값%
      return currentPositionSize * ((value.percentage || 0) / 100);
    }

    return 0;
  };

  const estimatedAmount = calculateEstimatedAmount();

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-sm font-medium text-zinc-200">{label}</h3>

      {/* 모드 선택 */}
      <div>
        <label className="mb-2 block text-xs font-medium text-zinc-300">
          금액 설정 방식
        </label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.mode === 'usdt_fixed'}
              onChange={() => handleModeChange('usdt_fixed')}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-200">USDT 고정 금액</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.mode === 'per_symbol_percent'}
              onChange={() => handleModeChange('per_symbol_percent')}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-200">종목별 잔고 기준 %</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              checked={value.mode === 'total_percent'}
              onChange={() => handleModeChange('total_percent')}
              className="h-4 w-4"
            />
            <span className="text-sm text-zinc-200">총 잔고 기준 %</span>
          </label>
          {currentPositionSize > 0 && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={value.mode === 'position_percent'}
                onChange={() => handleModeChange('position_percent')}
                className="h-4 w-4"
              />
              <span className="text-sm text-zinc-200">현재 포지션 기준 % (추가매수)</span>
            </label>
          )}
        </div>
      </div>

      {/* USDT 고정 금액 */}
      {value.mode === 'usdt_fixed' && (
        <div className="space-y-2">
          <label className="block text-xs font-medium text-zinc-300">
            금액
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={value.usdtAmount || 0}
              onChange={(e) => handleUsdtAmountChange(Number(e.target.value))}
              min={0}
              step={1}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={value.asset || 'USDT'}
              onChange={(e) => handleAssetChange(e.target.value as 'USDT' | 'USDC')}
              className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="USDT">USDT</option>
              <option value="USDC">USDC</option>
            </select>
          </div>
        </div>
      )}

      {/* 퍼센티지 기반 */}
      {value.mode.includes('percent') && value.mode !== 'position_percent' && (
        <>
          {/* 잔고 기준 선택 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-300">
              잔고 기준
            </label>
            <select
              value={value.basis || 'wallet'}
              onChange={(e) => handleBasisChange(e.target.value as MarginBasis)}
              className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="wallet">Wallet (지갑 잔고)</option>
              <option value="total">Total (총 잔고)</option>
              <option value="free">Free (사용 가능 잔고)</option>
            </select>
          </div>

          {/* 퍼센티지 입력 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-zinc-300">
              비율 (0.01% ~ 100%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={value.percentage || 0}
                onChange={(e) => handlePercentageChange(Number(e.target.value))}
                min={0.01}
                max={100}
                step={0.01}
                className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-sm text-zinc-400">%</span>
            </div>
          </div>
        </>
      )}

      {/* 포지션 기준 퍼센티지 */}
      {value.mode === 'position_percent' && (
        <div>
          <label className="mb-2 block text-xs font-medium text-zinc-300">
            비율 (1% ~ 1000%)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={value.percentage || 0}
              onChange={(e) => handlePercentageChange(Number(e.target.value))}
              min={1}
              max={1000}
              step={1}
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-zinc-400">%</span>
          </div>
        </div>
      )}

      {/* 예상 주문 금액 */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-blue-300">예상 주문 금액</span>
          <span className="text-sm font-bold text-blue-200">
            {estimatedAmount.toFixed(2)} {value.asset || 'USDT'}
          </span>
        </div>
        {value.mode === 'per_symbol_percent' && (
          <p className="mt-1 text-xs text-blue-300">
            계산: {estimatedBalance.toFixed(2)} ÷ {symbolCount} × {value.percentage}% = {estimatedAmount.toFixed(2)}
          </p>
        )}
        {value.mode === 'total_percent' && (
          <p className="mt-1 text-xs text-blue-300">
            계산: {estimatedBalance.toFixed(2)} × {value.percentage}% = {estimatedAmount.toFixed(2)}
          </p>
        )}
      </div>

      {/* 최소 주문 단위 처리 */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value.useMinNotionalIfBelow || false}
            onChange={(e) => handleMinNotionalToggle(e.target.checked)}
            className="h-4 w-4 rounded border border-zinc-700 bg-zinc-900"
          />
          <span className="text-xs text-zinc-300">
            최소 주문 단위 미달 시 최소 금액으로 주문
          </span>
        </label>
        <p className="text-xs text-zinc-500 ml-6">
          체크 해제 시: 최소 주문금액 미달 시 주문 미실행
        </p>
      </div>

      {/* 잔고 조회 버튼 (향후 구현) */}
      <button
        type="button"
        onClick={() => setShowBalanceFetch(true)}
        className="w-full rounded border border-emerald-600 bg-emerald-600/10 px-4 py-2 text-sm font-medium text-emerald-300 hover:bg-emerald-600/20 transition-colors"
      >
        💰 실제 잔고 조회 (예상 → 실제)
      </button>

      {/* 도움말 */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3">
        <p className="text-xs font-medium text-green-300 mb-2">💡 사용 팁</p>
        <ul className="space-y-1 text-xs text-green-200">
          <li>• <strong>USDT 고정</strong>: 종목마다 정확히 같은 금액 투자</li>
          <li>• <strong>종목별 %</strong>: 잔고를 종목 수로 나눈 후 %만큼 투자</li>
          <li>• <strong>총 잔고 %</strong>: 전체 잔고의 %만큼 투자</li>
          <li>• <strong>포지션 %</strong>: 현재 포지션 크기 대비 % (추가매수)</li>
        </ul>
      </div>
    </div>
  );
};

export type { BuyAmountConfig, BuyAmountMode };
