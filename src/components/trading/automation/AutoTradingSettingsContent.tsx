'use client';

import { AutoTradingConsentGate } from './AutoTradingConsentGate';
import { ToastProvider } from '@/components/common/ToastProvider';
import { AutoTradingGuideMenu } from './AutoTradingGuideMenu';
import { StrategySelector } from './StrategySelector';
import { AutoTradingSettingsForm } from './AutoTradingSettingsForm';
import { StickyActionBar } from './StickyActionBar';

export function AutoTradingSettingsContent() {
  return (
    <AutoTradingConsentGate>
      <ToastProvider>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-24 md:gap-5 md:px-6">
          <AutoTradingGuideMenu />
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-100">자동매매 설정</h2>
            <StrategySelector />
          </div>
          <AutoTradingSettingsForm />
        </div>
        <StickyActionBar />
      </ToastProvider>
    </AutoTradingConsentGate>
  );
}
