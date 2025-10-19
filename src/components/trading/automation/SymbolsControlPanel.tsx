import React from 'react';

import { normalizeSymbol } from '@/lib/trading/symbols';

type Row = {
  symbol: string;
};

export function SymbolsControlPanel({
  quote,
  symbols,
  leverageOverrides,
  positionOverrides,
  onChangeLeverage,
  onChangePosition,
  onRemove,
}: {
  quote: 'USDT' | 'USDC';
  symbols: string[];
  leverageOverrides: Record<string, number>;
  positionOverrides?: Record<string, 'long' | 'short' | 'both'>;
  onChangeLeverage: (symbol: string, value: number) => void;
  onChangePosition: (symbol: string, value: 'long' | 'short' | 'both' | '') => void;
  onRemove: (symbol: string) => void;
}) {
  const rows: Row[] = symbols.map((s) => ({ symbol: normalizeSymbol(s, quote) }));

  return (
    <div className="space-y-2 rounded border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="flex items-center justify-between text-xs text-zinc-300">
        <span className="text-zinc-400">선택 종목</span>
        <span className="text-[11px] text-zinc-500">총 {rows.length}개</span>
      </div>
      <div className="max-h-72 overflow-auto">
        <table className="w-full table-fixed text-left text-[11px] text-zinc-300">
          <colgroup>
            <col className="w-12" />
            <col className="w-[28%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
            <col className="w-[18%]" />
          </colgroup>
          <thead className="sticky top-0 bg-zinc-950">
            <tr className="border-b border-zinc-800">
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">심볼</th>
              <th className="px-2 py-1">레버리지</th>
              <th className="px-2 py-1">포지션</th>
              <th className="px-2 py-1">매도</th>
              <th className="px-2 py-1">손절</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-3 text-center text-zinc-500">
                  표에 표시할 종목이 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => {
                const lev = leverageOverrides[row.symbol] ?? '';
                const pref = positionOverrides?.[row.symbol] ?? '';
                return (
                  <tr key={`scp-${row.symbol}`} className="border-b border-zinc-900 align-middle">
                    <td className="px-2 py-1 text-zinc-500">{idx + 1}</td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2">
                        <span className="max-w-[12rem] truncate">{row.symbol}</span>
                        <button
                          type="button"
                          onClick={() => onRemove(row.symbol)}
                          className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-400 hover:text-rose-300"
                        >
                          제외
                        </button>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="number"
                        min={1}
                        max={125}
                        value={lev}
                        onChange={(e) => onChangeLeverage(row.symbol, Math.min(125, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-20 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <select
                        value={pref}
                        onChange={(e) => onChangePosition(row.symbol, e.target.value as any)}
                        className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
                      >
                        <option value="">미설정</option>
                        <option value="long">롱</option>
                        <option value="short">숏</option>
                        <option value="both">헤지(롱+숏)</option>
                      </select>
                    </td>
                    <td className="px-2 py-1 text-zinc-400">설정값</td>
                    <td className="px-2 py-1 text-zinc-400">설정값</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

