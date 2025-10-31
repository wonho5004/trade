'use client';

import { DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { usePnLTracking } from '@/hooks/trading/usePnLTracking';

export function PnLTrackerPanel() {
  const { totalUnrealized, totalRealized, isLoading } = usePnLTracking();

  const totalPnL = totalUnrealized + totalRealized;
  const isProfitable = totalPnL > 0;

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center gap-2">
        <DollarSign className="h-5 w-5 text-zinc-400" />
        <h2 className="text-lg font-semibold text-zinc-100">손익 추적</h2>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-zinc-500">
          손익 데이터를 불러오는 중...
        </div>
      ) : (
        <div className="space-y-4">
          {/* Total PnL */}
          <div className="rounded-lg bg-gradient-to-br from-blue-900/40 to-blue-800/40 border border-blue-700/30 p-4">
            <div className="mb-1 text-sm font-medium text-blue-300">총 손익</div>
            <div className={`flex items-center gap-2 text-3xl font-bold ${
              isProfitable ? 'text-emerald-400' : 'text-red-400'
            }`}>
              {isProfitable ? (
                <TrendingUp className="h-6 w-6" />
              ) : (
                <TrendingDown className="h-6 w-6" />
              )}
              {isProfitable ? '+' : ''}${totalPnL.toFixed(2)}
            </div>
          </div>

          {/* Unrealized PnL */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <div className="text-sm text-zinc-500">미실현 손익</div>
              <div className={`text-xl font-semibold ${
                totalUnrealized > 0 ? 'text-emerald-400' : totalUnrealized < 0 ? 'text-red-400' : 'text-zinc-100'
              }`}>
                {totalUnrealized > 0 ? '+' : ''}${totalUnrealized.toFixed(2)}
              </div>
            </div>
            <div className={`rounded-full p-2 ${
              totalUnrealized > 0 ? 'bg-emerald-500/20' : totalUnrealized < 0 ? 'bg-red-500/20' : 'bg-zinc-800'
            }`}>
              {totalUnrealized > 0 ? (
                <TrendingUp className={`h-5 w-5 ${totalUnrealized > 0 ? 'text-emerald-400' : 'text-zinc-400'}`} />
              ) : (
                <TrendingDown className={`h-5 w-5 ${totalUnrealized < 0 ? 'text-red-400' : 'text-zinc-400'}`} />
              )}
            </div>
          </div>

          {/* Realized PnL */}
          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <div className="text-sm text-zinc-500">실현 손익</div>
              <div className={`text-xl font-semibold ${
                totalRealized > 0 ? 'text-emerald-400' : totalRealized < 0 ? 'text-red-400' : 'text-zinc-100'
              }`}>
                {totalRealized > 0 ? '+' : ''}${totalRealized.toFixed(2)}
              </div>
            </div>
            <div className={`rounded-full p-2 ${
              totalRealized > 0 ? 'bg-emerald-500/20' : totalRealized < 0 ? 'bg-red-500/20' : 'bg-zinc-800'
            }`}>
              <DollarSign className={`h-5 w-5 ${
                totalRealized > 0 ? 'text-emerald-400' : totalRealized < 0 ? 'text-red-400' : 'text-zinc-400'
              }`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
