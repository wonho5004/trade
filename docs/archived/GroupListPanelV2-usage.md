# GroupListPanelV2 사용 가이드

## 📋 개요

GroupListPanelV2는 조건 그룹 관리를 위한 새로운 UI 컴포넌트입니다. 기존 GroupListPanel의 복잡한 인터페이스를 사용자 친화적으로 개선했습니다.

---

## 🎯 주요 개선사항

### 1. 시각적 그룹 구분
- **그룹 카드**: 각 조건 그룹을 카드 형태로 명확히 구분
- **그룹 번호**: "조건 그룹 1", "조건 그룹 2" 형태로 번호 표시
- **AND/OR 배지**: 그룹 내/간 관계를 색상 배지로 표시

### 2. 명확한 버튼 명칭
- **"조건 추가" → "조건 그룹 추가"**: 무엇을 추가하는지 명확히 표시
- **개별 편집/삭제**: 각 조건마다 편집/삭제 버튼 제공
- **그룹 편집/삭제**: 그룹 전체를 편집/삭제하는 별도 버튼

### 3. 초보자 친화적 도움말
- 각 섹션마다 한글 도움말 제공
- 사용 예시 포함
- 아이콘과 색상으로 시각적 안내

---

## 🔧 기본 사용법

### 설치 및 Import

```typescript
import { GroupListPanelV2 } from '@/components/trading/automation/GroupListPanelV2';
import type { IndicatorConditions } from '@/types/trading/auto-trading';
```

### 기본 사용 예시

```typescript
function MyTradingForm() {
  const [conditions, setConditions] = useState<IndicatorConditions>({
    root: {
      kind: 'group',
      id: 'root',
      operator: 'or',
      children: []
    }
  });

  return (
    <GroupListPanelV2
      value={conditions}
      onChange={setConditions}
    />
  );
}
```

---

## 📊 컴포넌트 구조

```
GroupListPanelV2
├── 그룹 간 관계 안내 (OR 표시)
├── ConditionGroupCard (그룹 1)
│   ├── 헤더 (그룹 번호, AND 배지, 편집/삭제)
│   ├── 조건 아이템들
│   │   ├── 지표 조건 (아이콘 + 텍스트 + 편집/삭제)
│   │   ├── AND 구분선
│   │   └── 지표 조건 (...)
│   └── 조건 추가 버튼
├── OR 구분선
├── ConditionGroupCard (그룹 2)
│   └── ...
├── 조건 그룹 추가 버튼
└── 도움말 섹션
```

---

## 🎨 UI 특징

### 색상 구분
- **노란색**: 그룹 내 AND 관계
- **파란색**: 그룹 간 OR 관계
- **아이콘별 색상**:
  - 📊 지표: 파란색 테두리
  - 💰 상태: 초록색 테두리
  - 📈 캔들: 보라색 테두리
  - ⚡ 액션: 주황색 테두리

### 반응형 디자인
- 모바일: 세로 레이아웃
- 태블릿/데스크톱: 최적화된 간격

---

## 🔄 기존 GroupListPanel에서 마이그레이션

### Step 1: Import 변경

```typescript
// 기존
import { GroupListPanel } from '@/components/trading/automation/GroupListPanel';

// 변경 후
import { GroupListPanelV2 } from '@/components/trading/automation/GroupListPanelV2';
```

### Step 2: Props 단순화

GroupListPanelV2는 더 단순한 Props를 사용합니다:

```typescript
// 기존 (복잡)
<GroupListPanel
  value={conditions}
  onChange={setConditions}
  preview={{
    symbol: 'BTCUSDT',
    interval: '1h',
    direction: 'long',
    // ... 많은 옵션들
  }}
  groupPreviewInModal={true}
/>

// 변경 후 (단순)
<GroupListPanelV2
  value={conditions}
  onChange={setConditions}
  preview={{
    symbol: 'BTCUSDT',
    interval: '1h',
    direction: 'long'
  }}
/>
```

### Step 3: 상태 관리는 동일

```typescript
// 상태 구조는 변경 없음
const [conditions, setConditions] = useState<IndicatorConditions>({
  root: {
    kind: 'group',
    id: 'root',
    operator: 'or',
    children: []
  }
});
```

---

## 💡 사용 팁

### 1. 그룹 추가
사용자가 "조건 그룹 추가" 버튼을 클릭하면:
- 새로운 빈 그룹이 생성됨
- 자동으로 AND 그룹으로 설정됨
- 그룹 간은 OR로 연결됨

### 2. 조건 추가
각 그룹 카드의 "조건 추가" 버튼을 클릭하면:
- GroupEditModal이 열림
- 지표/캔들/상태 조건 선택 가능
- 저장 시 해당 그룹에 추가됨

### 3. 편집
- **개별 편집**: 조건 아이템의 "편집" 버튼 → IndicatorEditModal
- **그룹 편집**: 그룹 헤더의 "편집" 버튼 → GroupEditModal

### 4. 삭제
- 모든 삭제는 확인 다이얼로그를 거침
- 실수로 삭제하는 것 방지

---

## 🧪 테스트 시나리오

### 시나리오 1: 첫 그룹 추가
1. "조건 그룹 추가" 클릭
2. 그룹 카드가 나타남
3. "조건 추가" 클릭
4. 지표 선택 및 설정
5. 저장

**예상 결과**: 조건 그룹 1이 생성되고 지표가 표시됨

### 시나리오 2: 여러 조건 조합
1. 그룹 1: RSI > 70 AND MA(20) 돌파
2. "조건 그룹 추가"
3. 그룹 2: 볼린저밴드 상단 돌파

**예상 결과**:
- 그룹 1 OR 그룹 2 구조
- OR 구분선이 명확히 표시됨

### 시나리오 3: 조건 편집
1. 기존 조건의 "편집" 클릭
2. 파라미터 변경 (예: RSI 70 → 80)
3. 저장

**예상 결과**: 조건이 즉시 업데이트됨

---

## 🐛 알려진 제한사항

1. **중첩 그룹**: 현재 2단계 (루트 → 그룹 → 조건)만 지원
2. **Drag & Drop**: 아직 구현되지 않음 (향후 추가 예정)
3. **조건 복제**: 조건 복제 기능 미구현

---

## 🔜 향후 계획

### Phase 2
- [ ] Drag & Drop으로 조건 순서 변경
- [ ] 조건 복제 기능
- [ ] 그룹 템플릿 저장/불러오기

### Phase 3
- [ ] 조건 유효성 실시간 검증
- [ ] 조건 충돌 감지 및 경고
- [ ] 성능 최적화 (많은 조건 처리)

---

## 📞 문의 및 피드백

이 컴포넌트에 대한 피드백은 프로젝트 이슈로 등록해주세요.

---

*최종 수정: 2025-10-25*
*작성자: Claude Code*
