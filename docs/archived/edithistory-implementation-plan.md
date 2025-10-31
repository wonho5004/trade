# edithistory.md 요구사항 구현 계획

## 📋 문서 목적
이 문서는 `edithistory.md`에 명시된 모든 요구사항을 분석하고, 구현 우선순위와 상세 계획을 정리합니다.

---

## 🎯 핵심 개선 목표

### 사용자 혼동 요소 제거
1. 버튼/레이블 명확화
2. 그룹/지표 구분 시각화
3. 편집 범위 명확화
4. 관계(AND/OR) 명시

### 기능 단순화
1. 복잡한 액션 제거 → 비교 연산자로 통일
2. 편집 모달 분리 (그룹 vs 단일 지표)
3. 저장/취소 버퍼링

### 기능 확장
1. 현재 상태 조건 추가 (수익률, 마진, 매수횟수 등)
2. 잔고 조회 및 예상 투자금액
3. 종목 선택 UI 전면 개편

---

## 📊 Phase 1: 조건 편집 UI 개편 (최우선)

### 1.1 문제점 분석

#### 현재 상태
```
[조건 추가] 버튼 클릭
  → 무엇이 추가되는지 불명확
  → 지표? 그룹? 조건?

[편집] 버튼 클릭 (단일 지표)
  → 전체 그룹 편집 모달이 열림
  → 의도: 지표 하나만 수정
  → 실제: 모든 지표가 표시되어 혼란

그룹 구분 불명확
  → 여러 조건이 나열되어 있으나
  → 어디까지가 하나의 그룹인지 불명확

AND/OR 관계 불명확
  → 조건들이 어떻게 조합되는지 이해 어려움
```

#### 요구사항 (edithistory.md)
```markdown
1. 그룹 구분 표시 (조건 그룹 1/2/…)
   - 상위(예: 포지션 진입 롱/숏) 화면의 목록을 "그룹 단위 카드"로 표시
   - 그 카드 안에 지표 리스트(편집/삭제)를 넣는 형태로 수정
   - 그룹 카드에도 "그룹 삭제/그룹 편집(=그룹 내부 지표 추가/삭제/정렬)" 버튼을 함께 노출

2. 지표 단일 편집 동선
   - "지표 편집" 클릭 시 "해당 지표만" 편집하는 전용 모달(IndicatorEditModal)로 여는 방식
   - 전용 모달에는 지표 파라미터/비교 기준(캔들·다른지표·값)만 제공하고 그룹 UI는 숨김

3. '조건 그룹 추가' UX
   - 클릭 시 "빈 AND 그룹"을 추가하고, 이후 "지표 추가"로 채우는 방식

4. 비교 기준 확장 (다른 지표)
   - Bollinger 외에 "지표 세부 값" 선택이 필요한 지표 지원
   - 예: MACD: MACD/Signal/Histogram, DMI: DI+/DI-/ADX

5. 모든 섹션 일괄 적용 범위
   - 포지션 진입(롱/숏)
   - 추가매수(롱/숏)
   - 헤지 활성화
   - 포지션 정리(롱/숏)
   - 손절: Stoploss 라인(지표)

6. 저장 버퍼링
   - 현재 모달은 변경 즉시 상위 상태에 반영
   - "저장/취소"에 맞춰 모달 내 로컬 상태 버퍼 → 저장 시 커밋으로 전환

7. 라벨/문구
   - 목록 상단 제목: "추가된 조건" → "조건 그룹"
   - 항목: "조건 그룹 1, 2, …"로 표기
   - 병합 방식 표시: 그룹 카드 상단엔 "그룹 내 AND(고정)", 루트 상단엔 "그룹 간 OR(고정)" 배지
```

### 1.2 구현 설계

#### A. ConditionGroupCard 컴포넌트 (신규)

**목적**: 조건 그룹을 시각적으로 명확하게 표시

