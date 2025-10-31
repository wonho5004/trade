'use client';

import { useState } from 'react';
import type { AutoTradingSettings } from '@/types/trading/auto-trading';
import { collectIndicatorNodes } from '@/lib/trading/conditionsTree';
import { formatEntrySettings } from '@/lib/trading/settingsSummary';

interface SettingsConfirmModalProps {
  settings: AutoTradingSettings;
  onConfirm: () => void;
  onCancel: () => void;
  isOpen: boolean;
}

export function SettingsConfirmModal({ settings, onConfirm, onCancel, isOpen }: SettingsConfirmModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'details'>('summary');

  if (!isOpen) return null;

  // 진입 조건 상세 정보 수집
  const longEntryIndicators = settings.entry.long.indicators
    ? collectIndicatorNodes(settings.entry.long.indicators.root as any)
    : [];
  const shortEntryIndicators = settings.entry.short.indicators
    ? collectIndicatorNodes(settings.entry.short.indicators.root as any)
    : [];

  // 경고 메시지 수집
  const warnings: string[] = [];
  if (settings.entry.long.enabled && longEntryIndicators.length === 0) {
    warnings.push('롱 진입이 활성화되었지만 지표가 없습니다.');
  }
  if (settings.entry.short.enabled && shortEntryIndicators.length === 0) {
    warnings.push('숏 진입이 활성화되었지만 지표가 없습니다.');
  }
  if (!settings.logicName || settings.logicName.trim() === '') {
    warnings.push('전략 이름이 설정되지 않았습니다.');
  }

  // DMI 지표 상세 정보 추출
  const getDMIDetails = (indicators: any[]) => {
    return indicators
      .filter((node) => node.indicator?.type === 'dmi')
      .map((node) => {
        const config = node.indicator?.config;
        if (!config) return null;

        const details: string[] = [];

        // ADX 조건
        if (config.adx && config.adx.enabled) {
          const comp = config.adx.comparator === 'over' ? '>' : config.adx.comparator === 'under' ? '<' : '=';
          details.push(`ADX ${comp} ${config.adx.value || 25}`);
        }

        // DI 비교
        if (config.diComparison) {
          if (config.diComparison === 'plus_over_minus') {
            details.push('DI+ > DI-');
          } else if (config.diComparison === 'minus_over_plus') {
            details.push('DI- > DI+');
          }
        }

        // ADX vs DI 비교
        if (config.adxVsDi) {
          if (config.adxVsDi === 'adx_gt_di_plus') {
            details.push('ADX > DI+');
          } else if (config.adxVsDi === 'adx_lt_di_plus') {
            details.push('DI+ > ADX');
          } else if (config.adxVsDi === 'adx_gt_di_minus') {
            details.push('ADX > DI-');
          } else if (config.adxVsDi === 'adx_lt_di_minus') {
            details.push('DI- > ADX');
          }
        }

        return details.length > 0 ? `DMI: ${details.join(' AND ')}` : null;
      })
      .filter(Boolean);
  };

  const longDMI = getDMIDetails(longEntryIndicators);
  const shortDMI = getDMIDetails(shortEntryIndicators);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-700 p-4">
          <h2 className="text-lg font-semibold text-zinc-100">설정 확인</h2>
          <button
            onClick={onCancel}
            className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-700">
          <button
            onClick={() => setActiveTab('summary')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'summary'
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            요약
          </button>
          <button
            onClick={() => setActiveTab('details')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'details'
                ? 'border-b-2 border-emerald-500 text-emerald-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            상세 정보
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[calc(90vh-12rem)] overflow-y-auto p-4">
          {/* 경고 메시지 */}
          {warnings.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-400">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                주의사항
              </h3>
              <ul className="list-disc pl-5 text-xs text-amber-300/90">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === 'summary' ? (
            <div className="space-y-4">
              {/* 기본 설정 */}
              <section className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-zinc-100">기본 설정</h3>
                <dl className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">전략 이름:</dt>
                    <dd className="font-medium text-zinc-200">{settings.logicName || '-'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">타임프레임:</dt>
                    <dd className="font-medium text-zinc-200">{settings.timeframe}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">레버리지:</dt>
                    <dd className="font-medium text-zinc-200">{settings.leverage}x</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">종목 수:</dt>
                    <dd className="font-medium text-zinc-200">{settings.symbolCount}개</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">포지션 모드:</dt>
                    <dd className="font-medium text-zinc-200">
                      {settings.positionMode === 'one_way' ? 'One-Way(단방향)' : 'Hedge(양방향)'}
                    </dd>
                  </div>
                </dl>
              </section>

              {/* 진입 조건 */}
              <section className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-zinc-100">진입 조건</h3>
                <div className="space-y-3">
                  <div>
                    <h4 className="mb-1 text-xs font-medium text-emerald-400">롱 진입</h4>
                    {settings.entry.long.enabled ? (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-300">
                          지표: {longEntryIndicators.length}개
                          {settings.entry.long.immediate && <span className="ml-2 text-amber-400">(즉시 진입)</span>}
                        </p>
                        {longDMI.length > 0 && (
                          <div className="rounded border border-emerald-600/30 bg-emerald-950/30 p-2">
                            {longDMI.map((dmi, index) => (
                              <p key={index} className="text-xs text-emerald-300">{dmi}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">비활성화</p>
                    )}
                  </div>
                  <div>
                    <h4 className="mb-1 text-xs font-medium text-red-400">숏 진입</h4>
                    {settings.entry.short.enabled ? (
                      <div className="space-y-1">
                        <p className="text-xs text-zinc-300">
                          지표: {shortEntryIndicators.length}개
                          {settings.entry.short.immediate && <span className="ml-2 text-amber-400">(즉시 진입)</span>}
                        </p>
                        {shortDMI.length > 0 && (
                          <div className="rounded border border-red-600/30 bg-red-950/30 p-2">
                            {shortDMI.map((dmi, index) => (
                              <p key={index} className="text-xs text-red-300">{dmi}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-zinc-500">비활성화</p>
                    )}
                  </div>
                </div>
              </section>

              {/* 자본 설정 */}
              <section className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-zinc-100">자본 설정</h3>
                <dl className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">최대 마진:</dt>
                    <dd className="font-medium text-zinc-200">
                      {settings.capital.maxMargin.percentage}% ({settings.capital.maxMargin.basis})
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">초기 진입:</dt>
                    <dd className="font-medium text-zinc-200">
                      {settings.capital.initialMargin.percentage}% ({settings.capital.initialMargin.mode})
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-zinc-400">추가 매수 예산:</dt>
                    <dd className="font-medium text-zinc-200">
                      {settings.capital.scaleInBudget.percentage}% ({settings.capital.scaleInBudget.mode})
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-zinc-100">전체 설정 (JSON)</h3>
                <pre className="max-h-96 overflow-auto rounded bg-zinc-950 p-2 text-xs text-zinc-300">
                  {JSON.stringify(settings, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-700 p-4">
          <button
            onClick={onCancel}
            className="rounded border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-700"
          >
            수정하기
          </button>
          <button
            onClick={onConfirm}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            확인 후 저장
          </button>
        </div>
      </div>
    </div>
  );
}
