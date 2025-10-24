'use client';

import React, { useState } from 'react';
import type { SymbolConfig } from '@/types/trading/symbol-selection';

interface SelectedSymbolsTableProps {
  /** 선택된 종목 설정 목록 */
  symbols: SymbolConfig[];
  /** 종목 설정 변경 핸들러 */
  onUpdateSymbol: (index: number, updated: SymbolConfig) => void;
  /** 종목 삭제 핸들러 */
  onDeleteSymbol: (index: number) => void;
  /** 기본 레버리지 (설정 참조) */
  defaultLeverage?: number;
}

/**
 * 선택 종목 테이블
 * - 인라인 편집: 레버리지, 포지션 방향, 추가매수/매도/손절 활성화
 * - 종목별 설정이 기본값보다 우선 적용됨을 안내
 */
export const SelectedSymbolsTable: React.FC<SelectedSymbolsTableProps> = ({
  symbols,
  onUpdateSymbol,
  onDeleteSymbol,
  defaultLeverage = 20
}) => {
  const [editingLeverage, setEditingLeverage] = useState<number | null>(null);

  const handleLeverageChange = (index: number, value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 125) {
      return; // 유효하지 않은 값 무시
    }
    const updated = { ...symbols[index], leverage: num };
    onUpdateSymbol(index, updated);
  };

  const handleLeverageReset = (index: number) => {
    const updated = { ...symbols[index], leverage: undefined };
    onUpdateSymbol(index, updated);
    setEditingLeverage(null);
  };

  const handlePositionModeChange = (index: number, mode: 'long' | 'short' | 'both' | 'default') => {
    const updated = {
      ...symbols[index],
      positionMode: mode === 'default' ? undefined : mode
    };
    onUpdateSymbol(index, updated);
  };

  const toggleFeature = (
    index: number,
    feature: 'enableScaleIn' | 'enableExit' | 'enableStopLoss'
  ) => {
    const current = symbols[index][feature];
    const updated = {
      ...symbols[index],
      [feature]: current === undefined ? true : current === true ? false : undefined
    };
    onUpdateSymbol(index, updated);
  };

  const getFeatureLabel = (value: boolean | undefined): string => {
    if (value === undefined) return '기본';
    return value ? 'O' : 'X';
  };

  const getFeatureColor = (value: boolean | undefined): string => {
    if (value === undefined) return 'text-zinc-400';
    return value ? 'text-green-400' : 'text-red-400';
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      {/* 헤더 */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-sm font-semibold text-zinc-100">
            선택 종목 ({symbols.length}개)
          </h3>
        </div>
      </div>

      {/* 종목 없음 */}
      {symbols.length === 0 && (
        <div className="py-8 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-zinc-800 mb-3">
            <svg className="w-6 h-6 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400">선택된 종목이 없습니다</p>
          <p className="text-xs text-zinc-500 mt-1">
            왼쪽 검색 패널에서 종목을 추가하세요
          </p>
        </div>
      )}

      {/* 테이블 */}
      {symbols.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">No</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">심볼</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">레버리지</th>
                <th className="px-2 py-2 text-left text-xs font-medium text-zinc-400">포지션</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-zinc-400">추가매수</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-zinc-400">매도</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-zinc-400">손절</th>
                <th className="px-2 py-2 text-center text-xs font-medium text-zinc-400">액션</th>
              </tr>
            </thead>
            <tbody>
              {symbols.map((sym, index) => {
                const isEditingLeverage = editingLeverage === index;
                const leverageDisplay =
                  sym.leverage !== undefined ? `${sym.leverage}x` : `기본(${defaultLeverage}x)`;

                return (
                  <tr key={`${sym.symbol}-${index}`} className="border-b border-zinc-800 hover:bg-zinc-800/30">
                    {/* No */}
                    <td className="px-2 py-2 text-zinc-300">{index + 1}</td>

                    {/* 심볼 */}
                    <td className="px-2 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-100">{sym.symbol}</span>
                        <span className="text-xs text-zinc-500">{sym.quote}</span>
                      </div>
                    </td>

                    {/* 레버리지 */}
                    <td className="px-2 py-2">
                      {isEditingLeverage ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={1}
                            max={125}
                            defaultValue={sym.leverage || defaultLeverage}
                            onBlur={(e) => {
                              handleLeverageChange(index, e.target.value);
                              setEditingLeverage(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleLeverageChange(index, e.currentTarget.value);
                                setEditingLeverage(null);
                              } else if (e.key === 'Escape') {
                                setEditingLeverage(null);
                              }
                            }}
                            autoFocus
                            className="w-16 rounded border border-blue-500 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:outline-none"
                          />
                          <button
                            onClick={() => handleLeverageReset(index)}
                            className="text-xs text-zinc-500 hover:text-zinc-400"
                            title="기본값으로 재설정"
                          >
                            초기화
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingLeverage(index)}
                          className={`text-xs hover:text-blue-400 transition-colors ${
                            sym.leverage !== undefined ? 'text-blue-300 font-medium' : 'text-zinc-400'
                          }`}
                        >
                          {leverageDisplay}
                        </button>
                      )}
                    </td>

                    {/* 포지션 */}
                    <td className="px-2 py-2">
                      <select
                        value={sym.positionMode || 'default'}
                        onChange={(e) =>
                          handlePositionModeChange(
                            index,
                            e.target.value as 'long' | 'short' | 'both' | 'default'
                          )
                        }
                        className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 focus:border-blue-500 focus:outline-none"
                      >
                        <option value="default">기본</option>
                        <option value="long">롱</option>
                        <option value="short">숏</option>
                        <option value="both">양방향</option>
                      </select>
                    </td>

                    {/* 추가매수 */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleFeature(index, 'enableScaleIn')}
                        className={`text-xs font-medium ${getFeatureColor(sym.enableScaleIn)}`}
                        title="클릭하여 변경 (기본 → O → X → 기본)"
                      >
                        {getFeatureLabel(sym.enableScaleIn)}
                      </button>
                    </td>

                    {/* 매도 */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleFeature(index, 'enableExit')}
                        className={`text-xs font-medium ${getFeatureColor(sym.enableExit)}`}
                        title="클릭하여 변경 (기본 → O → X → 기본)"
                      >
                        {getFeatureLabel(sym.enableExit)}
                      </button>
                    </td>

                    {/* 손절 */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => toggleFeature(index, 'enableStopLoss')}
                        className={`text-xs font-medium ${getFeatureColor(sym.enableStopLoss)}`}
                        title="클릭하여 변경 (기본 → O → X → 기본)"
                      >
                        {getFeatureLabel(sym.enableStopLoss)}
                      </button>
                    </td>

                    {/* 액션 */}
                    <td className="px-2 py-2 text-center">
                      <button
                        onClick={() => onDeleteSymbol(index)}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        title="종목 삭제"
                      >
                        삭제
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
      {symbols.length > 0 && (
        <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3">
          <p className="text-xs font-medium text-blue-300 mb-1">💡 종목별 설정 우선순위</p>
          <ul className="space-y-0.5 text-xs text-blue-200">
            <li>• 표에서 설정한 값이 <strong>기본 설정</strong>보다 우선 적용됩니다</li>
            <li>• <strong>기본</strong>: 기본 설정 값 사용</li>
            <li>• <strong>O/X</strong>: 종목별로 활성화/비활성화</li>
            <li>• 레버리지 클릭 시 직접 입력 가능 (1~125배)</li>
          </ul>
        </div>
      )}
    </div>
  );
};
