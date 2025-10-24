'use client';

import React from 'react';

interface ExcludedSymbolsTableProps {
  /** 제외된 종목 목록 */
  excludedSymbols: string[];
  /** 제외 사유 맵 */
  excludedReasons?: Record<string, string>;
  /** 종목 제외 해제 핸들러 */
  onRemoveExclusion: (symbol: string) => void;
}

/**
 * 제외 종목 테이블
 * - 제외된 종목과 제외 사유 표시
 * - 스테이블코인 등 자동 제외 항목 안내
 */
export const ExcludedSymbolsTable: React.FC<ExcludedSymbolsTableProps> = ({
  excludedSymbols,
  excludedReasons = {},
  onRemoveExclusion
}) => {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      {/* 헤더 */}
      <div className="mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        <h3 className="text-sm font-semibold text-zinc-100">
          제외 종목 ({excludedSymbols.length}개)
        </h3>
      </div>

      {/* 종목 없음 */}
      {excludedSymbols.length === 0 && (
        <div className="py-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 mb-2">
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">제외된 종목이 없습니다</p>
        </div>
      )}

      {/* 테이블 */}
      {excludedSymbols.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">No</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">심볼</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">제외 사유</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-zinc-400">액션</th>
              </tr>
            </thead>
            <tbody>
              {excludedSymbols.map((symbol, index) => {
                const reason = excludedReasons[symbol] || '수동 제외';

                return (
                  <tr key={`${symbol}-${index}`} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                    {/* No */}
                    <td className="px-2 py-2 text-zinc-300">{index + 1}</td>

                    {/* 심볼 */}
                    <td className="px-2 py-2">
                      <span className="font-medium text-zinc-100">{symbol}</span>
                    </td>

                    {/* 제외 사유 */}
                    <td className="px-2 py-2">
                      <span className="text-xs text-zinc-400">{reason}</span>
                    </td>

                    {/* 액션 */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => onRemoveExclusion(symbol)}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        title="제외 해제"
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 안내 메시지 */}
      <div className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
        <p className="text-xs font-medium text-yellow-300 mb-1">💡 자동 제외 항목</p>
        <ul className="space-y-0.5 text-xs text-yellow-200">
          <li>• <strong>스테이블코인</strong>: USDT, USDC, BUSD 등 (자동)</li>
          <li>• <strong>제외 규칙</strong>: 상장일, 거래량, 시가총액 필터 적용</li>
          <li>• 수동으로 제외한 종목은 "수동 제외"로 표시됩니다</li>
        </ul>
      </div>
    </div>
  );
};
