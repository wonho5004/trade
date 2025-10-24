'use client';

import React from 'react';
import type { RecommendedSettings } from '@/types/trading/setup-wizard';

interface CompleteStepProps {
  settings: RecommendedSettings;
  onClose: () => void;
}

/**
 * 설정 완료 단계
 */
export const CompleteStep: React.FC<CompleteStepProps> = ({ settings, onClose }) => {
  return (
    <div className="space-y-6">
      {/* 성공 아이콘 */}
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-green-500/20 p-4">
            <svg className="w-16 h-16 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-zinc-100 mb-2">
          설정이 완료되었습니다!
        </h2>
        <p className="text-sm text-zinc-400">
          추천 설정이 자동매매 설정에 적용되었습니다
        </p>
      </div>

      {/* 적용된 설정 요약 */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <h3 className="text-sm font-semibold text-green-300 mb-3">적용된 설정 요약</h3>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-zinc-400">레버리지:</span>
            <span className="ml-2 text-green-300 font-semibold">{settings.leverage}배</span>
          </div>
          <div>
            <span className="text-zinc-400">매수 금액:</span>
            <span className="ml-2 text-green-300 font-semibold">지갑의 {settings.buyAmountPercent}%</span>
          </div>
          <div>
            <span className="text-zinc-400">손절:</span>
            <span className="ml-2 text-red-300 font-semibold">-{settings.stopLossPercent}%</span>
          </div>
          <div>
            <span className="text-zinc-400">익절:</span>
            <span className="ml-2 text-green-300 font-semibold">+{settings.takeProfitPercent}%</span>
          </div>
          <div className="col-span-2">
            <span className="text-zinc-400">종목:</span>
            <span className="ml-2 text-green-300 font-semibold">{settings.recommendedSymbols.length}개 선택됨</span>
          </div>
        </div>
      </div>

      {/* 다음 단계 안내 */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-200">다음 단계</h3>

        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-xs font-bold">1</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-200">진입/청산 조건 추가</h4>
              <p className="text-xs text-zinc-500 mt-1">
                지표 기반 조건을 추가하여 언제 매수/매도할지 정의하세요
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-xs font-bold">2</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-200">종목별 세부 설정</h4>
              <p className="text-xs text-zinc-500 mt-1">
                각 종목마다 다른 레버리지나 전략을 설정할 수 있습니다
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-xs font-bold">3</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-200">백테스팅 (준비 중)</h4>
              <p className="text-xs text-zinc-500 mt-1">
                과거 데이터로 전략을 테스트하고 성과를 확인하세요
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-lg bg-zinc-800/50">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 text-xs font-bold">4</span>
            </div>
            <div>
              <h4 className="text-sm font-medium text-zinc-200">자동매매 시작</h4>
              <p className="text-xs text-zinc-500 mt-1">
                모든 설정이 완료되면 자동매매를 활성화하세요
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 경고 메시지 */}
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="space-y-1">
            <p className="text-sm font-medium text-yellow-300">
              실제 거래 전 주의사항
            </p>
            <ul className="space-y-1 text-xs text-yellow-200">
              <li>• 소액으로 테스트 거래를 먼저 진행해보세요</li>
              <li>• 시장 상황을 주시하고 필요시 수동으로 개입하세요</li>
              <li>• 레버리지 거래는 높은 리스크를 수반합니다</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 완료 버튼 */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onClose}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          설정 화면으로 이동
        </button>
      </div>
    </div>
  );
};
