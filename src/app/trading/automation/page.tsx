import { AppHeader } from '@/components/common/AppHeader';
import { AutoTradingSettingsContent } from '@/components/trading/automation/AutoTradingSettingsContent';

export default function AutoTradingAutomationPage() {
  return (
    <div className="flex min-h-screen flex-col gap-6 bg-zinc-950 text-zinc-100">
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6">
        <AutoTradingSettingsContent />
      </main>
    </div>
  );
}
