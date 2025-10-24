'use client';

import React from 'react';
import type { SymbolExclusionRules } from '@/types/trading/symbol-selection';

interface ExclusionRulesPanelProps {
  /** 제외 규칙 설정 */
  rules: SymbolExclusionRules;
  /** 규칙 변경 핸들러 */
  onChange: (rules: SymbolExclusionRules) => void;
}

/**
 * 종목 제외 규칙 패널
 * - 상장일, 거래량, 시가총액, 일일 변동률 기준 필터링
 * - 체크박스 + 입력 필드 조합
 */
export const ExclusionRulesPanel: React.FC<ExclusionRulesPanelProps> = ({ rules, onChange }) => {
  const updateRule = (path: string[], value: any) => {
    const updated = JSON.parse(JSON.stringify(rules));
    let current: any = updated;
    for (let i = 0; i < path.length - 1; i++) {
      if (!current[path[i]]) current[path[i]] = {};
      current = current[path[i]];
    }
    if (value === undefined || value === null || value === '') {
      delete current[path[path.length - 1]];
    } else {
      current[path[path.length - 1]] = value;
    }
    onChange(updated);
  };

  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      {/* 헤더 */}
      <div className="mb-4 flex items-center gap-2">
        <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <h3 className="text-sm font-semibold text-zinc-100">종목 제외 규칙</h3>
      </div>

      <div className="space-y-4">
        {/* 상장일 필터 */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-300">상장일 필터</h4>
          <div className="space-y-2 pl-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.minListingDays !== undefined}
                onChange={(e) =>
                  updateRule(['minListingDays'], e.target.checked ? 7 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">상장일</span>
              <input
                type="number"
                min={0}
                value={rules.minListingDays ?? 7}
                onChange={(e) =>
                  updateRule(['minListingDays'], parseInt(e.target.value, 10) || undefined)
                }
                disabled={rules.minListingDays === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">일 이하 제외</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.excludeUnknownListing}
                onChange={(e) =>
                  updateRule(['excludeUnknownListing'], e.target.checked)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">상장일 정보 없음 제외</span>
            </label>
          </div>
        </div>

        {/* 거래량 필터 */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-300">거래량 (24h USDT)</h4>
          <div className="space-y-2 pl-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.volume?.excludeTop !== undefined}
                onChange={(e) =>
                  updateRule(['volume', 'excludeTop'], e.target.checked ? 10 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">상위</span>
              <input
                type="number"
                min={1}
                value={rules.volume?.excludeTop ?? 10}
                onChange={(e) =>
                  updateRule(['volume', 'excludeTop'], parseInt(e.target.value, 10) || undefined)
                }
                disabled={rules.volume?.excludeTop === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">위 제외</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.volume?.excludeBottom !== undefined}
                onChange={(e) =>
                  updateRule(['volume', 'excludeBottom'], e.target.checked ? 10 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">하위</span>
              <input
                type="number"
                min={1}
                value={rules.volume?.excludeBottom ?? 10}
                onChange={(e) =>
                  updateRule(['volume', 'excludeBottom'], parseInt(e.target.value, 10) || undefined)
                }
                disabled={rules.volume?.excludeBottom === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">위 제외</span>
            </label>
          </div>
        </div>

        {/* 시가총액 필터 */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-300">시가총액 (추정치)</h4>
          <div className="space-y-2 pl-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.marketCap?.excludeTop !== undefined}
                onChange={(e) =>
                  updateRule(['marketCap', 'excludeTop'], e.target.checked ? 5 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">상위</span>
              <input
                type="number"
                min={1}
                value={rules.marketCap?.excludeTop ?? 5}
                onChange={(e) =>
                  updateRule(['marketCap', 'excludeTop'], parseInt(e.target.value, 10) || undefined)
                }
                disabled={rules.marketCap?.excludeTop === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">위 제외</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.marketCap?.excludeBottom !== undefined}
                onChange={(e) =>
                  updateRule(['marketCap', 'excludeBottom'], e.target.checked ? 5 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">하위</span>
              <input
                type="number"
                min={1}
                value={rules.marketCap?.excludeBottom ?? 5}
                onChange={(e) =>
                  updateRule(['marketCap', 'excludeBottom'], parseInt(e.target.value, 10) || undefined)
                }
                disabled={rules.marketCap?.excludeBottom === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">위 제외</span>
            </label>
          </div>
        </div>

        {/* 일일 상승률 필터 */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-300">일일 상승률 (%)</h4>
          <div className="space-y-2 pl-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.dailyGain?.excludeAbove !== undefined}
                onChange={(e) =>
                  updateRule(['dailyGain', 'excludeAbove'], e.target.checked ? 10 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">상위</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={rules.dailyGain?.excludeAbove ?? 10}
                onChange={(e) =>
                  updateRule(['dailyGain', 'excludeAbove'], parseFloat(e.target.value) || undefined)
                }
                disabled={rules.dailyGain?.excludeAbove === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">% 이상 제외</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.dailyGain?.excludeBelow !== undefined}
                onChange={(e) =>
                  updateRule(['dailyGain', 'excludeBelow'], e.target.checked ? -10 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">하위</span>
              <input
                type="number"
                step={0.1}
                value={rules.dailyGain?.excludeBelow ?? -10}
                onChange={(e) =>
                  updateRule(['dailyGain', 'excludeBelow'], parseFloat(e.target.value) || undefined)
                }
                disabled={rules.dailyGain?.excludeBelow === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">% 이하 제외</span>
            </label>
          </div>
        </div>

        {/* 일일 하락률 필터 */}
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-zinc-300">일일 하락률 (%)</h4>
          <div className="space-y-2 pl-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.dailyLoss?.excludeAbove !== undefined}
                onChange={(e) =>
                  updateRule(['dailyLoss', 'excludeAbove'], e.target.checked ? 10 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">상위</span>
              <input
                type="number"
                min={0}
                step={0.1}
                value={rules.dailyLoss?.excludeAbove ?? 10}
                onChange={(e) =>
                  updateRule(['dailyLoss', 'excludeAbove'], parseFloat(e.target.value) || undefined)
                }
                disabled={rules.dailyLoss?.excludeAbove === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">% 이상 제외</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={rules.dailyLoss?.excludeBelow !== undefined}
                onChange={(e) =>
                  updateRule(['dailyLoss', 'excludeBelow'], e.target.checked ? -10 : undefined)
                }
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-0"
              />
              <span className="text-xs text-zinc-300">하위</span>
              <input
                type="number"
                step={0.1}
                value={rules.dailyLoss?.excludeBelow ?? -10}
                onChange={(e) =>
                  updateRule(['dailyLoss', 'excludeBelow'], parseFloat(e.target.value) || undefined)
                }
                disabled={rules.dailyLoss?.excludeBelow === undefined}
                className="w-16 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50 focus:border-blue-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-400">% 이하 제외</span>
            </label>
          </div>
        </div>
      </div>

      {/* 안내 메시지 */}
      <div className="mt-4 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3">
        <p className="text-xs font-medium text-orange-300 mb-1">💡 제외 규칙 사용 팁</p>
        <ul className="space-y-0.5 text-xs text-orange-200">
          <li>• 체크박스를 선택하면 해당 규칙이 활성화됩니다</li>
          <li>• 여러 규칙을 조합하여 사용할 수 있습니다</li>
          <li>• 규칙에 해당하는 종목은 자동으로 제외됩니다</li>
        </ul>
      </div>
    </div>
  );
};
