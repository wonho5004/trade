import { AppHeader } from '@/components/common/AppHeader';
import { CandlestickChart } from '@/components/chart/CandlestickChart';
import { ChartControlPanel } from '@/components/chart/ChartControlPanel';
import { OrderTicket } from '@/components/trading/OrderTicket';

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 pb-10">
        <section className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(18rem,1.2fr)]">
          <div className="min-w-0">
            <CandlestickChart />
          </div>
          <div className="flex flex-col gap-6 xl:min-w-[18rem]">
            <ChartControlPanel />
            <OrderTicket />
          </div>
        </section>
        <section className="grid gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <h2 className="text-base font-semibold text-zinc-100">실시간 지표 패널</h2>
          <p className="text-sm text-zinc-400">
            차트에서 계산된 RSI, MACD, DMI 값을 활용하여 전략별 경고 시스템을 구성할 수 있습니다. Supabase
            연동 이후에는 계정별 백테스트 및 실거래 성과를 이 영역에 배치할 예정입니다.
          </p>
        </section>
      </main>
    </div>
  );
}
