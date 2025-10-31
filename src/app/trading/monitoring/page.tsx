import { AppHeader } from '@/components/common/AppHeader';
import { MonitoringDashboard } from '@/components/trading/monitoring/MonitoringDashboard';

export default function MonitoringPage() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-950">
      <AppHeader />
      <main className="flex-1">
        <MonitoringDashboard />
      </main>
    </div>
  );
}
