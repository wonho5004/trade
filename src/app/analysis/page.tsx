import { AppHeader } from '@/components/common/AppHeader';
import { calculateDrawdown, calculateCumulativePnL } from '@/lib/analysis/metrics';

const sampleEquity = [
  { timestamp: 1_718_000_000_000, balance: 10_000 },
  { timestamp: 1_718_086_400_000, balance: 9_600 },
  { timestamp: 1_718_172_800_000, balance: 10_400 }
];

export default function AnalysisPage() {
  const drawdown = calculateDrawdown(sampleEquity);
  const pnl = calculateCumulativePnL(sampleEquity);

  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 pb-10">
        <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-6">
          <h1 className="text-lg font-semibold text-zinc-100">성과 요약</h1>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">누적 손익</p>
              <p className="text-xl font-semibold text-emerald-400">{pnl.toLocaleString('ko-KR')} USDT</p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
              <p className="text-xs text-zinc-500">최대 낙폭</p>
              <p className="text-xl font-semibold text-rose-400">{(drawdown * 100).toFixed(2)}%</p>
            </div>
          </div>
          <p className="mt-6 text-sm text-zinc-400">
            Python 백테스트 결과를 Supabase에 저장한 뒤 이 화면에서 시각화할 예정입니다.
          </p>
        </section>
      </main>
    </div>
  );
}
