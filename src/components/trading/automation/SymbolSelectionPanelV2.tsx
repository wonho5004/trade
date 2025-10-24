'use client';

import React, { useState } from 'react';
import { SymbolSearchPanel } from './SymbolSearchPanel';
import { SelectedSymbolsTable } from './SelectedSymbolsTable';
import { ExcludedSymbolsTable } from './ExcludedSymbolsTable';
import { ExclusionRulesPanel } from './ExclusionRulesPanel';
import type { SymbolConfig, SymbolExclusionRules } from '@/types/trading/symbol-selection';

interface SymbolSelectionPanelV2Props {
  /** 선택된 종목 설정 목록 */
  symbols: SymbolConfig[];
  /** 제외된 종목 목록 */
  excludedSymbols: string[];
  /** 제외 사유 맵 */
  excludedReasons?: Record<string, string>;
  /** 제외 규칙 */
  exclusionRules: SymbolExclusionRules;
  /** 기본 레버리지 */
  defaultLeverage?: number;
  /** 변경 핸들러 */
  onChange: (data: {
    symbols: SymbolConfig[];
    excludedSymbols: string[];
    excludedReasons: Record<string, string>;
    exclusionRules: SymbolExclusionRules;
  }) => void;
}

/**
 * 종목 선택 패널 V2
 * - 종목 검색, 선택, 제외, 제외 규칙 관리
 * - 4개의 서브 패널로 구성 (검색, 선택, 제외, 규칙)
 */
export const SymbolSelectionPanelV2: React.FC<SymbolSelectionPanelV2Props> = ({
  symbols,
  excludedSymbols,
  excludedReasons = {},
  exclusionRules,
  defaultLeverage = 20,
  onChange
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'selected' | 'excluded' | 'rules'>('search');

  // 종목 추가
  const handleAddSymbol = (symbol: string) => {
    // 이미 선택된 종목인지 확인
    if (symbols.some(s => s.symbol === symbol)) {
      return;
    }

    // 제외 목록에서 제거 (있을 경우)
    const nextExcluded = excludedSymbols.filter(s => s !== symbol);
    const { [symbol]: _removed, ...nextReasons } = excludedReasons;

    // 종목 추가
    const [base, quote] = symbol.split(/USDT|USDC/);
    const quoteMatch = symbol.match(/USDT|USDC/);
    const nextSymbols = [
      ...symbols,
      {
        symbol,
        quote: (quoteMatch?.[0] || 'USDT') as 'USDT' | 'USDC'
      }
    ];

    onChange({
      symbols: nextSymbols,
      excludedSymbols: nextExcluded,
      excludedReasons: nextReasons,
      exclusionRules
    });

    // 선택 종목 탭으로 이동
    setActiveTab('selected');
  };

  // 종목 제외
  const handleExcludeSymbol = (symbol: string) => {
    // 이미 제외된 종목인지 확인
    if (excludedSymbols.includes(symbol)) {
      return;
    }

    // 선택 목록에서 제거 (있을 경우)
    const nextSymbols = symbols.filter(s => s.symbol !== symbol);

    // 제외 목록에 추가
    const nextExcluded = [...excludedSymbols, symbol];
    const nextReasons = { ...excludedReasons, [symbol]: '수동 제외' };

    onChange({
      symbols: nextSymbols,
      excludedSymbols: nextExcluded,
      excludedReasons: nextReasons,
      exclusionRules
    });

    // 제외 종목 탭으로 이동
    setActiveTab('excluded');
  };

  // 선택 종목 업데이트
  const handleUpdateSymbol = (index: number, updated: SymbolConfig) => {
    const nextSymbols = symbols.map((s, i) => (i === index ? updated : s));
    onChange({
      symbols: nextSymbols,
      excludedSymbols,
      excludedReasons,
      exclusionRules
    });
  };

  // 선택 종목 삭제
  const handleDeleteSymbol = (index: number) => {
    const nextSymbols = symbols.filter((_, i) => i !== index);
    onChange({
      symbols: nextSymbols,
      excludedSymbols,
      excludedReasons,
      exclusionRules
    });
  };

  // 제외 해제
  const handleRemoveExclusion = (symbol: string) => {
    const nextExcluded = excludedSymbols.filter(s => s !== symbol);
    const { [symbol]: _removed, ...nextReasons } = excludedReasons;
    onChange({
      symbols,
      excludedSymbols: nextExcluded,
      excludedReasons: nextReasons,
      exclusionRules
    });
  };

  // 제외 규칙 변경
  const handleRulesChange = (rules: SymbolExclusionRules) => {
    onChange({
      symbols,
      excludedSymbols,
      excludedReasons,
      exclusionRules: rules
    });
  };

  return (
    <div className="space-y-4">
      {/* 탭 네비게이션 */}
      <div className="flex gap-2 border-b border-zinc-700 pb-2">
        <button
          onClick={() => setActiveTab('search')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'search'
              ? 'bg-blue-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
        >
          종목 검색
        </button>
        <button
          onClick={() => setActiveTab('selected')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'selected'
              ? 'bg-green-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
        >
          선택 종목 ({symbols.length})
        </button>
        <button
          onClick={() => setActiveTab('excluded')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'excluded'
              ? 'bg-red-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
        >
          제외 종목 ({excludedSymbols.length})
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 rounded-t text-sm font-medium transition-colors ${
            activeTab === 'rules'
              ? 'bg-orange-500 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-300'
          }`}
        >
          제외 규칙
        </button>
      </div>

      {/* 패널 컨텐츠 */}
      <div>
        {activeTab === 'search' && (
          <SymbolSearchPanel
            selectedSymbols={symbols.map(s => s.symbol)}
            excludedSymbols={excludedSymbols}
            onAddSymbol={handleAddSymbol}
            onExcludeSymbol={handleExcludeSymbol}
          />
        )}

        {activeTab === 'selected' && (
          <SelectedSymbolsTable
            symbols={symbols}
            onUpdateSymbol={handleUpdateSymbol}
            onDeleteSymbol={handleDeleteSymbol}
            defaultLeverage={defaultLeverage}
          />
        )}

        {activeTab === 'excluded' && (
          <ExcludedSymbolsTable
            excludedSymbols={excludedSymbols}
            excludedReasons={excludedReasons}
            onRemoveExclusion={handleRemoveExclusion}
          />
        )}

        {activeTab === 'rules' && (
          <ExclusionRulesPanel
            rules={exclusionRules}
            onChange={handleRulesChange}
          />
        )}
      </div>
    </div>
  );
};