**UI 디자인**:
```typescript
┌─────────────────────────────────────────────────┐
│ 조건 그룹 1 (그룹 내: AND)      [편집] [삭제]   │
├─────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────┐ │
│ │ 📊 RSI > 70                    [편집] [삭제]│ │
│ └─────────────────────────────────────────────┘ │
│ AND                                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📈 종가 > MA(20)               [편집] [삭제]│ │
│ └─────────────────────────────────────────────┘ │
│ AND                                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ 💰 현재 수익률 > -5%           [편집] [삭제]│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ [+ 지표 추가]                                   │
└─────────────────────────────────────────────────┘
OR
┌─────────────────────────────────────────────────┐
│ 조건 그룹 2 (그룹 내: AND)      [편집] [삭제]   │
├─────────────────────────────────────────────────┤
│ ...                                             │
└─────────────────────────────────────────────────┘

[+ 조건 그룹 추가]
```

**컴포넌트 구조**:
```typescript
// src/components/trading/automation/ConditionGroupCard.tsx

interface ConditionGroupCardProps {
  groupNumber: number;
  group: ConditionGroupNode;
  onEditGroup: () => void;
  onDeleteGroup: () => void;
  onEditIndicator: (indicatorId: string) => void;
  onDeleteIndicator: (indicatorId: string) => void;
  onAddIndicator: () => void;
}

export const ConditionGroupCard = ({
  groupNumber,
  group,
  onEditGroup,
  onDeleteGroup,
  onEditIndicator,
  onDeleteIndicator,
  onAddIndicator
}: ConditionGroupCardProps) => {
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium text-zinc-100">
            조건 그룹 {groupNumber}
          </h4>
          <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
            그룹 내: AND
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onEditGroup}
            className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-zinc-500 text-zinc-300"
          >
            편집
          </button>
          <button
            onClick={onDeleteGroup}
            className="px-2 py-1 rounded text-xs border border-red-600/50 hover:border-red-500 text-red-400"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 조건 리스트 */}
      <div className="space-y-2">
        {group.children.map((child, index) => (
          <React.Fragment key={child.id}>
            {index > 0 && (
              <div className="flex items-center gap-2 my-1">
                <div className="flex-1 border-t border-zinc-700" />
                <span className="text-xs text-yellow-400 font-medium">AND</span>
                <div className="flex-1 border-t border-zinc-700" />
              </div>
            )}
            <IndicatorConditionItem
              condition={child}
              onEdit={() => onEditIndicator(child.id)}
              onDelete={() => onDeleteIndicator(child.id)}
            />
          </React.Fragment>
        ))}
      </div>

      {/* 지표 추가 버튼 */}
      <button
        onClick={onAddIndicator}
        className="mt-3 w-full py-2 rounded border border-dashed border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-zinc-300 text-sm"
      >
        + 지표 추가
      </button>
    </div>
  );
};
```

**IndicatorConditionItem 서브 컴포넌트**:
```typescript
// 각 조건을 표시하는 아이템

interface IndicatorConditionItemProps {
  condition: ConditionNode;
  onEdit: () => void;
  onDelete: () => void;
}

const IndicatorConditionItem = ({
  condition,
  onEdit,
  onDelete
}: IndicatorConditionItemProps) => {
  // 조건을 사람이 읽을 수 있는 텍스트로 변환
  const readableText = formatConditionToReadable(condition);
  const icon = getConditionIcon(condition);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-800/50 border border-zinc-700/50">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <span className="text-sm text-zinc-200">{readableText}</span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-blue-500 text-zinc-300 hover:text-blue-400"
        >
          편집
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1 rounded text-xs border border-zinc-600 hover:border-red-500 text-zinc-300 hover:text-red-400"
        >
          삭제
        </button>
      </div>
    </div>
  );
};

// 조건을 읽기 쉬운 텍스트로 변환
function formatConditionToReadable(condition: ConditionNode): string {
  if (condition.kind === 'indicator') {
    // 예: "RSI > 70"
    const ind = condition.indicator;
    if (ind.type === 'rsi') {
      return `RSI ${formatComparator(condition.comparator)} ${condition.value}`;
    }
    // ... 다른 지표 타입
  } else if (condition.kind === 'status') {
    // 예: "현재 수익률 > -5%"
    const labels = {
      profitRate: '현재 수익률',
      margin: '현재 마진',
      buyCount: '매수 횟수',
      entryAge: '진입 경과 시간'
    };
    return `${labels[condition.metric]} ${formatComparator(condition.comparator)} ${condition.value}${condition.unit || ''}`;
  }
  // ... 다른 조건 타입
}

function getConditionIcon(condition: ConditionNode): string {
  if (condition.kind === 'indicator') return '📊';
  if (condition.kind === 'status') return '💰';
  if (condition.kind === 'candle') return '📈';
  return '📌';
}

function formatComparator(comp: ComparisonOperator): string {
  const map = {
    over: '>',
    under: '<',
    eq: '=',
    gte: '>=',
    lte: '<=',
    none: ''
  };
  return map[comp] || comp;
}
```

