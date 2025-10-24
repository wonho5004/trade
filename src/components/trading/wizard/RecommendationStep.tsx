'use client';

import React from 'react';
import type { RecommendedSettings } from '@/types/trading/setup-wizard';

interface RecommendationStepProps {
  settings: RecommendedSettings;
  onNext: () => void;
  onBack: () => void;
}

/**
 * 추천 설정 확인 단계
 */
export const RecommendationStep: React.FC<RecommendationStepProps> = ({ settings, onNext, onBack }) => {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">추천 설정</h2>
        <p className="text-sm text-zinc-400">
          선택하신 프로필에 맞는 설정입니다
        </p>
      </div>

      {/* 설명 */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <p className="text-sm text-blue-200">
          {settings.description}
        </p>
      </div>

      {/* 설정 상세 */}
      <div className="space-y-3">
        {/* 레버리지 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-200">레버리지</span>
            <span className="text-lg font-bold text-blue-400">{settings.leverage}배</span>
          </div>
          <p className="text-xs text-zinc-500">
            투자 금액의 {settings.leverage}배 크기로 거래합니다
          </p>
        </div>

        {/* 매수 금액 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-200">매수 금액</span>
            <span className="text-lg font-bold text-green-400">지갑의 {settings.buyAmountPercent}%</span>
          </div>
          <p className="text-xs text-zinc-500">
            한 번 매수 시 잔고의 {settings.buyAmountPercent}%를 사용합니다
          </p>
        </div>

        {/* 손절/익절 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-200">손절</span>
              <span className="text-lg font-bold text-red-400">-{settings.stopLossPercent}%</span>
            </div>
            <p className="text-xs text-zinc-500">
              손실 제한 기준
            </p>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-zinc-200">익절</span>
              <span className="text-lg font-bold text-green-400">+{settings.takeProfitPercent}%</span>
            </div>
            <p className="text-xs text-zinc-500">
              수익 실현 기준
            </p>
          </div>
        </div>

        {/* 추가매수 */}
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-zinc-200">추가매수 (물타기)</span>
            <span className={`text-lg font-bold ${settings.enableScaleIn ? 'text-yellow-400' : 'text-zinc-500'}`}>
              {settings.enableScaleIn ? `최대 ${settings.maxScaleInCount}회` : '사용 안 함'}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            {settings.enableScaleIn
              ? `하락 시 최대 ${settings.maxScaleInCount}번까지 추가 매수합니다`
              : '추가매수를 하지 않습니다 (안전형 설정)'}
          </p>
        </div>
      </div>

      {/* 추천 종목 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-200">
          추천 종목 ({settings.recommendedSymbols.length}개)
        </label>
        <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
          <div className="flex flex-wrap gap-2">
            {settings.recommendedSymbols.map((symbol) => (
              <span
                key={symbol}
                className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium"
              >
                {symbol}
              </span>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-3">
            위 종목들이 자동으로 선택됩니다. 다음 단계에서 수정 가능합니다.
          </p>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-medium text-yellow-300">
              이 설정은 시작점입니다
            </p>
            <p className="text-xs text-yellow-200">
              모든 값은 나중에 자동매매 설정 화면에서 세밀하게 조정할 수 있습니다. 지표 조건, 진입/청산 로직 등 고급 설정도 추가 가능합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-zinc-600 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          이전
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
        >
          설정 적용
        </button>
      </div>
    </div>
  );
};
