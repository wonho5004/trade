'use client';

import { useEffect, useMemo, useState } from 'react';

import type { ConditionGroupNode, ConditionNode, IndicatorConditions } from '@/types/trading/auto-trading';
import { normalizeConditionTree, createIndicatorEntry, createIndicatorLeaf } from '@/lib/trading/autoTradingDefaults';
import { replaceGroupChildren, ensureGroup } from '@/lib/trading/conditionsTree';
import { ConditionsEditorModal } from './ConditionsEditorModal';

// Lightweight wrapper: reuse ConditionsEditorModal's editor for a single group
export function GroupEditModal({
  open,
  title,
  conditions,
  groupId,
  onChange,
  onClose
}: {
  open: boolean;
  title: string;
  conditions: IndicatorConditions;
  groupId: string;
  onChange: (next: IndicatorConditions) => void;
  onClose: () => void;
}) {
  const [origin, setOrigin] = useState<IndicatorConditions>(() => conditions);
  // 편집 대상 그룹 전체를 상태로 관리(자식만 분리하지 않음)
  const [editedGroup, setEditedGroup] = useState<ConditionGroupNode | null>(null);

  const root = useMemo(() => conditions.root as unknown as ConditionNode, [conditions]);
  const group = useMemo(() => findGroupNode(root, groupId), [root, groupId]);
  const [addType, setAddType] = useState<'bollinger' | 'ma' | 'rsi' | 'dmi' | 'macd'>('ma');

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
          />
        </div>
      </div>
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