#### B. IndicatorEditModal 컴포넌트 (신규)

**목적**: 단일 지표만 편집하는 간단한 모달

**UI 디자인**:
```typescript
┌─────────────────────────────────────────────────┐
│ 지표 편집                            [X] 닫기   │
├─────────────────────────────────────────────────┤
│                                                 │
│ 지표 유형: RSI                                  │
│                                                 │
│ 파라미터:                                       │
│ ┌─────────────────────────────────────────────┐ │
│ │ 기간 (period): [14]                         │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 비교 기준:                                      │
│ ┌─────────────────────────────────────────────┐ │
│ │ ○ 고정값                                    │ │
│ │ [70] 입력                                   │ │
│ │                                             │ │
│ │ ○ 캔들 값                                   │ │
│ │ [종가 ▼] [현재 ▼]                          │ │
│ │                                             │ │
│ │ ○ 다른 지표                                 │ │
│ │ [MA(20) ▼]                                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 비교 연산자:                                    │
│ ┌─────────────────────────────────────────────┐ │
│ │ [> ▼] 크면 (돌파)                          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 💡 RSI가 70보다 크면 과매수 구간입니다.        │
│                                                 │
│              [취소]            [저장]           │
└─────────────────────────────────────────────────┘
```

**컴포넌트 구조**:
```typescript
// src/components/trading/automation/IndicatorEditModal.tsx

interface IndicatorEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  indicator: IndicatorLeafNode;
  onSave: (updated: IndicatorLeafNode) => void;
  availableIndicators: IndicatorConfig[]; // 비교 대상으로 사용 가능한 지표 목록
}

export const IndicatorEditModal = ({
  isOpen,
  onClose,
  indicator,
  onSave,
  availableIndicators
}: IndicatorEditModalProps) => {
  // 로컬 상태 (저장 버퍼링)
  const [draft, setDraft] = useState<IndicatorLeafNode>(indicator);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setDraft(indicator);
    setHasChanges(false);
  }, [indicator, isOpen]);

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = confirm('변경사항이 저장되지 않았습니다. 닫으시겠습니까?');
      if (!confirmed) return;
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>지표 편집</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 지표 파라미터 편집 */}
          <IndicatorParamEditor
            indicator={draft.indicator}
            onChange={(updated) => {
              setDraft({ ...draft, indicator: updated });
              setHasChanges(true);
            }}
          />

          {/* 비교 기준 선택 */}
          <ComparisonTargetSelector
            comparison={draft.comparison}
            onChange={(updated) => {
              setDraft({ ...draft, comparison: updated });
              setHasChanges(true);
            }}
            availableIndicators={availableIndicators}
          />

          {/* 비교 연산자 */}
          <ComparatorSelector
            comparator={draft.comparator}
            onChange={(updated) => {
              setDraft({ ...draft, comparator: updated });
              setHasChanges(true);
            }}
          />

          {/* 도움말 */}
          <HelpText indicator={draft} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={!hasChanges}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

#### C. GroupListPanel 컴포넌트 (수정)

**현재 구조를 ConditionGroupCard 기반으로 전환**:

```typescript
// src/components/trading/automation/GroupListPanel.tsx (대폭 수정)

