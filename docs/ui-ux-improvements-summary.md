# UI/UX 개선 작업 요약

## 📅 작업 기간
- 브랜치: `feature/ui-ux-improvements`
- 커밋 수: 12개
- 테스트: 63/63 통과 ✅
- TypeScript: 오류 없음 ✅

## 🎯 주요 목표
edithistory.md의 요구사항에 따라 자동매매 설정 UI를 전면 개편:
- 사용자 친화적인 카드 기반 UI
- 초보자도 이해하기 쉬운 한글 도움말
- 혼동 없는 명확한 조건 표시
- 비교 연산자 기반 통합 시스템

---

## ✅ Phase 1: UI/UX 재설계 (카드 기반)

### 생성된 컴포넌트:

#### 1. **conditionFormatters.ts**
조건을 사람이 읽을 수 있는 한글로 변환
```typescript
formatIndicatorCondition(node)
// → "현재 볼린저밴드 상단 > 종가"

formatStatusCondition(node)
// → "현재 수익률 > 5%"

formatComparator('over')
// → ">"
```

#### 2. **ConditionGroupCard.tsx**
조건 그룹을 카드 형태로 표시
- 그룹 번호 표시 (조건 그룹 1, 2, 3...)
- AND/OR 배지 (노란색: 그룹 내, 파란색: 그룹 간)
- 각 조건별 편집/삭제 버튼
- 그룹 전체 편집/삭제 버튼

#### 3. **ComparatorSelector.tsx**
비교 연산자 선택 컴포넌트
- `>` (크면) - 돌파
- `<` (작으면) - 하락
- `=` (같으면) - 교차
- `≥` (이상) - 유지 이상
- `≤` (이하) - 유지 이하
- `선택안함` - 비교하지 않음

#### 4. **ComparisonTargetSelector.tsx**
비교 대상 선택 (라디오 버튼)
- 값 (value)
- 캔들 (candle)
- 다른 지표 (indicator)
- 선택 안함 (none)

#### 5. **GroupListPanelV2.tsx**
전면 재작성된 메인 패널
- ConditionGroupCard 기반
- OR 구분선 (점선 + 파란색)
- 빈 상태 안내
- 도움말 섹션

### 적용 범위:
✅ 진입(매수) 설정 - long/short
✅ 추가매수 설정 - long/short
✅ 청산(매도) 설정 - long/short
✅ 헷지 활성화 설정
✅ 손절 설정

---

## ✅ Phase 2: 비교 연산 기반 조건 시스템

### 2.1 비교 연산자 단순화
- MA/Bollinger의 action 필드 제거
- 모든 조건을 비교 연산자로 통일
- 혼동 방지 및 일관성 확보

**제거된 필드:**
```typescript
// Before
type MaCondition = {
  period: number;
  actions: MaAction[]; // ❌ 제거됨
}

type BollingerCondition = {
  band: BollingerBand;
  action: BollingerAction; // ❌ 제거됨
  touchTolerancePct?: number; // ❌ 제거됨
}

// After
type MaCondition = {
  period: number;
}

type BollingerCondition = {
  band: BollingerBand;
}
```

### 2.2 지표 세부값 선택 (Metric)

**새로운 타입:**
```typescript
export type BollingerMetric = 'upper' | 'middle' | 'lower';
export type MacdMetric = 'macd' | 'signal' | 'histogram';
export type DmiMetric = 'diplus' | 'diminus' | 'adx';
```

**IndicatorLeafNode 확장:**
```typescript
export type IndicatorLeafNode = {
  kind: 'indicator';
  indicator: IndicatorEntry;
  comparison: IndicatorComparisonLeaf | { kind: 'none' };
  metric?: string; // 현재 지표 세부값
  reference?: CandleReference; // current/previous
};
```

**사용 예시:**
- `볼린저밴드(20, 2σ) 상단`
- `현재 MACD Signal`
- `이전 DMI DI+`

### 2.3 비교 가능한 조합

#### 지표 vs 값
```
RSI(14) > 70
MACD Histogram > 0
ADX ≥ 25
```

#### 지표 vs 캔들
```
현재 캔들 High > 볼린저밴드 상단
이전 캔들 Close < MA(20)
```

#### 지표 vs 지표
```
MA(120) < 현재 볼린저밴드 중간
MACD MACD > MACD Signal
DMI DI+ > DMI DI-
```

### 2.4 Status 조건 (추가)

**StatusConditionEditor.tsx**
4가지 상태 조건 지원:
1. **현재 수익률** (profitRate) - %
2. **현재 마진 금액** (margin) - USDT/USDC
3. **매수 횟수** (buyCount) - 회
4. **진입 경과시간** (entryAge) - 일

**StatusEditModal.tsx**
- StatusConditionEditor를 모달로 감싼 UI
- 저장/취소 액션

