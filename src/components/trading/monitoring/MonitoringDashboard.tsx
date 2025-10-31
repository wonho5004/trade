'use client';

import { Activity } from 'lucide-react';
import { EngineControlPanel } from './EngineControlPanel';
import { ActiveStrategyPanel } from './ActiveStrategyPanel';
import { ActivityLogPanel } from './ActivityLogPanel';
import { ActivePositionsPanel } from './ActivePositionsPanel';
import { PnLTrackerPanel } from './PnLTrackerPanel';
import { PnLChartPanel } from './PnLChartPanel';
import { StrategyPerformancePanel } from './StrategyPerformancePanel';
import { TradeHistoryPanel } from './TradeHistoryPanel';
import { ConditionMonitorPanel } from './ConditionMonitorPanel';
import { ExecutionMonitor } from './ExecutionMonitor';
import { SymbolMonitoringTable } from './SymbolMonitoringTable';
import { useSessionKeepalive } from '@/hooks/useSessionKeepalive';

export function MonitoringDashboard() {
  // 세션 만료 방지: 5분마다 세션 상태를 체크하고 필요시 갱신
  useSessionKeepalive(5);

  return (
    <div className="min-h-screen bg-zinc-950 py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-500/20 p-2">
              <Activity className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">거래 모니터링</h1>
              <p className="text-sm text-zinc-400">실시간 포지션, 손익, 거래 내역을 확인하세요</p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Symbol Monitoring Table - 전체 폭 사용 */}
          <div className="lg:col-span-2">
            <SymbolMonitoringTable />
          </div>

          {/* Engine Control */}
          <div>
            <EngineControlPanel />
          </div>

          {/* Active Strategy */}
          <div>
            <ActiveStrategyPanel />
          </div>

          {/* PnL Tracker - 위로 이동 */}
          <div>
            <PnLTrackerPanel />
          </div>

          {/* Condition Monitor */}
          <div>
            <ConditionMonitorPanel />
          </div>

          {/* Execution Monitor - 실시간 로그 */}
          <div className="lg:col-span-2 h-[500px] rounded-lg border border-zinc-800 overflow-hidden">
            <ExecutionMonitor />
          </div>

          {/* Activity Log */}
          <div className="lg:col-span-2">
            <ActivityLogPanel />
          </div>

          {/* Active Positions */}
          <div className="lg:col-span-2">
            <ActivePositionsPanel />
          </div>

          {/* PnL Chart */}
          <div className="lg:col-span-2">
            <PnLChartPanel />
          </div>

          {/* Strategy Performance */}
          <div className="lg:col-span-2">
            <StrategyPerformancePanel />
          </div>

          {/* Trade History */}
          <div className="lg:col-span-2">
            <TradeHistoryPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