export const GroupListPanel = ({
  groups,
  onChange,
  direction
}: GroupListPanelProps) => {
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<{
    groupId: string;
    indicatorId: string;
    indicator: IndicatorLeafNode;
  } | null>(null);

  // 조건 그룹 추가
  const handleAddGroup = () => {
    const newGroup: ConditionGroupNode = {
      kind: 'group',
      id: generateId(),
      operator: 'and',
      children: []
    };
    onChange([...groups, newGroup]);
  };

  // 그룹 삭제
  const handleDeleteGroup = (groupId: string) => {
    if (!confirm('이 조건 그룹을 삭제하시겠습니까?')) return;
    onChange(groups.filter(g => g.id !== groupId));
  };

  // 지표 단일 편집 모달 열기
  const handleEditIndicator = (groupId: string, indicator: IndicatorLeafNode) => {
    setEditingIndicator({ groupId, indicatorId: indicator.id, indicator });
  };

  // 지표 저장
  const handleSaveIndicator = (updated: IndicatorLeafNode) => {
    if (!editingIndicator) return;

    const updatedGroups = groups.map(group => {
      if (group.id === editingIndicator.groupId) {
        return {
          ...group,
          children: group.children.map(child =>
            child.id === editingIndicator.indicatorId ? updated : child
          )
        };
      }
      return group;
    });

    onChange(updatedGroups);
    setEditingIndicator(null);
  };

  return (
    <div className="space-y-4">
      {/* 최상단: 그룹 간 관계 표시 */}
      {groups.length > 1 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30">
          <InfoIcon className="w-4 h-4 text-blue-400" />
          <span className="text-sm text-blue-300">
            그룹 간: <strong>OR</strong> (아래 그룹 중 하나만 만족하면 됨)
          </span>
        </div>
      )}

      {/* 조건 그룹 카드 목록 */}
      {groups.map((group, index) => (
        <React.Fragment key={group.id}>
          {index > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 border-t border-blue-500/30" />
              <span className="text-sm text-blue-400 font-medium px-2">OR</span>
              <div className="flex-1 border-t border-blue-500/30" />
            </div>
          )}

          <ConditionGroupCard
            groupNumber={index + 1}
            group={group}
            onEditGroup={() => setEditingGroup(group.id)}
            onDeleteGroup={() => handleDeleteGroup(group.id)}
            onEditIndicator={(indicatorId) => {
              const indicator = group.children.find(c => c.id === indicatorId) as IndicatorLeafNode;
              if (indicator) handleEditIndicator(group.id, indicator);
            }}
            onDeleteIndicator={(indicatorId) => {
              const updated = {
                ...group,
                children: group.children.filter(c => c.id !== indicatorId)
              };
              onChange(groups.map(g => g.id === group.id ? updated : g));
            }}
            onAddIndicator={() => {
              // 지표 선택 모달 열기
              // TODO: IndicatorSelectorModal
            }}
          />
        </React.Fragment>
      ))}

      {/* 조건 그룹 추가 버튼 */}
      <button
        onClick={handleAddGroup}
        className="w-full py-3 rounded-lg border-2 border-dashed border-zinc-600 hover:border-zinc-500 text-zinc-400 hover:text-zinc-300 text-sm font-medium"
      >
        + 조건 그룹 추가
      </button>

      {/* 그룹 편집 모달 (기존) */}
      {editingGroup && (
        <GroupEditModal
          groupId={editingGroup}
          group={groups.find(g => g.id === editingGroup)!}
          onSave={(updated) => {
            onChange(groups.map(g => g.id === editingGroup ? updated : g));
            setEditingGroup(null);
          }}
          onClose={() => setEditingGroup(null)}
        />
      )}

      {/* 지표 단일 편집 모달 (신규) */}
      {editingIndicator && (
        <IndicatorEditModal
          isOpen={true}
          onClose={() => setEditingIndicator(null)}
          indicator={editingIndicator.indicator}
          onSave={handleSaveIndicator}
          availableIndicators={[/* 사용 가능한 지표 목록 */]}
        />
      )}
    </div>
  );
};
```

### 1.3 비교 연산자 단순화

#### 요구사항
```markdown
지표 조건중
1. MA(이동평균선): 상단 돌파, 하단 돌파, 상단 유지, 하단 유지 항목 삭제.
2. 볼린저밴드(Boll): 액션 항목 삭제.
   이유: 비교기준값과 비교 연산 하기 때문에, 혼동을 줄 수 있음.
3. 비교 연산자: (>,<,=,<=,>=,선택안함) 항목으로 수정.
   이유: RSI,MACD,DMI 같은 경우 지정값을 기준으로 교차,유지 항목을 선택해야 하는데, 비교연산자를 사용안함.
```

#### 현재 타입 (복잡)
```typescript
// src/types/trading/auto-trading.ts

export type MaAction =
  | 'cross_over'   // 상단 돌파
  | 'cross_under'  // 하단 돌파
  | 'stay_over'    // 상단 유지
  | 'stay_under';  // 하단 유지