**사용 예시:**
```
조건 그룹 1 (AND)
├─ 💰 현재 수익률 > 5%
├─ 💰 매수 횟수 < 3회
└─ 📊 RSI(14) > 70
```

---

## ✅ Phase 3: 매수 금액 설정

### BuyAmountSettings.tsx

**4가지 금액 설정 모드:**

#### 1. USDT 고정 금액
```typescript
mode: 'usdt_fixed'
usdtAmount: 100
asset: 'USDT' | 'USDC'
```
→ 모든 종목에 동일 금액 투자

#### 2. 종목별 잔고 기준 %
```typescript
mode: 'per_symbol_percent'
percentage: 5
basis: 'wallet' | 'total' | 'free'
```
→ 계산: 총 잔고 ÷ 거래종목수 × %
→ 예: 1000 USDT ÷ 10종목 × 5% = 5 USDT

#### 3. 총 잔고 기준 %
```typescript
mode: 'total_percent'
percentage: 10
basis: 'wallet' | 'total' | 'free'
```
→ 계산: 총 잔고 × %
→ 예: 1000 USDT × 10% = 100 USDT

#### 4. 현재 포지션 기준 % (추가매수)
```typescript
mode: 'position_percent'
percentage: 50
```
→ 계산: 현재 포지션 × %
→ 예: 200 USDT × 50% = 100 USDT

**추가 기능:**
- ✅ 실시간 예상 금액 계산 표시
- ✅ 계산식 표시
- ✅ 최소 주문 단위 처리 옵션
- ✅ 잔고 조회 버튼 (API 연동 대기)

---

## 📊 변경 통계

### 파일 생성
```
src/lib/trading/conditionFormatters.ts
src/components/trading/automation/ConditionGroupCard.tsx
src/components/trading/automation/ComparatorSelector.tsx
src/components/trading/automation/ComparisonTargetSelector.tsx
src/components/trading/automation/GroupListPanelV2.tsx
src/components/trading/automation/StatusConditionEditor.tsx
src/components/trading/automation/StatusEditModal.tsx
src/components/trading/automation/BuyAmountSettings.tsx
docs/GroupListPanelV2-usage.md
```

### 파일 수정
```
src/types/trading/auto-trading.ts (타입 확장)
src/components/trading/automation/AutoTradingSettingsForm.tsx (GroupListPanelV2 통합)
src/components/trading/automation/GroupEditModal.tsx (타입 가드 추가)
src/lib/trading/autoTradingDefaults.ts (action 필드 제거)
src/lib/trading/validators/autoTrading.ts (MA validation 제거)
src/test-utils/fixtures/autoTradingSettings.ts (테스트 fixtures 업데이트)
```

### 커밋 이력
```
ff1e43a feat(ui): add BuyAmountSettings component
ae90ce5 feat(ui): add Status condition editor components
2431cb0 feat(types): add indicator metric selection support
932c445 refactor: remove action fields from MA and Bollinger indicators
a0b5289 feat(ui): complete GroupListPanelV2 rollout across all sections
ed1abb3 feat(ui): integrate GroupListPanelV2 into AutoTradingSettingsForm
64181a6 feat(ui): add GroupListPanelV2 with card-based UI and simplified UX
26afd92 feat(ui): add comparison selector components for simplified condition editing
218fff1 feat(ui): add ConditionGroupCard component and condition formatters
a5e9f3e fix: resolve TypeScript error and margin test failure
```

---

## 🎨 UI/UX 개선 사항

### Before (기존)
```
[조건 추가] 버튼
- MA: 상단 돌파, 하단 돌파, 상단 유지... (혼동)
- Bollinger: 액션 선택 (터치, 돌파...)
- 그룹 구분 불명확
- AND/OR 관계 암묵적
```

### After (개선)
```
조건 그룹 1 (AND) ← 명확한 그룹 표시
├─ 📊 RSI(14) > 70 ← 아이콘 + 읽기 쉬운 표현
├─ 📊 현재 볼린저밴드 상단 > 종가 ← 세부값 선택
├─ 💰 현재 수익률 > 5% ← Status 조건
└─ [편집] [삭제] ← 각 조건별 액션

[+ 조건 추가]
[그룹 편집] [그룹 삭제] ← 그룹별 액션

────── OR ────── ← 명확한 구분선

조건 그룹 2 (AND)
...

[+ 조건 그룹 추가] ← 명확한 레이블

💡 조건 그룹 사용법 ← 초보자 도움말
• 조건 그룹: 여러 조건을 묶어서 관리
• 그룹 내 AND: 모두 만족해야 함
• 그룹 간 OR: 하나만 만족하면 됨
```

---

## 🔄 비교 연산 시스템 통합

### 기존 방식 (제거됨)
```typescript
// MA
actions: ['break_above', 'stay_above'] // ❌

// Bollinger
action: 'touch' // ❌
touchTolerancePct: 0.2 // ❌
```

