'use client';

import { AutoTradingConsentGate } from './AutoTradingConsentGate';
import { ToastProvider } from '@/components/common/ToastProvider';
import { AutoTradingGuideMenu } from './AutoTradingGuideMenu';
import { AutoTradingSettingsForm } from './AutoTradingSettingsForm';

export function AutoTradingSettingsContent() {
  return (
    <AutoTradingConsentGate>
      <ToastProvider>
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 pb-12 md:gap-5 md:px-6">
          <AutoTradingGuideMenu />
          <AutoTradingSettingsForm />
        </div>
      </ToastProvider>
    </AutoTradingConsentGate>
  );
}