export type BollingerAction =
  | 'touch_upper'
  | 'touch_lower'
  | 'break_upper'
  | 'break_lower';

export interface MaCondition {
  type: 'ma';
  period: number;
  action: MaAction;
  reference?: CandleReference;
}

export interface BollingerCondition {
  type: 'bollinger';
  period: number;
  stdDev: number;
  action: BollingerAction;
  reference?: CandleReference;
}
```

#### 변경 후 타입 (단순)
```typescript
// src/types/trading/auto-trading.ts

export type ComparisonOperator =
  | 'over'   // >
  | 'under'  // <
  | 'eq'     // =
  | 'gte'    // >=
  | 'lte'    // <=
  | 'none';  // 선택안함 (비교하지 않음)

// 모든 지표가 동일한 구조 사용
export interface MaCondition {
  type: 'ma';
  period: number;
  // action 제거
}

export interface BollingerCondition {
  type: 'bollinger';
  period: number;
  stdDev: number;
  band: 'upper' | 'middle' | 'lower'; // 비교 대상 밴드
  // action 제거
}

// IndicatorLeafNode에서 통일된 비교 수행
export interface IndicatorLeafNode {
  kind: 'indicator';
  id: string;
  indicator: IndicatorConfig; // MA, Bollinger, RSI 등
  comparison: IndicatorComparison; // 무엇과 비교할지
  comparator: ComparisonOperator; // 어떻게 비교할지 (>, <, = 등)
  value?: number; // comparison.kind === 'value'일 때
}
```

#### 마이그레이션 로직
```typescript
// src/lib/trading/migrations/autoTrading.ts

function migrateIndicatorActions(oldIndicator: OldIndicatorConfig): {
  indicator: NewIndicatorConfig;
  comparator: ComparisonOperator;
  comparison: IndicatorComparison;
} {
  if (oldIndicator.type === 'ma') {
    const { action, ...rest } = oldIndicator;

    // action을 comparator로 변환
    let comparator: ComparisonOperator = 'over';
    if (action === 'cross_over' || action === 'stay_over') {
      comparator = 'over'; // >
    } else if (action === 'cross_under' || action === 'stay_under') {
      comparator = 'under'; // <
    }

    return {
      indicator: rest,
      comparator,
      comparison: { kind: 'candle', field: 'close', reference: 'current' }
    };
  }

  if (oldIndicator.type === 'bollinger') {
    const { action, ...rest } = oldIndicator;

    let comparator: ComparisonOperator = 'over';
    let band: 'upper' | 'lower' = 'upper';

    if (action === 'touch_upper' || action === 'break_upper') {
      comparator = 'over';
      band = 'upper';
    } else if (action === 'touch_lower' || action === 'break_lower') {
      comparator = 'under';
      band = 'lower';
    }

    return {
      indicator: { ...rest, band },
      comparator,
      comparison: { kind: 'candle', field: 'close', reference: 'current' }
    };
  }

  // 다른 지표는 그대로 유지
  return {
    indicator: oldIndicator,
    comparator: 'over',
    comparison: { kind: 'value', value: 0 }
  };
}
```

#### UI 컴포넌트 수정
```typescript
// src/components/trading/indicators/IndicatorParamEditor.tsx

// MA 편집 UI
const MaEditor = ({ ma, onChange }: MaEditorProps) => {
  return (
    <div>
      <Label>기간 (Period)</Label>
      <Input
        type="number"
        value={ma.period}
        onChange={(e) => onChange({ ...ma, period: parseInt(e.target.value) })}
      />
      {/* action 선택 UI 제거 */}
    </div>
  );
};

// Bollinger 편집 UI
const BollingerEditor = ({ bollinger, onChange }: BollingerEditorProps) => {
  return (
    <div className="space-y-3">
      <div>
        <Label>기간 (Period)</Label>
        <Input
          type="number"
          value={bollinger.period}
          onChange={(e) => onChange({ ...bollinger, period: parseInt(e.target.value) })}
        />
      </div>

      <div>
        <Label>표준편차 (Standard Deviation)</Label>
        <Input
          type="number"
          step="0.1"
          value={bollinger.stdDev}
          onChange={(e) => onChange({ ...bollinger, stdDev: parseFloat(e.target.value) })}
        />
      </div>

      <div>
        <Label>비교 대상 밴드</Label>
        <Select
          value={bollinger.band}
          onChange={(value) => onChange({ ...bollinger, band: value as 'upper' | 'middle' | 'lower' })}
        >
          <option value="upper">상단 밴드</option>
          <option value="middle">중간 밴드 (MA)</option>
          <option value="lower">하단 밴드</option>
        </Select>
      </div>

      {/* action 선택 UI 제거 */}
    </div>
  );
};

