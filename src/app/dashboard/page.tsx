import { AppHeader } from '@/components/common/AppHeader';
import { CandlestickChart } from '@/components/chart/CandlestickChart';
import { ChartTopBar } from '@/components/chart/ChartTopBar';
import { BottomPanel } from '@/components/dashboard/BottomPanel';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';

export default function DashboardPage() {
  return (
    <div className="flex h-screen w-full flex-col bg-background-dark">
      <AppHeader />
      <main className="flex flex-1 overflow-auto p-1.5 gap-1.5">
        <div className="flex flex-1 flex-col gap-1.5 min-w-0">
          <div className="flex-shrink-0">
            <ChartTopBar />
          </div>
          <div className="flex-shrink-0 flex flex-col bg-panel-dark rounded-lg p-2">
            <CandlestickChart />
          </div>
          <div className="flex-shrink-0">
            <BottomPanel />
          </div>
        </div>
        <aside className="flex w-80 flex-shrink-0 flex-col gap-1.5">
          <DashboardSidebar />
        </aside>
      </main>
    </div>
  );
}
