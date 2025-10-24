'use client';

import React from 'react';
import type { ConditionGroupNode, ConditionNode } from '@/types/trading/auto-trading';
import { formatConditionToReadable, getConditionIcon, getConditionColorClass } from '@/lib/trading/conditionFormatters';

interface ConditionGroupCardProps {
  /** 그룹 번호 (1부터 시작) */
  groupNumber: number;
  /** 조건 그룹 데이터 */
  group: ConditionGroupNode;
  /** 그룹 편집 핸들러 */
  onEditGroup: () => void;
  /** 그룹 삭제 핸들러 */
  onDeleteGroup: () => void;
  /** 개별 조건 편집 핸들러 */
  onEditCondition: (conditionId: string) => void;
  /** 개별 조건 삭제 핸들러 */
  onDeleteCondition: (conditionId: string) => void;
  /** 조건 추가 핸들러 */
  onAddCondition: () => void;
}

/**
 * 조건 그룹을 카드 형태로 표시하는 컴포넌트
 * - 그룹 내 조건들을 시각적으로 구분
 - AND/OR 관계를 명확히 표시
 * - 각 조건에 대한 편집/삭제 버튼 제공
 */
export const ConditionGroupCard: React.FC<ConditionGroupCardProps> = ({
  groupNumber,
  group,
  onEditGroup,
  onDeleteGroup,
  onEditCondition,
  onDeleteCondition,
  onAddCondition
}) => {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4 shadow-lg">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-zinc-100">
            조건 그룹 {groupNumber}
          </h4>
          <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 font-medium">
            그룹 내: {group.operator === 'and' ? 'AND' : 'OR'}
          </span>
          {group.children.length === 0 && (
            <span className="text-xs text-zinc-500 ml-2">
              (조건 없음)
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEditGroup}
            className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-zinc-500 text-zinc-300 hover:text-zinc-100 transition-colors"
            title="그룹 전체 편집"
          >
            편집
          </button>
          <button
            onClick={onDeleteGroup}
            className="px-2 py-1 rounded text-xs border border-red-600/50 hover:border-red-500 text-red-400 hover:text-red-300 transition-colors"
            title="그룹 삭제"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 조건 리스트 */}
      {group.children.length > 0 ? (
        <div className="space-y-2">
          {group.children.map((child, index) => (
            <React.Fragment key={child.id}>
              {index > 0 && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 border-t border-zinc-700" />
                  <span className="text-xs text-yellow-400 font-bold px-2">
                    {group.operator === 'and' ? 'AND' : 'OR'}
                  </span>
                  <div className="flex-1 border-t border-zinc-700" />
                </div>
              )}
              <ConditionItem
                condition={child}
                onEdit={() => onEditCondition(child.id)}
                onDelete={() => onDeleteCondition(child.id)}
              />
            </React.Fragment>
          ))}
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-zinc-500">
          조건이 없습니다. 아래 버튼을 눌러 조건을 추가하세요.
        </div>
      )}

      {/* 조건 추가 버튼 */}
      <button
        onClick={onAddCondition}
        className="mt-4 w-full py-2 rounded border border-dashed border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-zinc-300 text-sm transition-colors"
      >
        + 조건 추가
      </button>
    </div>
  );
};

/**
 * 개별 조건 아이템 표시 컴포넌트
 */
interface ConditionItemProps {
  condition: ConditionNode;
  onEdit: () => void;
  onDelete: () => void;
}

const ConditionItem: React.FC<ConditionItemProps> = ({
  condition,
  onEdit,
  onDelete
}) => {
  // 그룹 노드는 여기서 렌더링하지 않음 (재귀적 표시는 추후 필요시 구현)
  if (condition.kind === 'group') {
    return (
      <div className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getConditionIcon(condition)}</span>
            <span className="text-sm text-zinc-200">
              중첩 그룹 ({condition.children.length}개 조건)
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-blue-500 text-zinc-300 hover:text-blue-400 transition-colors"
            >
              편집
            </button>
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-red-500 text-zinc-300 hover:text-red-400 transition-colors"
            >
              삭제
            </button>
          </div>
        </div>
      </div>
    );
  }

  const readableText = formatConditionToReadable(condition);
  const icon = getConditionIcon(condition);
  const colorClass = getConditionColorClass(condition);

  return (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${colorClass}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-lg flex-shrink-0">{icon}</span>
        <span className="text-sm text-zinc-200 truncate" title={readableText}>
          {readableText}
        </span>
      </div>
      <div className="flex gap-2 flex-shrink-0 ml-3">
        <button
          onClick={onEdit}
          className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-blue-500 text-zinc-300 hover:text-blue-400 transition-colors"
          title="이 조건만 편집"
        >
          편집
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-red-500 text-zinc-300 hover:text-red-400 transition-colors"
          title="이 조건 삭제"
        >
          삭제
        </button>
      </div>
    </div>
  );
};