// 비교 연산자 선택 UI (모든 지표 공통)
const ComparatorSelector = ({ comparator, onChange }: ComparatorSelectorProps) => {
  return (
    <div>
      <Label>비교 연산자</Label>
      <Select value={comparator} onChange={onChange}>
        <option value="over">&gt; (크면 / 돌파)</option>
        <option value="under">&lt; (작으면 / 하락)</option>
        <option value="eq">= (같으면 / 교차)</option>
        <option value="gte">&gt;= (크거나 같으면 / 유지 이상)</option>
        <option value="lte">&lt;= (작거나 같으면 / 유지 이하)</option>
        <option value="none">선택안함 (비교하지 않음)</option>
      </Select>

      {/* 도움말 */}
      <HelpText className="mt-2">
        💡 팁:
        - ">" : 지표를 돌파할 때
        - ">=" : 지표 위에서 유지할 때
        - "선택안함" : 지표 값만 참조 (다른 조건과 조합 시 사용)
      </HelpText>
    </div>
  );
};
```

---

## 📊 Phase 2: 현재 상태 조건 추가

### 2.1 요구사항

```markdown
추가 매수 조건 설정 (필요조건)
- 현재 매수 기준 항목 추가
  1. USDT or USDC 기준 : 입력값 (단위:$): (>,<,=,<=,>=,선택안함) 일때의 조건 추가
  2. 최초 매수 기준 : 1~10000% : (>,<,=,<=,>=,선택안함) 일때의 조건 추가

포지션 정리(매도) 설정
- 현재 매수 기준 항목 추가
  1. USDT or USDC 기준 : 입력값 (단위:$): (>,<,=,<=,>=,선택안함) 일때의 조건 추가
  2. 최초 매수 기준 : 1~10000% : (>,<,=,<=,>=,선택안함) 일때의 조건 추가

추가매수 설정
- 조건 그룹내 현재 상태 확인 조건 추가
  1. 현재 수익율 (입력값)%,(이상/미만).
  2. 현재 마진 금액(USDT,USDC),(이상/미만).
  3. 매수 횟수 (입력값) (이상/미만).
  4. 포지션 진입시간 (입력값) 일 (이상/미만).

헤지 모드 설정
- 조건 그룹내 현재 상태 확인 조건 추가
  1. 현재 수익율 롱/숏 (입력값)%,(이상/미만).
  2. 현재 마진 금액(USDT,USDC),(이상/미만).
  3. 매수 횟수 (입력값) (이상/미만).
  4. 포지션 진입시간 (입력값) 일 (이상/미만).

포지션 포기(손절) 설정
- 조건 그룹내 현재 상태 확인 조건 추가
  1. 현재 (롱/숏/모두) 수익율  (입력값)%,(이상/미만).
  2. 현재 마진 금액(USDT,USDC),(이상/미만).
  3. 매수 횟수 (입력값) (이상/미만).
  4. 포지션 진입시간 (입력값) 일 (이상/미만).
  5. 잔고기준(Wallet, Total, Free) : 0.01 ~ 100% 미만
```

### 2.2 타입 확장

```typescript
// src/types/trading/auto-trading.ts

export type StatusMetric =
  | 'profitRate'          // 현재 수익률 (%)
  | 'profitRateLong'      // 롱 포지션 수익률 (%)
  | 'profitRateShort'     // 숏 포지션 수익률 (%)
  | 'marginAmount'        // 현재 마진 금액 (USDT)
  | 'marginAmountLong'    // 롱 마진 금액
  | 'marginAmountShort'   // 숏 마진 금액
  | 'buyCount'            // 매수 횟수
  | 'entryAge'            // 포지션 진입 후 경과 시간
  | 'walletBalance'       // 지갑 잔고 (USDT)
  | 'walletBalancePercent'// 지갑 잔고 비율 (%)
  | 'initialMarginRate';  // 초기 마진 대비 현재 마진 비율

