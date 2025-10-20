'use client';

import { useMemo, useState } from 'react';
import type { AutoTradingSettings, ConditionNode, IndicatorConditions } from '@/types/trading/auto-trading';
import { collectGroupNodes, collectIndicatorNodes } from '@/lib/trading/conditionsTree';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { useAutoTradingSettingsStore } from '@/stores/autoTradingSettingsStore';
import { useOptionalToast } from '@/components/common/ToastProvider';

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

function chip(text: string, title?: string) {
  return (
    <span
      title={title}
      className="rounded border border-zinc-700 bg-zinc-900 px-1 py-0.5 text-[11px] text-zinc-300"
    >
      {text}
    </span>
  );
}

function useSectionNavigator() {
  const setCollapsed = useUIPreferencesStore((s) => s.setCollapsed);
  return (key: string) => {
    try {
      setCollapsed(key, false);
      const el = document.getElementById(`section-${key}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {}
  };
}

function linkChip(text: string, key: string, go: (k: string) => void, title?: string) {
  return (
    <button
      type="button"
      onClick={() => go(key)}
      title={title}
      className="rounded border border-emerald-600/50 bg-zinc-900 px-1 py-0.5 text-[11px] text-emerald-200 hover:border-emerald-400"
    >
      {text}
    </button>
  );
}

export function LogicSummary({ settings }: { settings: AutoTradingSettings }) {
  const s = settings;
  const go = useSectionNavigator();
  const updateSettings = useAutoTradingSettingsStore((st) => st.updateSettings);
  const { show } = useOptionalToast();
  const [detail, setDetail] = useState<{ key: string; title: string } | null>(null);

  const symSummary = useMemo(() => {
    const manual = s.symbolSelection.manualSymbols.length;
    const excluded = s.symbolSelection.excludedSymbols.length;
    const rankingEntries = Object.entries(s.symbolSelection.ranking).filter(([, v]) => typeof v === 'number' && (v as number) > 0);
    const ranking = rankingEntries.length;
    const rankingList = rankingEntries.map(([k, v]) => `${k}:${v}`).join(', ');
    const overrides = Object.keys(s.symbolSelection.leverageOverrides).length;
    return { manual, excluded, ranking, rankingList, overrides };
  }, [s.symbolSelection]);
  
  const entryLong = groupsCount(s.entry.long.indicators);
  const entryShort = groupsCount(s.entry.short.indicators);
  const scaleLong = groupsCount(s.scaleIn.long.indicators);
  const scaleShort = groupsCount(s.scaleIn.short.indicators);
  const hedgeSum = groupsCount(s.hedgeActivation.indicators);
  const exitLong = groupsCount(s.exit.long.indicators);
  const exitShort = groupsCount(s.exit.short.indicators);
  const stopSum = groupsCount(s.stopLoss.stopLossLine.indicators);

  const warnings: string[] = [];
  if (s.entry.long.enabled && entryLong.groups === 0 && entryLong.indicators === 0) warnings.push('롱 진입이 활성화되었지만 지표 그룹이 없습니다.');
  if (s.entry.short.enabled && entryShort.groups === 0 && entryShort.indicators === 0) warnings.push('숏 진입이 활성화되었지만 지표 그룹이 없습니다.');
  if (s.exit.long.enabled && exitLong.groups === 0 && exitLong.indicators === 0) warnings.push('롱 청산이 활성화되었지만 지표 그룹이 없습니다.');
  if (s.exit.short.enabled && exitShort.groups === 0 && exitShort.indicators === 0) warnings.push('숏 청산이 활성화되었지만 지표 그룹이 없습니다.');
  if (s.stopLoss.stopLossLine.enabled && stopSum.groups === 0) warnings.push('Stoploss 라인이 활성화되었지만 지표 그룹이 없습니다.');
  if (s.positionMode === 'one_way' && s.hedgeActivation.enabled) warnings.push('One-Way 모드에서 헤지 활성화 설정이 켜져 있습니다.');

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <header className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">로직 요약</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200"
            onClick={() => setDetail({ key: 'base', title: '기본 설정 상세' })}
          >
            상세 보기
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200"
            onClick={() => {
              try {
                const payload = buildJsonSummary(s, { entryLong, entryShort, scaleLong, scaleShort, hedgeSum, exitLong, exitShort, stopSum });
                const text = JSON.stringify(payload, null, 2);
                void navigator.clipboard.writeText(text);
                show({ title: '요약(JSON) 복사 완료', type: 'success' });
              } catch (e) {
                show({ title: '복사 실패', description: e instanceof Error ? e.message : String(e), type: 'error' });
              }
            }}
          >
            요약 복사(JSON)
          </button>
          <button
            type="button"
            className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200"
            onClick={() => {
              try {
                const md = buildMarkdownSummary(s, { entryLong, entryShort, scaleLong, scaleShort, hedgeSum, exitLong, exitShort, stopSum });
                void navigator.clipboard.writeText(md);
                show({ title: '요약(MD) 복사 완료', type: 'success' });
              } catch (e) {
                show({ title: '복사 실패', description: e instanceof Error ? e.message : String(e), type: 'error' });
              }
            }}
          >
            요약 복사(MD)
          </button>
        </div>
      </header>

      {/* Storyline timeline */}
      <ol className="space-y-2">
        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-emerald-500/60" aria-label="기본 설정">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">1) 기본 설정</span>
            {chip(`이름 ${s.logicName || '-'}`, '전략 이름')}
            {chip(`프레임 ${s.timeframe}`, '캔들 인터벌')}
            {chip(`레버리지 ${s.leverage}x`, '기본 레버리지')}
            {chip(`종목 ${s.symbolCount}개`, '타겟 종목 수')}
            {chip(`자산 ${s.assetMode === 'single' ? 'Single' : 'Multi'}`, '증거금 자산 모드')}
            {chip(`포지션 ${s.positionMode === 'one_way' ? 'One-Way' : 'Hedge'}`, '계정 포지션 모드')}
            <button className="ml-2 rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'base', title: '기본 설정 상세' })}>상세</button>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">
            자본 제한: 최대 마진 {s.capital.maxMargin.percentage}% ({s.capital.maxMargin.basis}) · 초기 진입 {s.capital.initialMargin.mode} {s.capital.initialMargin.percentage}% 최소 {s.capital.initialMargin.minNotional} USDT
          </div>
          <div className="mt-2">
            <StackedBar
              title="자본/리스크 구성"
              segments={[
                { label: '초기', value: clampPct(s.capital.initialMargin.percentage), color: 'emerald' },
                { label: '추매', value: clampPct(s.capital.scaleInBudget.percentage), color: 'sky' },
                { label: '여유', value: clampPct(Math.max(0, s.capital.maxMargin.percentage - s.capital.initialMargin.percentage - s.capital.scaleInBudget.percentage)), color: 'zinc' }
              ]}
              total={clampPct(s.capital.maxMargin.percentage)}
            />
          </div>
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-sky-500/60" aria-label="종목 선택">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">2) 종목 선택</span>
            {linkChip(`수동 ${symSummary.manual}`, 'symbols', go, s.symbolSelection.manualSymbols.slice(0, 6).join(', ') || undefined)}
            {linkChip(`제외 ${symSummary.excluded}`, 'symbols', go, s.symbolSelection.excludedSymbols.slice(0, 6).join(', ') || undefined)}
            {linkChip(`랭킹 ${symSummary.ranking}`, 'symbols', go, symSummary.rankingList || undefined)}
            {s.symbolSelection.leverageMode === 'custom'
              ? linkChip(`개별 레버리지 ${symSummary.overrides}`, 'symbols', go, '심볼별 레버리지 오버라이드 수')
              : chip('일괄 레버리지', '모든 심볼 동일 레버리지')}
            <button className="ml-2 rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'symbols', title: '종목 선택 상세' })}>상세</button>
          </div>
          {symSummary.ranking > 0 && <div className="mt-1 truncate text-[11px] text-zinc-500">랭킹 기준: {symSummary.rankingList}</div>}
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-amber-500/60" aria-label="진입">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">3) 진입</span>
            {linkChip(`롱 ${s.entry.long.enabled ? `${entryLong.groups}그룹/${entryLong.indicators}지표` : 'OFF'}`, 'entry', go, '롱 진입 조건 개요')}
            {linkChip(`숏 ${s.entry.short.enabled ? `${entryShort.groups}그룹/${entryShort.indicators}지표` : 'OFF'}`, 'entry', go, '숏 진입 조건 개요')}
            {s.entry.long.immediate || s.entry.short.immediate ? chip(`즉시매수 ${[s.entry.long.immediate?'롱':'' , s.entry.short.immediate?'숏':''].filter(Boolean).join('/')}`, '지표 무관 즉시 진입') : null}
            <span className="ml-2 inline-flex items-center gap-1">
              <button title="롱 진입 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.entry.long.enabled = !d.entry.long.enabled; })}>{s.entry.long.enabled ? '롱 ON' : '롱 OFF'}</button>
              <button title="숏 진입 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.entry.short.enabled = !d.entry.short.enabled; })}>{s.entry.short.enabled ? '숏 ON' : '숏 OFF'}</button>
              <button title="즉시매수(롱) 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.entry.long.immediate = !d.entry.long.immediate; })}>{s.entry.long.immediate ? '즉시 롱 ON' : '즉시 롱 OFF'}</button>
              <button title="즉시매수(숏) 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.entry.short.immediate = !d.entry.short.immediate; })}>{s.entry.short.immediate ? '즉시 숏 ON' : '즉시 숏 OFF'}</button>
              <button className="rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'entry', title: '진입 상세' })}>상세</button>
            </span>
          </div>
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-amber-500/60" aria-label="추가 매수">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">4) 추가 매수</span>
            {linkChip(`롱 ${s.scaleIn.long.enabled ? `${scaleLong.groups}/${scaleLong.indicators}` : 'OFF'}`, 'scaleIn', go, '롱 추가 매수 조건 개요')}
            {linkChip(`숏 ${s.scaleIn.short.enabled ? `${scaleShort.groups}/${scaleShort.indicators}` : 'OFF'}`, 'scaleIn', go, '숏 추가 매수 조건 개요')}
            {chip(`목표 ${s.scaleIn.long.profitTarget.enabled || s.scaleIn.short.profitTarget.enabled ? `${s.scaleIn.long.profitTarget.enabled?pct(s.scaleIn.long.profitTarget.value):'-'}/${s.scaleIn.short.profitTarget.enabled?pct(s.scaleIn.short.profitTarget.value):'-'}` : '-'}`, '현재 수익률 기준')}
            <span className="ml-2 inline-flex items-center gap-1">
              <button title="롱 추가매수 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.scaleIn.long.enabled = !d.scaleIn.long.enabled; })}>{s.scaleIn.long.enabled ? '롱 ON' : '롱 OFF'}</button>
              <button title="숏 추가매수 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.scaleIn.short.enabled = !d.scaleIn.short.enabled; })}>{s.scaleIn.short.enabled ? '숏 ON' : '숏 OFF'}</button>
              <button className="rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'scaleIn', title: '추가 매수 상세' })}>상세</button>
            </span>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-400">
            <MiniBar label="초기" value={s.capital.initialMargin.percentage} title="초기 진입 비중(%)" />
            <MiniBar label="추매" value={s.capital.scaleInBudget.percentage} title="추가 매수 예산(%)" />
          </div>
          </div>
          <div className="mt-1 text-[11px] text-zinc-500">예산: {s.capital.scaleInBudget.mode} {s.capital.scaleInBudget.percentage}% (basis {s.capital.scaleInBudget.basis}) · 최소노미널 {s.capital.scaleInBudget.minNotional}</div>
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-fuchsia-500/60" aria-label="헤지">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">5) 헤지</span>
            {linkChip(s.hedgeActivation.enabled ? `${hedgeSum.groups}그룹/${hedgeSum.indicators}지표` : 'OFF', 'hedge', go, '헤지 활성화 조건 개요')} {s.hedgeActivation.enabled ? chip(`방향 ${s.hedgeActivation.directions.join('/')}`, '헤지 방향') : null}
            <button title="헤지 토글" className="ml-2 rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.hedgeActivation.enabled = !d.hedgeActivation.enabled; })}>{s.hedgeActivation.enabled ? '헤지 ON' : '헤지 OFF'}</button>
            <button className="ml-1 rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'hedge', title: '헤지 상세' })}>상세</button>
          </div>
          {(() => {
            const hb = s.capital.hedgeBudget;
            if (!hb) return null;
            const fmtDir = (d: any) => {
              if (!d) return '-';
              if (d.mode === 'usdt') return `${d.asset ?? 'USDT'} ${d.amount ?? 0}`;
              if (d.mode === 'balance_percentage') return `${d.basis ?? 'wallet'} ${d.percentage ?? 0}%`;
              if (d.mode === 'per_symbol_percentage') return `${d.basis ?? 'wallet'} 종목당 ${d.percentage ?? 0}%`;
              if (d.mode === 'position_percent') return `포지션 ${d.percentage ?? 0}%`;
              if (d.mode === 'initial_percent') return `최초 ${d.percentage ?? 0}%`;
              if (d.mode === 'min_notional') return `최소주문단위`;
              return '-';
            };
            return (
              <div className="mt-1 text-[11px] text-zinc-500">
                금액: {hb.separateByDirection ? `롱 ${fmtDir(hb.long)} / 숏 ${fmtDir(hb.short)}` : `공통 ${fmtDir(hb.long)}`}
              </div>
            );
          })()}
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-rose-500/60" aria-label="청산">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">6) 청산</span>
            {linkChip(`롱 ${s.exit.long.enabled ? `${exitLong.groups}/${exitLong.indicators}` : 'OFF'} · 목표 ${s.exit.long.profitTarget.enabled ? pct(s.exit.long.profitTarget.value) : '-'}`, 'exit', go, '롱 청산 조건 개요')} {linkChip(`숏 ${s.exit.short.enabled ? `${exitShort.groups}/${exitShort.indicators}` : 'OFF'} · 목표 ${s.exit.short.profitTarget.enabled ? pct(s.exit.short.profitTarget.value) : '-'}`, 'exit', go, '숏 청산 조건 개요')} {s.exit.long.includeFeesFunding || s.exit.short.includeFeesFunding ? chip('수수료/펀딩 고려', '실현/미실현 계산에 수수료/펀딩 반영') : null}
            <span className="ml-2 inline-flex items-center gap-1">
              <button title="롱 청산 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.exit.long.enabled = !d.exit.long.enabled; })}>{s.exit.long.enabled ? '롱 ON' : '롱 OFF'}</button>
              <button title="숏 청산 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.exit.short.enabled = !d.exit.short.enabled; })}>{s.exit.short.enabled ? '숏 ON' : '숏 OFF'}</button>
              <button title="수수료/펀딩 고려 토글" className="rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.exit.long.includeFeesFunding = !d.exit.long.includeFeesFunding; d.exit.short.includeFeesFunding = d.exit.long.includeFeesFunding; })}>{s.exit.long.includeFeesFunding || s.exit.short.includeFeesFunding ? '수/펀 ON' : '수/펀 OFF'}</button>
              <button className="rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'exit', title: '청산 상세' })}>상세</button>
            </span>
          <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-400">
            <MiniBar label="롱목표" value={s.exit.long.profitTarget.enabled ? s.exit.long.profitTarget.value : 0} title="롱 목표 수익률(%)" color="emerald" />
            <MiniBar label="숏목표" value={s.exit.short.profitTarget.enabled ? s.exit.short.profitTarget.value : 0} title="숏 목표 수익률(%)" color="rose" />
          </div>
          </div>
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-rose-500/60" aria-label="손절">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">7) 손절</span>
            {linkChip(`손절 ${s.stopLoss.profitTarget.enabled ? pct(s.stopLoss.profitTarget.value) : '-'}`, 'stopLoss', go, '손절 수익률 기준')}
            {chip(`매수횟수 ${s.stopLoss.purchaseCount.enabled ? `${s.stopLoss.purchaseCount.comparator === 'over' ? '≥' : '≤'} ${s.stopLoss.purchaseCount.value}` : '-'}`, '누적 매수 횟수 기준')}
            {linkChip(`Stoploss 라인 ${s.stopLoss.stopLossLine.enabled ? `${stopSum.groups}/${stopSum.indicators}` : 'OFF'}`, 'stopLoss', go, '지표 기반 손절 라인')}
            <button title="Stoploss 라인 토글" className="ml-2 rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.stopLoss.stopLossLine.enabled = !d.stopLoss.stopLossLine.enabled; })}>{s.stopLoss.stopLossLine.enabled ? '라인 ON' : '라인 OFF'}</button>
            <button title="손절 라인 자동 재생성 토글" className="ml-1 rounded border border-zinc-700 px-1 text-[10px] text-zinc-300 hover:border-emerald-500/60 hover:text-emerald-200" onClick={() => updateSettings(d => { d.stopLoss.stopLossLine.autoRecreate = !d.stopLoss.stopLossLine.autoRecreate; })}>{s.stopLoss.stopLossLine.autoRecreate ? '재생성 ON' : '재생성 OFF'}</button>
            <button className="ml-1 rounded border border-zinc-700 px-1 py-0.5 text-[10px] text-zinc-300 hover:border-sky-500/60 hover:text-sky-200" onClick={() => setDetail({ key: 'stopLoss', title: '손절 상세' })}>상세</button>
          </div>
        </li>

        <li className="relative pl-5 text-[12px] leading-5 before:absolute before:left-0 before:top-1 before:h-3 before:w-3 before:rounded-full before:border before:border-emerald-500/60" aria-label="실행 & 안전장치">
          <div className="text-zinc-300">
            <span className="mr-2 font-medium text-zinc-100">8) 실행 & 안전장치</span>
            <span className="text-zinc-400">주문 정밀도/최소노미널은 심볼 제약으로 검증되며, 프리뷰/전송 단계에서 안전장치(최대 주문수, 1건 최대금액)가 적용됩니다.</span>
          </div>
        </li>
      </ol>

      {warnings.length > 0 ? (
        <div className="mt-3 rounded border border-amber-600/50 bg-amber-900/20 p-2 text-[11px] text-amber-200">
          <div className="mb-1 font-medium">주의 사항</div>
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>
                <button type="button" onClick={() => {
                  const target = w.includes('진입') ? 'entry' : w.includes('청산') ? 'exit' : w.includes('Stoploss') ? 'stopLoss' : w.includes('헤지') ? 'hedge' : 'symbols';
                  go(target);
                }} className="underline underline-offset-2">{w}</button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* 상세 미니 모달 */}
      {detail ? (
        <DetailModal title={detail.title} onClose={() => setDetail(null)}>
          {renderDetail(detail.key, s, { entryLong, entryShort, scaleLong, scaleShort, hedgeSum, exitLong, exitShort, stopSum })}
        </DetailModal>
      ) : null}
    </section>
  );
}

function buildJsonSummary(s: AutoTradingSettings, counts: Record<string, { groups: number; indicators: number }>) {
  return {
    base: {
      name: s.logicName,
      timeframe: s.timeframe,
      leverage: s.leverage,
      symbols: s.symbolCount,
      assetMode: s.assetMode,
      positionMode: s.positionMode
    },
    selection: {
      manual: s.symbolSelection.manualSymbols.length,
      excluded: s.symbolSelection.excludedSymbols.length,
      leverageMode: s.symbolSelection.leverageMode
    },
    entry: {
      long: { enabled: s.entry.long.enabled, ...counts.entryLong },
      short: { enabled: s.entry.short.enabled, ...counts.entryShort },
      immediate: { long: s.entry.long.immediate, short: s.entry.short.immediate }
    },
    scaleIn: {
      long: { enabled: s.scaleIn.long.enabled, ...counts.scaleLong, target: s.scaleIn.long.profitTarget },
      short: { enabled: s.scaleIn.short.enabled, ...counts.scaleShort, target: s.scaleIn.short.profitTarget },
      budget: s.capital.scaleInBudget
    },
    hedge: { enabled: s.hedgeActivation.enabled, directions: s.hedgeActivation.directions, ...counts.hedgeSum },
    exit: {
      long: { enabled: s.exit.long.enabled, ...counts.exitLong, target: s.exit.long.profitTarget },
      short: { enabled: s.exit.short.enabled, ...counts.exitShort, target: s.exit.short.profitTarget },
      includeFeesFunding: Boolean(s.exit.long.includeFeesFunding || s.exit.short.includeFeesFunding)
    },
    stopLoss: {
      target: s.stopLoss.profitTarget,
      count: s.stopLoss.purchaseCount,
      line: { enabled: s.stopLoss.stopLossLine.enabled, ...counts.stopSum }
    }
  };
}

function buildMarkdownSummary(s: AutoTradingSettings, c: Record<string, { groups: number; indicators: number }>) {
  const p = (n?: number) => (typeof n === 'number' ? `${n}%` : '-');
  return [
    `# 자동매매 로직 요약` ,
    `- 기본: 이름 ${s.logicName || '-'}, 프레임 ${s.timeframe}, 레버리지 ${s.leverage}x, 종목 ${s.symbolCount}, 자산 ${s.assetMode}, 포지션 ${s.positionMode}`,
    `- 종목: 수동 ${s.symbolSelection.manualSymbols.length}, 제외 ${s.symbolSelection.excludedSymbols.length}, 레버리지 ${s.symbolSelection.leverageMode}`,
    `- 진입: 롱 ${s.entry.long.enabled ? `${c.entryLong.groups}/${c.entryLong.indicators}` : 'OFF'}, 숏 ${s.entry.short.enabled ? `${c.entryShort.groups}/${c.entryShort.indicators}` : 'OFF'}, 즉시매수 ${[s.entry.long.immediate?'롱':'' , s.entry.short.immediate?'숏':''].filter(Boolean).join('/') || '없음'}`,
    `- 추가매수: 롱 ${s.scaleIn.long.enabled ? `${c.scaleLong.groups}/${c.scaleLong.indicators}` : 'OFF'} (목표 ${p(s.scaleIn.long.profitTarget.value)}), 숏 ${s.scaleIn.short.enabled ? `${c.scaleShort.groups}/${c.scaleShort.indicators}` : 'OFF'} (목표 ${p(s.scaleIn.short.profitTarget.value)})` ,
    `- 헤지: ${s.hedgeActivation.enabled ? `${c.hedgeSum.groups}/${c.hedgeSum.indicators} (${s.hedgeActivation.directions.join('/')})` : 'OFF'}` ,
    `- 청산: 롱 ${s.exit.long.enabled ? `${c.exitLong.groups}/${c.exitLong.indicators}` : 'OFF'} (목표 ${p(s.exit.long.profitTarget.value)}), 숏 ${s.exit.short.enabled ? `${c.exitShort.groups}/${c.exitShort.indicators}` : 'OFF'} (목표 ${p(s.exit.short.profitTarget.value)})`,
    `- 손절: 목표 ${p(s.stopLoss.profitTarget.value)}, 매수횟수 ${s.stopLoss.purchaseCount.enabled ? `${s.stopLoss.purchaseCount.comparator} ${s.stopLoss.purchaseCount.value}` : '-'}, 라인 ${s.stopLoss.stopLossLine.enabled ? `${c.stopSum.groups}/${c.stopSum.indicators}` : 'OFF'}`
  ].join('\n');
}

function MiniBar({ label, value, title, color = 'sky' }: { label: string; value: number; title?: string; color?: 'sky' | 'emerald' | 'rose' }) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const bar = color === 'emerald' ? 'bg-emerald-500/70' : color === 'rose' ? 'bg-rose-500/70' : 'bg-sky-500/70';
  return (
    <div className="flex items-center gap-2" title={title}>
      <span className="text-[10px] text-zinc-400">{label}</span>
      <div className="h-2 w-28 rounded bg-zinc-800">
        <div className={`h-2 rounded ${bar}`} style={{ width: `${v}%` }} />
      </div>
      <span className="text-[10px] text-zinc-400">{v}%</span>
    </div>
  );
}

function StackedBar({ title, segments, total }: { title?: string; segments: Array<{ label: string; value: number; color: 'emerald' | 'sky' | 'zinc' }>; total: number }) {
  const sum = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
  const norm = (v: number) => (total > 0 ? (Math.max(0, v) / total) * 100 : 0);
  const colorToClass = (c: 'emerald' | 'sky' | 'zinc') => (c === 'emerald' ? 'bg-emerald-500/70' : c === 'sky' ? 'bg-sky-500/70' : 'bg-zinc-500/50');
  return (
    <div className="text-[11px] text-zinc-400">
      {title ? <div className="mb-1">{title}</div> : null}
      <div className="h-2 w-[260px] overflow-hidden rounded bg-zinc-800">
        <div className="flex h-2 w-full">
          {segments.map((s, i) => (
            <div key={i} className={`${colorToClass(s.color)} h-2`} style={{ width: `${norm(s.value)}%` }} title={`${s.label} ${Math.round(s.value)}%`} />
          ))}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-2">
        {segments.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded ${colorToClass(s.color)}`} />
            <span>{s.label} {Math.round(s.value)}%</span>
          </span>
        ))}
        <span className="ml-auto">총 한도 {Math.round(total)}%</span>
      </div>
      {sum > total ? <div className="mt-1 text-rose-300">경고: 세그먼트 합이 한도를 초과했습니다.</div> : null}
    </div>
  );
}

function clampPct(v: number) { return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0)); }

function DetailModal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,680px)] rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-zinc-100">{title}</h4>
          <button className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300" onClick={onClose}>닫기</button>
        </div>
        <div className="text-[12px] text-zinc-300">
          {children}
        </div>
      </div>
    </div>
  );
}

function renderDetail(key: string, s: AutoTradingSettings, counts: Record<string, { groups: number; indicators: number }>) {
  const p = (n?: number) => (typeof n === 'number' ? `${n}%` : '-');
  if (key === 'base') {
    return (
      <ul className="list-disc pl-5">
        <li>이름: {s.logicName || '-'}</li>
        <li>프레임: {s.timeframe}, 레버리지: {s.leverage}x, 종목: {s.symbolCount}개</li>
        <li>자산: {s.assetMode}, 포지션: {s.positionMode}</li>
        <li>자본: 최대 마진 {s.capital.maxMargin.percentage}% ({s.capital.maxMargin.basis})</li>
        <li>초기 진입: {s.capital.initialMargin.mode} {p(s.capital.initialMargin.percentage)} 최소 {s.capital.initialMargin.minNotional} USDT</li>
        <li>추가 매수 예산: {s.capital.scaleInBudget.mode} {p(s.capital.scaleInBudget.percentage)} (basis {s.capital.scaleInBudget.basis})</li>
      </ul>
    );
  }
  if (key === 'symbols') {
    const sample = (arr: string[]) => (arr.length > 0 ? arr.slice(0, 10).join(', ') + (arr.length > 10 ? '…' : '') : '없음');
    return (
      <ul className="list-disc pl-5">
        <li>수동 선택: {s.symbolSelection.manualSymbols.length}개 — {sample(s.symbolSelection.manualSymbols)}</li>
        <li>제외 심볼: {s.symbolSelection.excludedSymbols.length}개 — {sample(s.symbolSelection.excludedSymbols)}</li>
        <li>랭킹 기준: {Object.entries(s.symbolSelection.ranking).filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(', ') || '없음'}</li>
        <li>레버리지 모드: {s.symbolSelection.leverageMode}</li>
      </ul>
    );
  }
  if (key === 'entry') {
    return (
      <ul className="list-disc pl-5">
        <li>롱: {s.entry.long.enabled ? `${counts.entryLong.groups}그룹/${counts.entryLong.indicators}지표` : 'OFF'} (즉시매수 {s.entry.long.immediate ? 'ON' : 'OFF'})</li>
        <li>숏: {s.entry.short.enabled ? `${counts.entryShort.groups}그룹/${counts.entryShort.indicators}지표` : 'OFF'} (즉시매수 {s.entry.short.immediate ? 'ON' : 'OFF'})</li>
      </ul>
    );
  }
  if (key === 'scaleIn') {
    return (
      <ul className="list-disc pl-5">
        <li>롱: {s.scaleIn.long.enabled ? `${counts.scaleLong.groups}그룹/${counts.scaleLong.indicators}지표` : 'OFF'} (목표 {p(s.scaleIn.long.profitTarget.value)})</li>
        <li>숏: {s.scaleIn.short.enabled ? `${counts.scaleShort.groups}그룹/${counts.scaleShort.indicators}지표` : 'OFF'} (목표 {p(s.scaleIn.short.profitTarget.value)})</li>
        <li>예산: {s.capital.scaleInBudget.mode} {p(s.capital.scaleInBudget.percentage)} (basis {s.capital.scaleInBudget.basis}, 최소노미널 {s.capital.scaleInBudget.minNotional})</li>
      </ul>
    );
  }
  if (key === 'hedge') {
    return (
      <ul className="list-disc pl-5">
        <li>헤지 활성화: {s.hedgeActivation.enabled ? 'ON' : 'OFF'} (방향: {s.hedgeActivation.directions.join('/') || '-'})</li>
        <li>조건: {counts.hedgeSum.groups}그룹/{counts.hedgeSum.indicators}지표</li>
      </ul>
    );
  }
  if (key === 'exit') {
    return (
      <ul className="list-disc pl-5">
        <li>롱: {s.exit.long.enabled ? `${counts.exitLong.groups}그룹/${counts.exitLong.indicators}지표` : 'OFF'} (목표 {p(s.exit.long.profitTarget.value)})</li>
        <li>숏: {s.exit.short.enabled ? `${counts.exitShort.groups}그룹/${counts.exitShort.indicators}지표` : 'OFF'} (목표 {p(s.exit.short.profitTarget.value)})</li>
        <li>수수료/펀딩 고려: {(s.exit.long.includeFeesFunding || s.exit.short.includeFeesFunding) ? 'ON' : 'OFF'}</li>
      </ul>
    );
  }
  if (key === 'stopLoss') {
    return (
      <ul className="list-disc pl-5">
        <li>손절 수익률: {p(s.stopLoss.profitTarget.value)}</li>
        <li>매수 횟수: {s.stopLoss.purchaseCount.enabled ? `${s.stopLoss.purchaseCount.comparator} ${s.stopLoss.purchaseCount.value}` : '미설정'}</li>
        <li>Stoploss 라인: {s.stopLoss.stopLossLine.enabled ? `${counts.stopSum.groups}그룹/${counts.stopSum.indicators}지표` : 'OFF'} (재생성 {s.stopLoss.stopLossLine.autoRecreate ? 'ON' : 'OFF'})</li>
      </ul>
    );
  }
  return null;
}
