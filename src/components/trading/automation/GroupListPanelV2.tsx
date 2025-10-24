'use client';

import React, { useState, useMemo } from 'react';
import type {
  ConditionGroupNode,
  ConditionNode,
  IndicatorConditions,
  IndicatorLeafNode
} from '@/types/trading/auto-trading';
import { ConditionGroupCard } from './ConditionGroupCard';
import { IndicatorEditModal } from './IndicatorEditModal';
import { GroupEditModal } from './GroupEditModal';
import { createIndicatorGroup, normalizeConditionTree } from '@/lib/trading/autoTradingDefaults';
import { removeNode, ensureGroup, collectIndicatorNodes } from '@/lib/trading/conditionsTree';

interface GroupListPanelV2Props {
  /** 조건 데이터 */
  value: IndicatorConditions;
  /** 변경 핸들러 */
  onChange: (next: IndicatorConditions) => void;
  /** 미리보기 설정 (선택) */
  preview?: {
    symbol: string;
    interval: any;
    direction: 'long' | 'short';
  };
}

/**
 * 조건 그룹 리스트 패널 V2
 * - ConditionGroupCard 기반의 새로운 UI
 * - 사용자 친화적인 그룹/조건 관리
 * - 명확한 AND/OR 관계 표시
 */
export const GroupListPanelV2: React.FC<GroupListPanelV2Props> = ({
  value,
  onChange,
  preview
}) => {
  // 모달 상태
  const [indicatorModal, setIndicatorModal] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });

  const [groupModal, setGroupModal] = useState<{
    open: boolean;
    id: string | null;
  }>({ open: false, id: null });

  // 루트 그룹
  const root = value.root as unknown as ConditionGroupNode;

  // 그룹 목록 추출
  const groups = useMemo(() => {
    if (root.kind !== 'group') return [];

    // 루트의 자식 중 그룹만 추출
    const childGroups = root.children.filter(
      (c) => c.kind === 'group'
    ) as ConditionGroupNode[];

    // 그룹이 없으면 루트를 fallback 그룹으로 사용
    if (childGroups.length === 0) {
      // 루트에 직접 지표가 있으면 루트를 그룹으로 표시
      const hasDirectIndicators = root.children.some(c => c.kind === 'indicator');
      if (hasDirectIndicators) {
        return [root];
      }
      return [];
    }

    return childGroups;
  }, [root]);

  // 모든 지표 노드 수집 (다른 지표 참조용)
  const allIndicators = useMemo(() => {
    return collectIndicatorNodes(root as unknown as ConditionNode);
  }, [root]);

  // 사용 가능한 지표 목록 (레이블 포함)
  const availableIndicators = useMemo(() => {
    return allIndicators.map(ind => {
      const config = ind.indicator.config;
      let label = '';

      switch (ind.indicator.type) {
        case 'ma':
          label = `MA(${(config as any).period})`;
          break;
        case 'bollinger':
          label = `볼린저밴드(${(config as any).length})`;
          break;
        case 'rsi':
          label = `RSI(${(config as any).period})`;
          break;
        case 'macd':
          label = `MACD(${(config as any).fast},${(config as any).slow})`;
          break;
        case 'dmi':
          label = 'DMI';
          break;
        default:
          label = ind.indicator.type;
      }

      return {
        id: ind.id,
        label
      };
    });
  }, [allIndicators]);

  /**
   * 조건 그룹 추가
   */
  const handleAddGroup = () => {
    const newGroup = createIndicatorGroup('and', []);
    const nextRoot: ConditionGroupNode = {
      ...root,
      operator: 'or', // 그룹 간은 OR
      children: [...root.children, newGroup]
    };
    onChange({ root: normalizeConditionTree(nextRoot) } as any);
  };

  /**
   * 그룹 삭제
   */
  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('이 조건 그룹을 삭제하시겠습니까?')) return;

    const nextRoot = removeNode(root as unknown as ConditionNode, groupId);
    if (nextRoot) {
      onChange({ root: normalizeConditionTree(ensureGroup(nextRoot)) } as any);
    }
  };

  /**
   * 그룹 편집
   */
  const handleEditGroup = (groupId: string) => {
    setGroupModal({ open: true, id: groupId });
  };

  /**
   * 개별 조건 편집
   */
  const handleEditCondition = (conditionId: string) => {
    setIndicatorModal({ open: true, id: conditionId });
  };

  /**
   * 개별 조건 삭제
   */
  const handleDeleteCondition = (conditionId: string) => {
    if (!confirm('이 조건을 삭제하시겠습니까?')) return;

    const nextRoot = removeNode(root as unknown as ConditionNode, conditionId);
    if (nextRoot) {
      onChange({ root: normalizeConditionTree(ensureGroup(nextRoot)) } as any);
    }
  };

  /**
   * 조건 추가 (그룹에)
   */
  const handleAddCondition = (groupId: string) => {
    // GroupEditModal을 통해 추가하도록 유도
    setGroupModal({ open: true, id: groupId });
  };

  // 현재 편집 중인 그룹 찾기
  const editingGroup = useMemo(() => {
    if (!groupModal.open || !groupModal.id) return null;

    const findGroup = (node: ConditionNode): ConditionGroupNode | null => {
      if (node.kind === 'group' && node.id === groupModal.id) {
        return node;
      }
      if (node.kind === 'group') {
        for (const child of node.children) {
          const found = findGroup(child);
          if (found) return found;
        }
      }
      return null;
    };

    return findGroup(root as unknown as ConditionNode);
  }, [groupModal, root]);

  // 현재 편집 중인 지표 찾기
  const editingIndicator = useMemo(() => {
    if (!indicatorModal.open || !indicatorModal.id) return null;
    return allIndicators.find(ind => ind.id === indicatorModal.id) || null;
  }, [indicatorModal, allIndicators]);

  return (
    <div className="space-y-4">
      {/* 최상단: 그룹 간 관계 안내 */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-blue-300">
            <strong>그룹 간: OR</strong> (아래 그룹 중 하나만 만족하면 조건 충족)
          </span>
        </div>
      )}

      {/* 조건 없음 안내 */}
      {groups.length === 0 && (
        <div className="py-12 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-zinc-800 mb-4">
            <svg className="w-8 h-8 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-sm text-zinc-400 mb-2">조건 그룹이 없습니다</p>
          <p className="text-xs text-zinc-500 mb-4">
            아래 버튼을 눌러 첫 번째 조건 그룹을 추가하세요
          </p>
        </div>
      )}

      {/* 그룹 카드 목록 */}
      {groups.map((group, index) => (
        <React.Fragment key={group.id}>
          {/* 그룹 간 구분선 (OR) */}
          {index > 0 && (
            <div className="flex items-center gap-3 py-2">
              <div className="flex-1 border-t-2 border-dashed border-blue-500/40" />
              <span className="text-sm font-bold text-blue-400 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/40">
                OR
              </span>
              <div className="flex-1 border-t-2 border-dashed border-blue-500/40" />
            </div>
          )}

          {/* 그룹 카드 */}
          <ConditionGroupCard
            groupNumber={index + 1}
            group={group}
            onEditGroup={() => handleEditGroup(group.id)}
            onDeleteGroup={() => handleDeleteGroup(group.id)}
            onEditCondition={handleEditCondition}
            onDeleteCondition={handleDeleteCondition}
            onAddCondition={() => handleAddCondition(group.id)}
          />
        </React.Fragment>
      ))}

      {/* 조건 그룹 추가 버튼 */}
      <button
        onClick={handleAddGroup}
        className="w-full py-4 rounded-lg border-2 border-dashed border-zinc-600 hover:border-blue-500 bg-zinc-900/30 hover:bg-blue-500/5 text-zinc-400 hover:text-blue-400 text-sm font-medium transition-all"
      >
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>조건 그룹 추가</span>
        </div>
      </button>

      {/* 도움말 */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <p className="text-xs font-medium text-green-300 mb-2">💡 조건 그룹 사용법</p>
        <ul className="space-y-1 text-xs text-green-200">
          <li>• <strong>조건 그룹</strong>: 여러 조건을 묶어서 관리하는 단위</li>
          <li>• <strong>그룹 내 AND</strong>: 같은 그룹 안의 조건들은 모두 만족해야 함</li>
          <li>• <strong>그룹 간 OR</strong>: 여러 그룹 중 하나만 만족하면 됨</li>
          <li>• <strong>예시</strong>: "RSI &gt; 70 AND MA돌파" 또는 "볼린저밴드 상단돌파"</li>
        </ul>
      </div>

      {/* 그룹 편집 모달 */}
      {groupModal.open && groupModal.id && editingGroup && (
        <GroupEditModal
          open={true}
          title={`조건 그룹 ${groups.findIndex(g => g.id === groupModal.id) + 1} 편집`}
          conditions={value}
          groupId={groupModal.id}
          onChange={(nextConditions) => {
            onChange(nextConditions);
            setGroupModal({ open: false, id: null });
          }}
          onClose={() => setGroupModal({ open: false, id: null })}
          preview={preview}
        />
      )}

      {/* 지표 편집 모달 */}
      {indicatorModal.open && indicatorModal.id && (
        <IndicatorEditModal
          open={true}
          title="지표 편집"
          conditions={value}
          indicatorId={indicatorModal.id}
          onChange={(next) => {
            onChange(next);
            setIndicatorModal({ open: false, id: null });
          }}
          onClose={() => setIndicatorModal({ open: false, id: null })}
        />
      )}
    </div>
  );
};
