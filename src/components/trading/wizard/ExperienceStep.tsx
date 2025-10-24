'use client';

import React, { useState } from 'react';
import type { ExperienceLevel, RiskPreference } from '@/types/trading/setup-wizard';
import { experienceLevelDescriptions, riskPreferenceDescriptions } from '@/lib/trading/wizard-recommendations';

interface ExperienceStepProps {
  onNext: (experience: ExperienceLevel, risk: RiskPreference) => void;
  onBack: () => void;
}

/**
 * 경험 수준 및 리스크 선호도 선택 단계
 */
export const ExperienceStep: React.FC<ExperienceStepProps> = ({ onNext, onBack }) => {
  const [selectedExperience, setSelectedExperience] = useState<ExperienceLevel | null>(null);
  const [selectedRisk, setSelectedRisk] = useState<RiskPreference | null>(null);

  const handleNext = () => {
    if (selectedExperience && selectedRisk) {
      onNext(selectedExperience, selectedRisk);
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h2 className="text-xl font-bold text-zinc-100 mb-2">투자 프로필 설정</h2>
        <p className="text-sm text-zinc-400">
          당신에게 맞는 추천 설정을 위해 두 가지 질문에 답해주세요
        </p>
      </div>

      {/* 투자 경험 선택 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-200">
          1. 선물 거래 경험이 어느 정도인가요?
        </label>
        <div className="grid grid-cols-1 gap-3">
          {(Object.keys(experienceLevelDescriptions) as ExperienceLevel[]).map((level) => {
            const info = experienceLevelDescriptions[level];
            const isSelected = selectedExperience === level;
            return (
              <button
                key={level}
                onClick={() => setSelectedExperience(level)}
                className={`
                  text-left rounded-lg border-2 p-4 transition-all
                  ${isSelected
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-semibold ${isSelected ? 'text-blue-300' : 'text-zinc-200'}`}>
                    {info.title}
                  </h3>
                  {isSelected && (
                    <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mb-2">{info.description}</p>
                <ul className="space-y-1">
                  {info.examples.map((example, idx) => (
                    <li key={idx} className="text-xs text-zinc-500 flex items-start gap-1">
                      <span className="text-zinc-600">•</span>
                      <span>{example}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* 리스크 선호도 선택 */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-zinc-200">
          2. 투자 성향은 어떤가요?
        </label>
        <div className="grid grid-cols-1 gap-3">
          {(Object.keys(riskPreferenceDescriptions) as RiskPreference[]).map((risk) => {
            const info = riskPreferenceDescriptions[risk];
            const isSelected = selectedRisk === risk;
            return (
              <button
                key={risk}
                onClick={() => setSelectedRisk(risk)}
                className={`
                  text-left rounded-lg border-2 p-4 transition-all
                  ${isSelected
                    ? 'border-green-500 bg-green-500/10'
                    : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`font-semibold ${isSelected ? 'text-green-300' : 'text-zinc-200'}`}>
                    {info.title}
                  </h3>
                  {isSelected && (
                    <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mb-2">{info.description}</p>
                <ul className="space-y-1">
                  {info.characteristics.map((char, idx) => (
                    <li key={idx} className="text-xs text-zinc-500 flex items-start gap-1">
                      <span className="text-zinc-600">•</span>
                      <span>{char}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-between pt-4">
        <button
          onClick={onBack}
          className="px-6 py-2 border border-zinc-600 text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          이전
        </button>
        <button
          onClick={handleNext}
          disabled={!selectedExperience || !selectedRisk}
          className={`
            px-6 py-2 rounded-lg font-medium transition-colors
            ${selectedExperience && selectedRisk
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }
          `}
        >
          다음
        </button>
      </div>
    </div>
  );
};
