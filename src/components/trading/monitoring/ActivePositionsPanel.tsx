'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { useActivePositions } from '@/hooks/trading/useActivePositions';

export function ActivePositionsPanel() {
  const { positions, isLoading, closePosition } = useActivePositions();

  const handleClose = async (positionId: string) => {
    if (confirm('이 포지션을 수동으로 청산하시겠습니까?')) {
      await closePosition(positionId);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-100">활성 포지션</h2>
        <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-medium text-blue-300">
          {positions.length}개 보유
        </span>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-zinc-500">
          포지션을 불러오는 중...
        </div>
      ) : positions.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-12 text-center">
          <p className="text-sm text-zinc-500">현재 보유 중인 포지션이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-sm font-medium text-zinc-500">
                <th className="pb-3">심볼</th>
                <th className="pb-3">방향</th>
                <th className="pb-3 text-right">진입가</th>
                <th className="pb-3 text-right">현재가</th>
                <th className="pb-3 text-right">수량</th>
                <th className="pb-3 text-right">레버리지</th>
                <th className="pb-3 text-right">미실현 손익</th>
                <th className="pb-3 text-right">수익률</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {positions.map(position => {
                const pnlPercentage = ((position.current_price - position.entry_price) / position.entry_price) * 100 *
                  (position.side === 'LONG' ? 1 : -1) * position.leverage;
                const isProfitable = position.unrealized_pnl > 0;

                return (
                  <tr key={position.id} className="border-b border-zinc-800">
                    <td className="py-4 font-medium text-zinc-100">{position.symbol}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          position.side === 'LONG'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {position.side === 'LONG' ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {position.side}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm text-zinc-400">
                      ${position.entry_price.toFixed(2)}
                    </td>
                    <td className="py-4 text-right text-sm font-medium text-zinc-100">
                      ${position.current_price.toFixed(2)}
                    </td>
                    <td className="py-4 text-right text-sm text-zinc-400">
                      {position.quantity}
                    </td>
                    <td className="py-4 text-right text-sm text-zinc-400">
                      {position.leverage}x
                    </td>
                    <td className={`py-4 text-right text-sm font-semibold ${
                      isProfitable ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isProfitable ? '+' : ''}${position.unrealized_pnl.toFixed(2)}
                    </td>
                    <td className={`py-4 text-right text-sm font-semibold ${
                      isProfitable ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {isProfitable ? '+' : ''}{pnlPercentage.toFixed(2)}%
                    </td>
                    <td className="py-4 text-right">
                      <button
                        onClick={() => handleClose(position.id)}
                        className="rounded-md bg-red-500/20 p-1.5 text-red-400 hover:bg-red-500/30 transition-colors"
                        title="수동 청산"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
