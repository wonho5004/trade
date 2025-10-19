'use client';

import { useMemo } from 'react';
import type { AutoTradingSettings, ConditionGroupNode, ConditionNode, IndicatorConditions } from '@/types/trading/auto-trading';
import { collectGroupNodes, collectIndicatorNodes } from '@/lib/trading/conditionsTree';

function groupsCount(conds?: IndicatorConditions | null) {
  if (!conds || !conds.root) return { groups: 0, indicators: 0 };
  const root = conds.root as unknown as ConditionNode;
  const groups = collectGroupNodes(root).length;
  const indicators = collectIndicatorNodes(root).length;
  return { groups, indicators };
}

function pct(value?: number) {
  if (typeof value !== 'number' || !isFinite(value)) return '-';
  return `${value}%`;
}

export function LogicSummary({ settings }: { settings: AutoTradingSettings }) {
  const s = settings;

  const symSummary = useMemo(() => {
    const manual = s.symbolSelection.manualSymbols.length;
    const excluded = s.symbolSelection.excludedSymbols.length;
    const ranking = Object.entries(s.symbolSelection.ranking).filter(([, v]) => typeof v === 'number' && (v as number) > 0).length;
    const overrides = Object.keys(s.symbolSelection.leverageOverrides).length;
    return { manual, excluded, ranking, overrides };
  }, [s.symbolSelection]);

  const entryLong = groupsCount(s.entry.long.indicators);
  const entryShort = groupsCount(s.entry.short.indicators);
  const scaleLong = groupsCount(s.scaleIn.long.indicators);
  const scaleShort = groupsCount(s.scaleIn.short.indicators);
  const hedgeSum = groupsCount(s.hedgeActivation.indicators);
  const exitLong = groupsCount(s.exit.long.indicators);
  const exitShort = groupsCount(s.exit.short.indicators);
  const stopSum = groupsCount(s.stopLoss.stopLossLine.indicators);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">로직 요약</h3>
        <span className="text-[11px] text-zinc-400">저장/생성 전 최종 확인</span>
      </header>
      <ul className="space-y-1 text-[12px] leading-5 text-zinc-300">
        <li>
          <strong className="text-zinc-100">기본 설정</strong> — 이름: {s.logicName || '-'}, 프레임: {s.timeframe}, 레버리지: {s.leverage}x, 종목 수: {s.symbolCount},
          자산: {s.assetMode === 'single' ? 'Single' : 'Multi'}, 포지션: {s.positionMode === 'one_way' ? 'One-Way' : 'Hedge'}
        </li>
        <li>
          <strong className="text-zinc-100">종목 선택</strong> — 수동 {symSummary.manual}개, 제외 {symSummary.excluded}개, 랭킹 {symSummary.ranking}항목, 레버리지 {s.symbolSelection.leverageMode === 'custom' ? `종목별(${symSummary.overrides})` : '일괄'}
        </li>
        <li>
          <strong className="text-zinc-100">포지션 진입</strong> — 롱 {s.entry.long.enabled ? `${entryLong.groups}그룹/${entryLong.indicators}지표` : '비활성'}, 숏 {s.entry.short.enabled ? `${entryShort.groups}그룹/${entryShort.indicators}지표` : '비활성'}
        </li>
        <li>
          <strong className="text-zinc-100">추가 매수</strong> — 롱 {s.scaleIn.long.enabled ? `${scaleLong.groups}그룹/${scaleLong.indicators}지표, 수익율 ${s.scaleIn.long.profitTarget.enabled ? pct(s.scaleIn.long.profitTarget.value) : '-'}` : '비활성'}, 숏 {s.scaleIn.short.enabled ? `${scaleShort.groups}그룹/${scaleShort.indicators}지표, 수익율 ${s.scaleIn.short.profitTarget.enabled ? pct(s.scaleIn.short.profitTarget.value) : '-'}` : '비활성'}
        </li>
        <li>
          <strong className="text-zinc-100">헤지 활성화</strong> — {s.hedgeActivation.enabled ? `${hedgeSum.groups}그룹/${hedgeSum.indicators}지표, 방향 ${s.hedgeActivation.directions.join('/')}` : '비활성'}
        </li>
        <li>
          <strong className="text-zinc-100">포지션 정리(매도)</strong> — 롱 {s.exit.long.enabled ? `${exitLong.groups}그룹/${exitLong.indicators}지표, 목표 ${s.exit.long.profitTarget.enabled ? pct(s.exit.long.profitTarget.value) : '-'}` : '비활성'}, 숏 {s.exit.short.enabled ? `${exitShort.groups}그룹/${exitShort.indicators}지표, 목표 ${s.exit.short.profitTarget.enabled ? pct(s.exit.short.profitTarget.value) : '-'}` : '비활성'}
        </li>
        <li>
          <strong className="text-zinc-100">포지션 포기(손절)</strong> — 손절 수익율 {s.stopLoss.profitTarget.enabled ? pct(s.stopLoss.profitTarget.value) : '-'}, 매수횟수 {s.stopLoss.purchaseCount.enabled ? `${s.stopLoss.purchaseCount.comparator === 'over' ? '≥' : '≤'} ${s.stopLoss.purchaseCount.value}` : '-'}, Stoploss 라인 {s.stopLoss.stopLossLine.enabled ? `${stopSum.groups}그룹/${stopSum.indicators}지표` : '비활성'}
        </li>
      </ul>
    </section>
  );
}

