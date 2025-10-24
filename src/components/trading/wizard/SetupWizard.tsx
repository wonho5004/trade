'use client';

import React, { useState } from 'react';
import type { WizardStep, ExperienceLevel, RiskPreference, RecommendedSettings } from '@/types/trading/setup-wizard';
import { getRecommendedSettings } from '@/lib/trading/wizard-recommendations';
import { WelcomeStep } from './WelcomeStep';
import { ExperienceStep } from './ExperienceStep';
import { RecommendationStep } from './RecommendationStep';
import { CompleteStep } from './CompleteStep';

interface SetupWizardProps {
  /** 위저드 닫기 콜백 */
  onClose: () => void;
  /** 설정 적용 콜백 */
  onApplySettings: (settings: RecommendedSettings) => void;
  /** 초기 표시 여부 */
  isOpen: boolean;
}

/**
 * 자동매매 설정 마법사 (Setup Wizard)
 * - 신규 사용자를 위한 단계별 가이드
 * - 경험/리스크 기반 추천 설정
 */
export const SetupWizard: React.FC<SetupWizardProps> = ({ onClose, onApplySettings, isOpen }) => {
  const [currentStep, setCurrentStep] = useState<WizardStep>('welcome');
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskPreference | null>(null);
  const [recommendedSettings, setRecommendedSettings] = useState<RecommendedSettings | null>(null);

  if (!isOpen) return null;

  const handleExperienceNext = (experience: ExperienceLevel, risk: RiskPreference) => {
    setSelectedExperience(experience);
    setSelectedRisk(risk);
    const settings = getRecommendedSettings(experience, risk);
    setRecommendedSettings(settings);
    setCurrentStep('recommendation');
  };

  const handleApplySettings = () => {
    if (recommendedSettings) {
      onApplySettings(recommendedSettings);
      setCurrentStep('complete');
    }
  };

  const handleComplete = () => {
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'experience') {
      setCurrentStep('welcome');
    } else if (currentStep === 'recommendation') {
      setCurrentStep('experience');
    }
  };

  // 진행률 계산
  const stepOrder: WizardStep[] = ['welcome', 'experience', 'recommendation', 'complete'];
  const currentStepIndex = stepOrder.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / stepOrder.length) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* 진행률 바 */}
        <div className="sticky top-0 z-10 bg-zinc-900">
          <div className="h-1 bg-zinc-800">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 닫기 버튼 (완료 단계가 아닐 때만) */}
          {currentStep !== 'complete' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-zinc-800 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 컨텐츠 */}
        <div className="p-8">
          {currentStep === 'welcome' && (
            <WelcomeStep onNext={() => setCurrentStep('experience')} />
          )}

          {currentStep === 'experience' && (
            <ExperienceStep
              onNext={handleExperienceNext}
              onBack={handleBack}
            />
          )}

          {currentStep === 'recommendation' && recommendedSettings && (
            <RecommendationStep
              settings={recommendedSettings}
              onNext={handleApplySettings}
              onBack={handleBack}
            />
          )}

          {currentStep === 'complete' && recommendedSettings && (
            <CompleteStep
              settings={recommendedSettings}
              onClose={handleComplete}
            />
          )}
        </div>
      </div>
    </div>
  );
};
