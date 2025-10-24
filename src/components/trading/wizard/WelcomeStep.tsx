'use client';

import React from 'react';

interface WelcomeStepProps {
  onNext: () => void;
}

/**
 * 위저드 환영 화면
 */
export const WelcomeStep: React.FC<WelcomeStepProps> = ({ onNext }) => {
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-blue-500/20 p-4">
            <svg className="w-12 h-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">
          자동매매 설정 마법사
        </h2>
        <p className="text-sm text-zinc-400">
          몇 가지 간단한 질문으로 최적의 설정을 찾아드립니다
        </p>
      </div>

      {/* 설명 카드 */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 font-bold">1</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">투자 경험 선택</h3>
            <p className="text-xs text-zinc-400">
              현재 선물 거래 경험 수준을 알려주세요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 font-bold">2</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">리스크 선호도 선택</h3>
            <p className="text-xs text-zinc-400">
              안전/균형/공격 중 선호하는 투자 성향을 선택하세요
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
            <span className="text-green-400 font-bold">3</span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 mb-1">맞춤 설정 확인</h3>
            <p className="text-xs text-zinc-400">
              자동으로 생성된 추천 설정을 검토하고 적용하세요
            </p>
          </div>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-medium text-blue-300">
              나중에 언제든지 변경 가능합니다
            </p>
            <p className="text-xs text-blue-200">
              위저드를 통해 생성된 설정은 시작점일 뿐이며, 이후 세부 조정이 가능합니다.
            </p>
          </div>
        </div>
      </div>

      {/* 시작 버튼 */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onNext}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          시작하기
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};