### 새로운 방식 (통일)
```typescript
// IndicatorLeafNode
{
  kind: 'indicator',
  indicator: { type: 'ma', config: { period: 20 } },
  metric: undefined, // MA는 세부값 없음
  reference: 'current', // 현재/이전
  comparison: {
    kind: 'value',
    comparator: 'over',
    value: 100
  }
}
// → "현재 MA(20) > 100"

{
  kind: 'indicator',
  indicator: { type: 'bollinger', config: { ... } },
  metric: 'upper', // 상단
  reference: 'current',
  comparison: {
    kind: 'candle',
    comparator: 'under',
    field: 'high',
    reference: 'current'
  }
}
// → "현재 볼린저밴드 상단 < 현재 캔들 High"
```

---

## 🧪 테스트 결과

### 전체 테스트
```bash
Test Suites: 18 passed, 18 total
Tests:       63 passed, 63 total
Snapshots:   4 passed, 4 total
```

### TypeScript
```bash
tsc --noEmit
✅ No errors
```

### 업데이트된 테스트
- `AutoTradingSettingsForm.short-entry.test.tsx`: 버튼 선택자 업데이트
- 모든 snapshot 테스트 통과

---

## 📋 다음 단계 (차후 세션)

### Phase 4: 종목 선택 UI 전면 개편
- [ ] 종목 검색창 (USDT/USDC 구분)
- [ ] 바이낸스 API 연동
- [ ] 정렬 기준 (알파벳, 거래량, 시가총액, 상승률, 하락률)
- [ ] 선택/제외 종목 테이블
- [ ] 종목별 설정 (레버리지, 포지션, 추가매수/매도/손절)
- [ ] 종목 제외 규칙 (상장일, 거래량, 시가총액 등)

### Phase 5: 통합 및 API 연동
- [ ] BuyAmountSettings를 AutoTradingSettingsForm에 통합
- [ ] 실제 잔고 조회 API 연동
- [ ] 최소 주문 단위 검증
- [ ] 예상 주문 금액 실시간 업데이트

### Phase 6: 추가 기능
- [ ] 매도 주문 설정 (전체/일부 포지션)
- [ ] 쿨타임 설정 (분/시간/일)
- [ ] 수수료·펀딩비 계산 포함
- [ ] 로직 요약 개선

---

## 📚 참고 문서

- [edithistory.md](./edithistory.md) - 전체 요구사항
- [GroupListPanelV2-usage.md](./GroupListPanelV2-usage.md) - 사용법
- [development-priorities.md](./development-priorities.md) - 개발 우선순위
- [edithistory-implementation-plan.md](./edithistory-implementation-plan.md) - 구현 계획

---

## 💡 주요 설계 결정

### 1. 왜 전면 재작성? (Option B)
- 기존 GroupListPanel의 복잡도가 너무 높음
- 새로운 UX 요구사항과 기존 구조가 맞지 않음
- 점진적 마이그레이션보다 깔끔한 재작성이 효율적

### 2. 왜 action 필드를 제거?
- 비교 연산자와 중복되는 기능
- 사용자 혼동 유발 (예: MA "상단 돌파" vs ">" 연산자)
- 시스템 일관성 확보

### 3. 왜 metric 필드를 추가?
- 다중 값 지표 (Bollinger, MACD, DMI) 세부값 선택 필요
- "볼린저밴드 상단" vs "볼린저밴드 하단" 구분
- 유연한 조건 조합 가능

### 4. 왜 별도의 BuyAmountSettings?
- 기존 CapitalSettingsPanel이 너무 복잡
- 명확한 4가지 모드로 단순화
- edithistory.md 요구사항에 정확히 매칭

---

## 🎯 목표 달성도

### ✅ 완료
- [x] 카드 기반 UI 재설계
- [x] 초보자 친화적 한글화
- [x] 비교 연산자 통합
- [x] 지표 세부값 선택
- [x] Status 조건 추가
- [x] 매수 금액 설정 컴포넌트
- [x] 모든 섹션 통합
- [x] 테스트 통과
- [x] TypeScript 오류 제거

### 🔄 진행 중
- [ ] 종목 선택 UI (대규모 작업)
- [ ] API 연동
- [ ] 최종 통합

### ⏳ 대기 중
- [ ] 매도 주문 설정 상세
- [ ] 헷지 모드 상세 설정
- [ ] 손절 라인 검증
- [ ] 수수료 계산

---

## 🚀 배포 준비

### 체크리스트
- [x] 모든 테스트 통과
- [x] TypeScript 오류 없음
- [x] Git 브랜치 정리 (`feature/ui-ux-improvements`)
- [x] 커밋 메시지 정리 (conventional commits)
- [x] 문서화 완료
- [ ] PR 생성
- [ ] 코드 리뷰
- [ ] 메인 브랜치 병합

---

생성일: 2025-10-25
작성자: Claude Code
브랜치: feature/ui-ux-improvements