export interface StatusLeafNode {
  kind: 'status';
  id: string;
  metric: StatusMetric;
  comparator: ComparisonOperator;
  value: number;
  unit?: 'percent' | 'USDT' | 'count' | 'hours' | 'days';
}
```

### 2.3 UI 컴포넌트 (StatusConditionEditor)

```typescript
// src/components/trading/automation/StatusConditionEditor.tsx (신규)

interface StatusConditionEditorProps {
  status: StatusLeafNode;
  onChange: (updated: StatusLeafNode) => void;
  direction?: 'long' | 'short' | 'both'; // 현재 섹션의 방향
}

export const StatusConditionEditor = ({
  status,
  onChange,
  direction
}: StatusConditionEditorProps) => {
  const metricOptions = getAvailableMetrics(direction);

  return (
    <div className="space-y-3 p-4 border border-zinc-700 rounded-lg bg-zinc-900/50">
      <h4 className="text-sm font-medium text-zinc-200">현재 상태 조건</h4>

      {/* 지표 선택 */}
      <div>
        <Label>측정 지표</Label>
        <Select
          value={status.metric}
          onChange={(value) => onChange({ ...status, metric: value as StatusMetric })}
        >
          {metricOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <HelpTooltip id={`status-metric-${status.metric}`} />
      </div>

      {/* 비교 연산자 */}
      <div>
        <Label>조건</Label>
        <Select
          value={status.comparator}
          onChange={(value) => onChange({ ...status, comparator: value as ComparisonOperator })}
        >
          <option value="over">&gt; (초과)</option>
          <option value="under">&lt; (미만)</option>
          <option value="gte">&gt;= (이상)</option>
          <option value="lte">&lt;= (이하)</option>
          <option value="eq">= (같음)</option>
        </Select>
      </div>

      {/* 값 입력 */}
      <div>
        <Label>기준값</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            value={status.value}
            onChange={(e) => onChange({ ...status, value: parseFloat(e.target.value) })}
            step={getStep(status.metric)}
          />
          <span className="flex items-center px-3 text-sm text-zinc-400">
            {getUnit(status.metric)}
          </span>
        </div>
      </div>

      {/* 예시 표시 */}
      <div className="mt-3 p-3 rounded bg-blue-500/10 border border-blue-500/30">
        <p className="text-sm text-blue-300">
          📌 조건 설명: {formatStatusConditionReadable(status)}
        </p>
        <p className="text-xs text-blue-400 mt-1">
          {getStatusExample(status.metric)}
        </p>
      </div>
    </div>
  );
};

// 방향에 따라 사용 가능한 지표 반환
function getAvailableMetrics(direction?: 'long' | 'short' | 'both') {
  const common = [
    { value: 'profitRate', label: '현재 수익률 (%)' },
    { value: 'marginAmount', label: '현재 마진 금액 (USDT)' },
    { value: 'buyCount', label: '매수 횟수' },
    { value: 'entryAge', label: '포지션 경과 시간' },
    { value: 'walletBalance', label: '지갑 잔고 (USDT)' },
    { value: 'walletBalancePercent', label: '지갑 잔고 비율 (%)' },
    { value: 'initialMarginRate', label: '초기 마진 대비 비율 (%)' }
  ];

  if (direction === 'both') {
    return [
      ...common,
      { value: 'profitRateLong', label: '롱 포지션 수익률 (%)' },
      { value: 'profitRateShort', label: '숏 포지션 수익률 (%)' },
      { value: 'marginAmountLong', label: '롱 마진 금액 (USDT)' },
      { value: 'marginAmountShort', label: '숏 마진 금액 (USDT)' }
    ];
  }

  return common;
}

function getStep(metric: StatusMetric): string {
  if (metric.includes('Rate') || metric.includes('Percent')) return '0.1';
  if (metric.includes('Amount') || metric.includes('Balance')) return '1';
  if (metric === 'buyCount') return '1';
  if (metric === 'entryAge') return '1';
  return '0.01';
}

function getUnit(metric: StatusMetric): string {
  if (metric.includes('Rate') || metric.includes('Percent')) return '%';
  if (metric.includes('Amount') || metric.includes('Balance')) return 'USDT';
  if (metric === 'buyCount') return '회';
  if (metric === 'entryAge') return '시간';
  return '';
}

function formatStatusConditionReadable(status: StatusLeafNode): string {
  const labels = {
    profitRate: '현재 수익률',
    profitRateLong: '롱 수익률',
    profitRateShort: '숏 수익률',
    marginAmount: '현재 마진',
    buyCount: '매수 횟수',
    entryAge: '진입 경과 시간',
    walletBalance: '지갑 잔고',
    walletBalancePercent: '지갑 잔고 비율',
    initialMarginRate: '초기 마진 대비 비율'
  };

  const operators = {
    over: '초과',
    under: '미만',
    gte: '이상',
    lte: '이하',
    eq: '같음'
  };

  return `${labels[status.metric] || status.metric}이(가) ${status.value}${getUnit(status.metric)} ${operators[status.comparator]}일 때`;
}

function getStatusExample(metric: StatusMetric): string {
  const examples = {
    profitRate: '예: 현재 수익률 > -5% → 손실이 5% 이하일 때만 추가 매수',
    marginAmount: '예: 현재 마진 > 1000 USDT → 마진이 1000 USDT 초과 시 헤지 활성화',
    buyCount: '예: 매수 횟수 < 3 → 최대 3번까지만 추가 매수',
    entryAge: '예: 포지션 경과 > 48시간 → 진입 후 2일 경과 시 강제 청산',
    walletBalancePercent: '예: 잔고 비율 < 10% → 잔고가 10% 미만으로 떨어지면 손절'
  };

  return examples[metric] || '';
}
```

### 2.4 평가 엔진 확장

```typescript
// src/lib/trading/engine/conditions.ts

// StatusLeafNode 평가 로직 추가
function evaluateStatusCondition(
  node: StatusLeafNode,
  context: EvaluationContext
): boolean {
  const { position, account } = context;

  let currentValue: number;

  switch (node.metric) {
    case 'profitRate':
      currentValue = position?.profitRate ?? 0;
      break;

    case 'profitRateLong':
      currentValue = position?.side === 'LONG' ? position.profitRate : 0;
      break;

    case 'profitRateShort':
      currentValue = position?.side === 'SHORT' ? position.profitRate : 0;
      break;

    case 'marginAmount':
      currentValue = position?.margin ?? 0;
      break;

    case 'buyCount':
      currentValue = position?.scaleInCount ?? 0;
      break;

    case 'entryAge':
      if (!position?.entryTime) return false;
      const ageMs = Date.now() - position.entryTime.getTime();
      const ageHours = ageMs / (1000 * 60 * 60);
      currentValue = ageHours;
      break;

    case 'walletBalance':
      currentValue = account?.walletBalance ?? 0;
      break;

    case 'walletBalancePercent':
      const total = account?.totalBalance ?? 0;
      const wallet = account?.walletBalance ?? 0;
      currentValue = total > 0 ? (wallet / total) * 100 : 0;
      break;

    case 'initialMarginRate':
      const initial = position?.initialMargin ?? 1;
      const current = position?.margin ?? 0;
      currentValue = (current / initial) * 100;
      break;

    default:
      return false;
  }

  // 비교 연산자 적용
  return compareValues(currentValue, node.comparator, node.value);
}

function compareValues(
  current: number,
  operator: ComparisonOperator,
  target: number
): boolean {
  const EPSILON = 0.0001; // 부동소수점 오차 허용

  switch (operator) {
    case 'over':
      return current > target + EPSILON;
    case 'under':
      return current < target - EPSILON;
    case 'gte':
      return current >= target - EPSILON;
    case 'lte':
      return current <= target + EPSILON;
    case 'eq':
      return Math.abs(current - target) < EPSILON;
    case 'none':
      return true; // 비교하지 않음
    default:
      return false;
  }
}
```

---

## 📊 Phase 3: 종목 선택 UI 전면 개편

(문서 길이 제한으로 인해 다음 응답에서 계속...)

이 문서는 계속 작성 중이며, 다음 섹션들을 포함할 예정입니다:
- Phase 3: 종목 선택 UI 전면 개편
- Phase 4: 매수금액 설정 완성
- Phase 5: 도움말 시스템 구축
- 테스트 계획
- 마일스톤 및 체크포인트

---

*최종 수정: 2025-10-25*
*다음 업데이트: Phase 3 이후 섹션 추가*
