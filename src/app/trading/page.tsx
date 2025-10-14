import { AppHeader } from '@/components/common/AppHeader';
import { OrderTicket } from '@/components/trading/OrderTicket';
import { TickerPanel } from '@/components/trading/TickerPanel';

export default function TradingPage() {
  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 pb-10">
        <section className="grid gap-6 md:grid-cols-[3fr,2fr]">
          <TickerPanel />
          <OrderTicket />
        </section>
      </main>
    </div>
  );
}
