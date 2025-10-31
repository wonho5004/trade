'use client';

import { Clock, Filter } from 'lucide-react';
import { useState } from 'react';
import { useTradeHistory } from '@/hooks/trading/useTradeHistory';
import type { TradeAction, TradeStatus } from '@/types/trading/monitoring';

export function TradeHistoryPanel() {
  const [actionFilter, setActionFilter] = useState<TradeAction | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TradeStatus | 'ALL'>('ALL');

  const { trades, isLoading } = useTradeHistory({ action: actionFilter, status: statusFilter });

  const getActionBadge = (action: TradeAction) => {
    const colors = {
      ENTRY_LONG: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      ENTRY_SHORT: 'bg-red-500/20 text-red-300 border border-red-500/30',
      EXIT: 'bg-zinc-700 text-zinc-300 border border-zinc-600',
      SCALE_IN: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
      HEDGE: 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
    };
    return colors[action] || 'bg-zinc-700 text-zinc-300';
  };

  const getStatusBadge = (status: TradeStatus) => {
    const colors = {
      PENDING: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
      FILLED: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
      FAILED: 'bg-red-500/20 text-red-300 border border-red-500/30',
      CANCELLED: 'bg-zinc-700 text-zinc-300 border border-zinc-600'
    };
    const labels = {
      PENDING: '대기 중',
      FILLED: '체결',
      FAILED: '실패',
      CANCELLED: '취소'
    };
    return { color: colors[status], label: labels[status] };
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-zinc-400" />
          <h2 className="text-lg font-semibold text-zinc-100">거래 내역</h2>
        </div>

        <div className="flex gap-2">
          <select
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value as TradeAction | 'ALL')}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">모든 액션</option>
            <option value="ENTRY_LONG">롱 진입</option>
            <option value="ENTRY_SHORT">숏 진입</option>
            <option value="EXIT">청산</option>
            <option value="SCALE_IN">분할 매수</option>
            <option value="HEDGE">헤지</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as TradeStatus | 'ALL')}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">모든 상태</option>
            <option value="PENDING">대기 중</option>
            <option value="FILLED">체결</option>
            <option value="FAILED">실패</option>
            <option value="CANCELLED">취소</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-zinc-500">
          거래 내역을 불러오는 중...
        </div>
      ) : trades.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-700 bg-zinc-900/50 py-12 text-center">
          <p className="text-sm text-zinc-500">거래 내역이 없습니다</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-sm font-medium text-zinc-500">
                <th className="pb-3">시간</th>
                <th className="pb-3">전략</th>
                <th className="pb-3">심볼</th>
                <th className="pb-3">액션</th>
                <th className="pb-3 text-right">가격</th>
                <th className="pb-3 text-right">수량</th>
                <th className="pb-3">상태</th>
                <th className="pb-3">주문ID</th>
              </tr>
            </thead>
            <tbody>
              {trades.map(trade => {
                const statusInfo = getStatusBadge(trade.status);
                return (
                  <tr key={trade.id} className="border-b border-zinc-800">
                    <td className="py-3 text-sm text-zinc-400">
                      {new Date(trade.created_at).toLocaleString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 text-sm text-zinc-400">
                      {trade.strategy_name || '-'}
                    </td>
                    <td className="py-3 font-medium text-zinc-100">{trade.symbol}</td>
                    <td className="py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${getActionBadge(trade.action)}`}>
                        {trade.action}
                      </span>
                    </td>
                    <td className="py-3 text-right text-sm text-zinc-100">
                      ${trade.price.toFixed(2)}
                    </td>
                    <td className="py-3 text-right text-sm text-zinc-400">
                      {trade.quantity}
                    </td>
                    <td className="py-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="py-3 text-sm text-zinc-500">
                      {trade.order_id ? (
                        <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">
                          {trade.order_id.slice(0, 8)}...
                        </code>
                      ) : (
                        '-'
                      )}
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
