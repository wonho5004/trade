'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ConditionGroupNode, ConditionNode, IndicatorConditions, StatusLeafNode, StatusMetric, StatusUnit, ActionLeafNode, BuyOrderConfig, SellOrderConfig, StopLossConfig } from '@/types/trading/auto-trading';
import { normalizeConditionTree, createIndicatorEntry, createIndicatorLeaf } from '@/lib/trading/autoTradingDefaults';
import { replaceGroupChildren, ensureGroup, collectIndicatorNodes } from '@/lib/trading/conditionsTree';
import { ConditionsEditorModal } from './ConditionsEditorModal';
import { ConditionsPreview } from './ConditionsPreview';
import { useSymbolValidation } from '@/hooks/useSymbolValidation';
import { normalizeSymbol as normalizePreviewSymbol } from '@/lib/trading/symbols';

// Lightweight wrapper: reuse ConditionsEditorModal's editor for a single group
export function GroupEditModal({
  open,
  title,
  conditions,
  groupId,
  onChange,
  onClose,
  preview
}: {
  open: boolean;
  title: string;
  conditions: IndicatorConditions;
  groupId: string;
  onChange: (next: IndicatorConditions) => void;
  onClose: () => void;
  preview?: {
    symbol: string;
    symbolInput?: string;
    onSymbolChange?: (v: string) => void;
    quote?: 'USDT' | 'USDC';
    onQuoteChange?: (q: 'USDT' | 'USDC') => void;
    datalistOptions?: string[];
    interval: any;
    direction: 'long' | 'short';
    indicatorSignals?: Record<string, boolean>;
    assumeSignalsOn?: boolean;
    onToggle?: (v: boolean) => void;
  };
}) {
  const [origin, setOrigin] = useState<IndicatorConditions>(() => conditions);
  // 편집 대상 그룹 전체를 상태로 관리(자식만 분리하지 않음)
  const [editedGroup, setEditedGroup] = useState<ConditionGroupNode | null>(null);
  const symValid = useSymbolValidation(preview ? (preview.symbolInput || preview.symbol) : '', (preview?.quote ?? 'USDT') as any);

  const root = useMemo(() => conditions.root as unknown as ConditionNode, [conditions]);
  const group = useMemo(() => findGroupNode(root, groupId), [root, groupId]);
  const [addType, setAddType] = useState<'bollinger' | 'ma' | 'rsi' | 'dmi' | 'macd'>('ma');
  const [addStatus, setAddStatus] = useState<StatusMetric>('profitRate');
  const [indicatorPickerFor, setIndicatorPickerFor] = useState<string | null>(null);
  const [addActionKind, setAddActionKind] = useState<'buy' | 'sell' | 'stoploss'>('buy');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);

  useEffect(() => {
    if (open && group) {
      const g = normalizeConditionTree(group);
      setOrigin(({ root: g } as any) as IndicatorConditions);
      setEditedGroup(g as any);
    }
  }, [open, group]);

  if (!open) return null;
  if (!group) return null;

  const handleSave = () => {
    if (!editedGroup) return onClose();
    const baseRoot = conditions.root as unknown as ConditionNode;
    const next = replaceGroupChildren(baseRoot, groupId, editedGroup.children);
    onChange({ ...(conditions as any), root: normalizeConditionTree(next) } as any);
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-[min(92vw,860px)] rounded-lg border border-zinc-800 bg-zinc-950 shadow-xl">
        <header className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const g = origin.root as unknown as ConditionGroupNode;
                const norm = normalizeConditionTree(g);
                setEditedGroup(norm as any);
              }}
              className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500"
            >
              초기화
            </button>
            <button type="button" onClick={onClose} className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:border-zinc-500">
              취소
            </button>
            <button type="button" onClick={handleSave} className="rounded border border-emerald-500/60 px-2 py-1 text-xs text-emerald-200 hover:border-emerald-400">
              저장
            </button>
          </div>
        </header>
        <div className="space-y-4 p-4">
          {preview ? (
            <div className="flex items-center justify-between">
              <ConditionsPreview
                conditions={{ root: (editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) } as any}
                symbol={preview.symbol}
                interval={preview.interval}
                direction={preview.direction}
                indicatorSignals={preview.indicatorSignals}
              />
              <div className="flex items-center gap-3 text-[11px] text-zinc-400">
                <label className="flex items-center gap-2">
                  <span>심볼</span>
                  <input
                    value={preview.symbolInput ?? ''}
                    onChange={(e) => preview.onSymbolChange?.(e.target.value)}
                    onBlur={(e) => {
                      const q = preview.quote ?? 'USDT';
                      const norm = normalizePreviewSymbol(e.currentTarget.value || preview.symbol, q);
                      preview.onSymbolChange?.(norm);
                    }}
                    placeholder={preview.symbol}
                    className={`w-44 rounded bg-zinc-900 px-2 py-1 text-zinc-100 ${
                      symValid?.valid === true ? 'border border-emerald-600' : symValid?.valid === false ? 'border border-rose-600' : 'border border-zinc-700'
                    }`}
                  />
                  {symValid?.loading ? (
                    <span className="text-[10px] text-zinc-500">검증중…</span>
                  ) : preview.symbolInput ? (
                    <span className={`rounded border px-1 text-[10px] ${symValid?.valid ? 'border-emerald-700 text-emerald-300' : 'border-zinc-800 text-zinc-500'}`}>미리보기 {preview.symbol}</span>
                  ) : null}
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="h-4 w-4" checked={!!preview.assumeSignalsOn} onChange={(e) => preview.onToggle?.(e.target.checked)} />
                  지표 신호 가정(ON)
                </label>
              </div>
          </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400">
            <span className="text-zinc-300">지표 추가</span>
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as any)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
            >
              <option value="ma">이동평균선</option>
              <option value="bollinger">볼린저 밴드</option>
              <option value="rsi">RSI</option>
              <option value="dmi">DMI / ADX</option>
              <option value="macd">MACD</option>
            </select>
            <button
              type="button"
              onClick={() => {
                setEditedGroup((prev) => {
                  const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                  const nextChildren = [
                    ...base.children,
                    (createIndicatorLeaf(createIndicatorEntry(addType)) as unknown) as ConditionNode,
                  ];
                  return { ...base, children: nextChildren };
                });
              }}
              className="rounded border border-emerald-500/60 px-2 py-1 text-[11px] text-emerald-200"
            >
              추가
            </button>
            <span className="ml-4 text-zinc-300">상태 추가</span>
            <select
              value={addStatus}
              onChange={(e) => setAddStatus(e.target.value as StatusMetric)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
            >
              <option value="profitRate">현재 수익률(%)</option>
              <option value="margin">현재 마진</option>
              <option value="buyCount">매수 횟수</option>
              <option value="entryAge">진입 경과(일)</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const createStatus = (metric: StatusMetric): StatusLeafNode => {
                  const id = `cond-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
                  const base: StatusLeafNode = { kind: 'status', id, metric, comparator: 'over', value: 0 } as StatusLeafNode;
                  if (metric === 'profitRate') base.unit = 'percent';
                  else if (metric === 'margin') base.unit = 'USDT';
                  else if (metric === 'buyCount') base.unit = 'count';
                  else if (metric === 'entryAge') base.unit = 'days';
                  return base;
                };
                setEditedGroup((prev) => {
                  const base = (prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as ConditionGroupNode;
                  const nextChildren = [...base.children, (createStatus(addStatus) as unknown) as ConditionNode];
                  return { ...base, children: nextChildren };
                });
              }}
              className="rounded border border-sky-500/60 px-2 py-1 text-[11px] text-sky-200"
            >
              상태 추가
            </button>
            <span className="ml-4 text-zinc-300">액션 추가</span>
            <select
              value={addActionKind}
              onChange={(e) => setAddActionKind(e.target.value as any)}
              className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100"
            >
              <option value="buy">매수 주문</option>
              <option value="sell">매도 주문</option>
              <option value="stoploss">스탑로스 주문</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const id = `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
                const def = (() => {
                  if (addActionKind === 'buy') {
                    return { kind: 'buy', orderType: 'market', amountMode: 'usdt', asset: 'USDT', usdt: 10 } as BuyOrderConfig;
                  } else if (addActionKind === 'sell') {
                    return { kind: 'sell', orderType: 'market', amountMode: 'position_percent', positionPercent: 100 } as SellOrderConfig;
                  }
                  return { kind: 'stoploss', priceMode: 'input', price: 0, recreateOnMissing: true } as StopLossConfig;
                })();
                setEditedGroup((prev) => {
                  const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                  const nextChildren = [...base.children, ({ kind: 'action', id, action: def } as unknown) as ConditionNode];
                  return { ...base, children: nextChildren } as any;
                });
              }}
              className="rounded border border-fuchsia-600/60 px-2 py-1 text-[11px] text-fuchsia-200"
            >
              추가
            </button>
          </div>
          {/* Embedded editor body only (no overlay/header) */}
          <ConditionsEditorModal
            open={true}
            title=""
            value={{ root: (editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) } as any}
            onChange={(next) => {
              const g = ensureGroup(next.root as unknown as ConditionNode);
              setEditedGroup(g as any);
            }}
            onClose={() => {}}
            initialMode="edit"
            embedded
            previewCtx={preview ? {
              symbol: preview.symbol,
              symbolInput: preview.symbolInput,
              onSymbolChange: preview.onSymbolChange,
              quote: preview.quote,
              onQuoteChange: preview.onQuoteChange,
              interval: preview.interval,
              direction: preview.direction,
              indicatorSignals: preview.indicatorSignals,
              assumeSignalsOn: preview.assumeSignalsOn,
              onToggle: preview.onToggle
            } : undefined}
          />
          {(() => {
            const collectActions = (node: any, acc: ActionLeafNode[] = []): ActionLeafNode[] => {
              if (!node || typeof node !== 'object') return acc;
              if (node.kind === 'action') acc.push(node as ActionLeafNode);
              if (node.kind === 'group' && Array.isArray(node.children)) node.children.forEach((c: any) => collectActions(c, acc));
              return acc;
            };
            const actions = collectActions(editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any));
            if (actions.length === 0) return null;
            const summary = (a: ActionLeafNode) => {
              const k = a.action.kind;
              if (k === 'buy') {
                const cfg = a.action as BuyOrderConfig;
                const amt = cfg.amountMode === 'usdt' ? `${cfg.asset ?? 'USDT'} ${cfg.usdt ?? 0}` : cfg.amountMode === 'position_percent' ? `포지션 ${cfg.positionPercent ?? 0}%` : cfg.amountMode === 'wallet_percent' ? `${cfg.walletBasis ?? 'wallet'} ${cfg.walletPercent ?? 0}%` : cfg.amountMode === 'initial_percent' ? `최초 ${cfg.initialPercent ?? 0}%` : '최소 주문';
                return `매수 · ${cfg.orderType} · ${amt}`;
              } else if (k === 'sell') {
                const cfg = a.action as SellOrderConfig;
                const amt = cfg.amountMode === 'usdt' ? `${cfg.asset ?? 'USDT'} ${cfg.usdt ?? 0}` : cfg.amountMode === 'position_percent' ? `포지션 ${cfg.positionPercent ?? 0}%` : '최소 주문';
                return `매도 · ${cfg.orderType} · ${amt}`;
              }
              const cfg = a.action as StopLossConfig;
              return `스탑로스 · ${cfg.priceMode}${cfg.priceMode === 'input' ? ` ${cfg.price}` : ''}`;
            };
            const replaceAction = (id: string, replacer: (cur: ActionLeafNode) => ActionLeafNode) => {
              setEditedGroup((prev) => {
                const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                const nextChildren = base.children.map((c) => {
                  if ((c as any).kind === 'action' && (c as any).id === id) return replacer(c as any) as any;
                  return c;
                });
                return { ...base, children: nextChildren } as any;
              });
            };
            const removeAction = (id: string) => {
              setEditedGroup((prev) => {
                const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                const nextChildren = base.children.filter((c) => !((c as any).kind === 'action' && (c as any).id === id));
                return { ...base, children: nextChildren } as any;
              });
            };
            return (
              <div className="space-y-2">
                <div className="text-[11px] text-zinc-400">액션</div>
                <ul className="space-y-1">
                  {actions.map((a) => (
                    <li key={a.id} className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                      <div className="flex items-center justify-between">
                        <p className="truncate text-[11px] text-zinc-300">{summary(a)}</p>
                        <div className="flex items-center gap-2">
                          <button className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300" onClick={() => setEditingActionId((cur) => (cur === a.id ? null : a.id))}>편집</button>
                          <button className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-rose-300" onClick={() => removeAction(a.id)}>삭제</button>
                        </div>
                      </div>
                      {editingActionId === a.id ? (
                        <div className="mt-2 grid gap-2 text-[11px] text-zinc-300 md:grid-cols-2">
                          {a.action.kind !== 'stoploss' ? (
                            <label className="flex items-center gap-2">
                              <span className="w-20 text-zinc-400">구분</span>
                              <select value={(a.action as any).orderType} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...cur.action, orderType: e.target.value as any } }))} className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                                <option value="market">시장가</option>
                                <option value="limit">지정가</option>
                              </select>
                            </label>
                          ) : null}
                          {a.action.kind === 'buy' || a.action.kind === 'sell' ? (
                            <label className="flex items-center gap-2">
                              <span className="w-20 text-zinc-400">금액</span>
                              <select value={(a.action as any).amountMode} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...cur.action, amountMode: e.target.value as any } }))} className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                                <option value="usdt">USDT/USDC</option>
                                <option value="position_percent">포지션 %</option>
                                {a.action.kind === 'buy' ? (
                                  <>
                                    <option value="wallet_percent">잔고 %</option>
                                    <option value="initial_percent">최초 매수 %</option>
                                    <option value="min_notional">최소 주문</option>
                                  </>
                                ) : (
                                  <option value="min_notional">최소 주문</option>
                                )}
                              </select>
                            </label>
                          ) : null}
                          {a.action.kind === 'buy' && (a.action as BuyOrderConfig).amountMode === 'usdt' ? (
                            <label className="flex items-center gap-2">
                              <span className="w-20 text-zinc-400">자산</span>
                              <select value={(a.action as BuyOrderConfig).asset ?? 'USDT'} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as any), asset: e.target.value as any } }))} className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                                <option value="USDT">USDT</option>
                                <option value="USDC">USDC</option>
                              </select>
                            </label>
                          ) : null}
                          {((a.action.kind === 'buy' && (a.action as BuyOrderConfig).amountMode === 'usdt') || (a.action.kind === 'sell' && (a.action as SellOrderConfig).amountMode === 'usdt')) ? (
                            <label className="flex items-center gap-2">
                              <span className="w-20 text-zinc-400">금액</span>
                              <input type="number" className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={(a.action as any).usdt ?? 0} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as any), usdt: Math.max(0, Number(e.target.value) || 0) } }))} />
                            </label>
                          ) : null}
                          {((a.action.kind === 'buy' && (a.action as BuyOrderConfig).amountMode === 'position_percent') || (a.action.kind === 'sell' && (a.action as SellOrderConfig).amountMode === 'position_percent')) ? (
                            <label className="flex items-center gap-2">
                              <span className="w-20 text-zinc-400">포지션%</span>
                              <input type="number" className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={(a.action as any).positionPercent ?? 0} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as any), positionPercent: Math.max(1, Math.min(a.action.kind === 'buy' ? 2000 : 100, Number(e.target.value) || 0)) } }))} />
                            </label>
                          ) : null}
                          {(a.action.kind === 'buy' && (a.action as BuyOrderConfig).amountMode === 'wallet_percent') ? (
                            <>
                              <label className="flex items-center gap-2">
                                <span className="w-20 text-zinc-400">기준</span>
                                <select value={(a.action as BuyOrderConfig).walletBasis ?? 'wallet'} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as BuyOrderConfig), walletBasis: e.target.value as any } }))} className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                                  <option value="wallet">Wallet</option>
                                  <option value="total">Total</option>
                                  <option value="free">Free</option>
                                </select>
                              </label>
                              <label className="flex items-center gap-2">
                                <span className="w-20 text-zinc-400">퍼센트%</span>
                                <input type="number" className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={(a.action as BuyOrderConfig).walletPercent ?? 0} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as BuyOrderConfig), walletPercent: Math.max(0.01, Math.min(100, Number(e.target.value) || 0)) } }))} />
                              </label>
                            </>
                          ) : null}
                          {(a.action.kind === 'buy' && (a.action as BuyOrderConfig).amountMode === 'initial_percent') ? (
                            <label className="flex items-center gap-2">
                              <span className="w-20 text-zinc-400">최초%</span>
                              <input type="number" className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={(a.action as BuyOrderConfig).initialPercent ?? 0} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as BuyOrderConfig), initialPercent: Math.max(1, Math.min(2000, Number(e.target.value) || 0)) } }))} />
                            </label>
                          ) : null}
                          {(a.action.kind !== 'stoploss' && (a.action as any).orderType === 'limit') ? (
                            <>
                              <label className="flex items-center gap-2">
                                <span className="w-20 text-zinc-400">지정가</span>
                                <select value={(a.action as any).limitPriceMode ?? 'input'} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as any), limitPriceMode: e.target.value as any } }))} className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                                  <option value="input">입력값</option>
                                  <option value="indicator">지표값</option>
                                </select>
                              </label>
                              {((a.action as any).limitPriceMode ?? 'input') === 'input' ? (
                                <label className="flex items-center gap-2">
                                  <span className="w-20 text-zinc-400">가격</span>
                                  <input type="number" className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={(a.action as any).limitPrice ?? 0} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as any), limitPrice: Math.max(0, Number(e.target.value) || 0) } }))} />
                                </label>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="w-20 text-zinc-400">지표값</span>
                                  <input type="text" readOnly className="flex-1 cursor-not-allowed rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-500" value={(a.action as any).indicatorRefId ?? ''} placeholder="지표값 미설정" />
                                  <button className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300" onClick={() => setIndicatorPickerFor(a.id)}>지표값 설정</button>
                                </div>
                              )}
                            </>
                          ) : null}
                          {a.action.kind === 'stoploss' ? (
                            <>
                              <label className="flex items-center gap-2">
                                <span className="w-20 text-zinc-400">가격</span>
                                <select value={(a.action as StopLossConfig).priceMode} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as StopLossConfig), priceMode: e.target.value as any } }))} className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                                  <option value="input">입력값</option>
                                  <option value="indicator">지표값</option>
                                  <option value="condition">조건추가</option>
                                </select>
                              </label>
                              {((a.action as StopLossConfig).priceMode === 'input') ? (
                                <label className="flex items-center gap-2">
                                  <span className="w-20 text-zinc-400">가격</span>
                                  <input type="number" className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-1" value={(a.action as StopLossConfig).price ?? 0} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as StopLossConfig), price: Math.max(0, Number(e.target.value) || 0) } }))} />
                                </label>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="w-20 text-zinc-400">지표값</span>
                                  <input type="text" readOnly className="flex-1 cursor-not-allowed rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-zinc-500" value={(a.action as StopLossConfig).indicatorRefId ?? ''} placeholder="지표값 미설정" />
                                  <button className="rounded border border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-300" onClick={() => setIndicatorPickerFor(a.id)}>지표값 설정</button>
                                </div>
                              )}
                              <label className="flex items-center gap-2">
                                <input type="checkbox" className="h-4 w-4" checked={(a.action as StopLossConfig).recreateOnMissing ?? true} onChange={(e) => replaceAction(a.id, (cur) => ({ ...cur, action: { ...(cur.action as StopLossConfig), recreateOnMissing: e.target.checked } }))} />
                                <span>스탑로스 누락 시 재생성</span>
                              </label>
                            </>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </div>
      </div>
      {indicatorPickerFor ? (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" onClick={() => setIndicatorPickerFor(null)} />
          <div className="relative z-10 w-[min(92vw,680px)] rounded-lg border border-zinc-800 bg-zinc-950 p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-zinc-100">지표값 설정</h4>
              <button className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-300" onClick={() => setIndicatorPickerFor(null)}>닫기</button>
            </div>
            <div className="space-y-2">
              <p className="text-[11px] text-zinc-400">아래에서 지표를 선택하거나, 새 지표를 추가해 선택하세요.</p>
              <div className="max-h-48 overflow-auto rounded border border-zinc-800">
                <table className="w-full text-left text-[11px] text-zinc-300">
                  <thead className="bg-zinc-950">
                    <tr className="border-b border-zinc-800 text-zinc-400">
                      <th className="px-2 py-1">지표</th>
                      <th className="px-2 py-1">ID</th>
                      <th className="px-2 py-1"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const g = ensureGroup((editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                      const inds = collectIndicatorNodes(g as any);
                      const labelOf = (t: string) => ({ bollinger: '볼린저 밴드', ma: '이동평균선', rsi: 'RSI', dmi: 'DMI/ADX', macd: 'MACD' } as any)[t] ?? t;
                      if (inds.length === 0) {
                        return (
                          <tr>
                            <td className="px-2 py-2 text-zinc-500" colSpan={3}>현재 그룹에 지표가 없습니다.</td>
                          </tr>
                        );
                      }
                      return inds.map((n: any) => (
                        <tr key={n.id} className="border-b border-zinc-800">
                          <td className="px-2 py-1">{labelOf(n.indicator?.type)}</td>
                          <td className="px-2 py-1 text-zinc-500">{n.id}</td>
                          <td className="px-2 py-1">
                            <button className="rounded border border-emerald-700 px-2 py-0.5 text-emerald-300" onClick={() => {
                              const id = n.id as string;
                              const target = indicatorPickerFor as string;
                              // attach id to action
                              const attach = (aid: string, selectedId: string) => {
                                setEditedGroup((prev) => {
                                  const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                                  const nextChildren = base.children.map((c) => {
                                    if ((c as any).kind === 'action' && (c as any).id === aid) {
                                      const next = { ...(c as any) };
                                      (next as any).action = { ...(next as any).action, indicatorRefId: selectedId };
                                      return next;
                                    }
                                    return c;
                                  });
                                  return { ...base, children: nextChildren } as any;
                                });
                              };
                              attach(target, id);
                              setIndicatorPickerFor(null);
                            }}>선택</button>
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              {/* 파생 값(지표 조합) 생성기 */}
              {(() => {
                const g = ensureGroup((editedGroup ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                const inds = collectIndicatorNodes(g as any);
                if (inds.length < 2) return null;
                const labelOf = (t: string) => ({ bollinger: '볼린저 밴드', ma: '이동평균선', rsi: 'RSI', dmi: 'DMI/ADX', macd: 'MACD' } as any)[t] ?? t;
                return (
                  <div className="rounded border border-zinc-800 bg-zinc-950/40 p-2">
                    <div className="mb-1 text-[11px] text-zinc-300">파생 값 만들기</div>
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto] text-[11px] text-zinc-300">
                      <select id="expr-op" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                        <option value="cross">교차값</option>
                        <option value="min">최소값</option>
                        <option value="max">최대값</option>
                        <option value="avg">평균값</option>
                      </select>
                      <select id="expr-a" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                        {inds.map((n: any) => (
                          <option key={`a-${n.id}`} value={n.id}>{labelOf(n.indicator?.type)} · {n.id}</option>
                        ))}
                      </select>
                      <select id="expr-b" className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1">
                        {inds.map((n: any) => (
                          <option key={`b-${n.id}`} value={n.id}>{labelOf(n.indicator?.type)} · {n.id}</option>
                        ))}
                      </select>
                      <button className="rounded border border-fuchsia-700 px-2 py-1 text-fuchsia-300"
                        onClick={() => {
                          const op = (document.getElementById('expr-op') as HTMLSelectElement).value;
                          const a = (document.getElementById('expr-a') as HTMLSelectElement).value;
                          const b = (document.getElementById('expr-b') as HTMLSelectElement).value;
                          const token = `expr:${op}:${a}:${b}`;
                          const target = indicatorPickerFor as string;
                          setEditedGroup((prev) => {
                            const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                            const nextChildren = base.children.map((c) => {
                              if ((c as any).kind === 'action' && (c as any).id === target) {
                                const next = { ...(c as any) };
                                (next as any).action = { ...(next as any).action, indicatorRefId: token };
                                return next;
                              }
                              return c;
                            });
                            return { ...base, children: nextChildren } as any;
                          });
                          setIndicatorPickerFor(null);
                        }}>파생 값 적용</button>
                    </div>
                    <p className="mt-1 text-[10px] text-zinc-500">교차값은 엔진에서 계산되며, 최근 교차값 등 세부 규칙은 실행 단계에서 해석합니다.</p>
                  </div>
                );
              })()}
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[11px] text-zinc-300">지표 추가</span>
                <select value={addType} onChange={(e) => setAddType(e.target.value as any)} className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] text-zinc-100">
                  <option value="ma">이동평균선</option>
                  <option value="bollinger">볼린저 밴드</option>
                  <option value="rsi">RSI</option>
                  <option value="dmi">DMI / ADX</option>
                  <option value="macd">MACD</option>
                </select>
                <button className="rounded border border-emerald-700 px-2 py-0.5 text-[11px] text-emerald-300" onClick={() => {
                  const entry = createIndicatorEntry(addType);
                  const leaf = createIndicatorLeaf(entry);
                  const newId = (leaf as any).id as string;
                  setEditedGroup((prev) => {
                    const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                    const nextChildren = [...base.children, (leaf as unknown) as ConditionNode];
                    return { ...base, children: nextChildren } as any;
                  });
                  const target = indicatorPickerFor as string;
                  setEditedGroup((prev) => {
                    const base = ensureGroup((prev ?? ({ kind: 'group', id: groupId, operator: 'and', children: [] } as any)) as any);
                    const nextChildren = base.children.map((c) => {
                      if ((c as any).kind === 'action' && (c as any).id === target) {
                        const next = { ...(c as any) };
                        (next as any).action = { ...(next as any).action, indicatorRefId: newId };
                        return next;
                      }
                      return c;
                    });
                    return { ...base, children: nextChildren } as any;
                  });
                  setIndicatorPickerFor(null);
                }}>추가 후 선택</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function findGroupNode(root: ConditionNode, id: string): ConditionGroupNode | null {
  if (root.kind === 'group') {
    if (root.id === id) return root;
    for (const child of root.children) {
      const r = findGroupNode(child, id);
      if (r) return r;
    }
  }
  return null;
}
