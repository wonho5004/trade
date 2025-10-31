# 개발 가이드

> 최종 업데이트: 2025-10-25

이 문서는 프로젝트 개발 시 따라야 할 가이드라인, 컨벤션, 그리고 구현 패턴을 정의합니다.

---

## 🎯 개발 철학

프로젝트의 모든 개발은 다음 원칙을 따릅니다:

### 1. 사용자 중심
- 초보자도 쉽게 이해할 수 있는 UI/UX
- 한글 도움말 제공
- 직관적인 인터페이스

### 2. 명확성
- 혼동을 줄 수 있는 용어/UI 제거
- 버튼 명칭 명확화 (예: "조건 추가" → "조건 그룹 추가")
- 시각적 구분 (색상, 아이콘, 레이아웃)

### 3. 안전성
- 실수를 방지하는 검증 시스템
- 확인 다이얼로그 (삭제, 주문 등)
- 안전장치 (최대 주문 수, 금액 제한)

### 4. 단계적 진행
- 각 단계 검증 후 다음 단계 진행
- 명확한 진행 상태 표시
- 에러 발생 시 명확한 안내

### 5. 문서화
- 모든 기능에 대한 상세 도움말
- 인라인 툴팁 및 모달 도움말
- 코드 주석 및 개발 문서

---

## 📁 프로젝트 구조

```
src/
├── app/                      # Next.js App Router
│   ├── (auth)/              # 인증 관련 페이지 (라우트 그룹)
│   │   ├── login/
│   │   └── register/
│   ├── dashboard/           # 메인 대시보드
│   ├── trading/             # 거래 페이지
│   │   └── automation/      # 자동매매 설정
│   ├── admin/               # 관리자 페이지
│   ├── ops/                 # 시스템 관리자 페이지
│   └── api/                 # API Routes
│       ├── binance/         # 바이낸스 프록시
│       ├── trading/         # 거래 API
│       ├── markets/         # 마켓 데이터
│       └── strategies/      # 전략 저장/로드
├── components/              # React 컴포넌트
│   ├── chart/              # 차트 관련
│   ├── trading/            # 거래 UI
│   │   ├── automation/     # 자동매매 설정 컴포넌트
│   │   ├── indicators/     # 지표 설정 컴포넌트
│   │   └── wizard/         # 셋업 위저드
│   ├── ui/                 # shadcn/ui 기본 컴포넌트
│   ├── auth/               # 인증 UI
│   ├── common/             # 공통 컴포넌트
│   ├── mypage/             # 마이페이지
│   └── ops/                # 운영 도구
├── lib/                    # 유틸리티 및 로직
│   ├── trading/            # 거래 로직
│   │   ├── engine/         # 자동매매 엔진
│   │   ├── validators/     # 검증 로직
│   │   └── migrations/     # 데이터 마이그레이션
│   ├── analysis/           # 기술적 분석
│   ├── chart/              # 차트 유틸리티
│   ├── supabase/           # Supabase 클라이언트
│   ├── auth/               # 인증 로직
│   └── utils/              # 공통 유틸리티
├── stores/                 # Zustand 상태 관리
│   ├── chartStore.ts
│   ├── indicatorConfigStore.ts
│   ├── autoTradingSettingsStore.ts
│   ├── marketDataStore.ts
│   └── accountStore.ts
├── hooks/                  # 커스텀 훅
├── types/                  # TypeScript 타입 정의
│   ├── trading/
│   ├── chart.ts
│   ├── indicator.ts
│   └── supabase.ts
└── test-utils/             # 테스트 유틸리티
```

---

## 🎨 코딩 컨벤션

### TypeScript

#### 타입 우선
```typescript
// ✅ Good: 명시적 타입 정의
interface UserProfile {
  id: string;
  email: string;
  role: 'user' | 'admin' | 'sys_admin';
}

// ❌ Bad: any 사용
const user: any = { ... };
```

#### Type Import
```typescript
// ✅ Good: type import 사용
import type { UserProfile } from '@/types/user';

// ❌ Bad: 값과 타입을 구분하지 않음
import { UserProfile } from '@/types/user';
```

#### 네이밍 컨벤션
```typescript
// 인터페이스/타입: PascalCase
interface TradingStrategy { }
type OrderSide = 'buy' | 'sell';

// 상수: UPPER_SNAKE_CASE
const MAX_POSITION_SIZE = 1000;
const DEFAULT_LEVERAGE = 10;

// 함수/변수: camelCase
const calculateProfit = (entry: number, exit: number) => { };
const currentPrice = 50000;

// 컴포넌트: PascalCase
const ChartControlPanel = () => { };

// 훅: camelCase + use 접두사
const useConditionsEvaluator = () => { };

// 스토어: camelCase + Store 접미사
const useChartStore = create<ChartState>(...);
```

### React 컴포넌트

#### 함수형 컴포넌트 사용
```typescript
// ✅ Good
export function ChartPanel() {
  return <div>...</div>;
}

// ✅ Good (화살표 함수도 허용)
export const ChartPanel = () => {
  return <div>...</div>;
};
```

#### Props 타입 정의
```typescript
// ✅ Good: Props 인터페이스 정의
interface ChartPanelProps {
  symbol: string;
  interval: IntervalOption;
  onIntervalChange?: (interval: IntervalOption) => void;
}

export function ChartPanel({ symbol, interval, onIntervalChange }: ChartPanelProps) {
  // ...
}
```

#### 클라이언트 컴포넌트 명시
```typescript
// 클라이언트 컴포넌트 (상태, 이벤트 핸들러 사용)
'use client';

import { useState } from 'react';

export function InteractiveButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

```typescript
// 서버 컴포넌트 (기본값, 'use client' 불필요)
export async function DataDisplay() {
  const data = await fetchData();
  return <div>{data}</div>;
}
```

### 파일 구조

#### 컴포넌트 파일
```
ComponentName/
├── index.tsx           # 메인 컴포넌트
├── ComponentName.tsx   # 또는 직접 파일명 사용
├── types.ts            # 컴포넌트 전용 타입
├── hooks.ts            # 컴포넌트 전용 훅
└── __tests__/          # 테스트 파일
    └── ComponentName.test.tsx
```

#### 배럴 Export 최소화
```typescript
// ❌ Bad: 과도한 배럴 export
export * from './ComponentA';
export * from './ComponentB';
// ... (50개)

// ✅ Good: 필요한 경우만 선택적으로
export { SpecificComponent } from './SpecificComponent';
```

---

## 🔧 상태 관리 (Zustand)

### Store 생성 패턴

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 1. 타입 정의
interface MyState {
  count: number;
  increment: () => void;
  reset: () => void;
}

// 2. 기본값 생성 함수
const createDefaultState = () => ({
  count: 0,
});

// 3. Store 생성
export const useMyStore = create<MyState>()(
  persist(
    (set) => ({
      ...createDefaultState(),
      increment: () => set((state) => ({ count: state.count + 1 })),
      reset: () => set(createDefaultState()),
    }),
    {
      name: 'my-store',
      version: 1,
      // 4. 마이그레이션 로직
      migrate: (persistedState, version) => {
        // 버전별 마이그레이션
        return persistedState;
      },
    }
  )
);
```

### Store 사용

```typescript
// ✅ Good: 필요한 상태만 구독
function Counter() {
  const count = useMyStore((state) => state.count);
  const increment = useMyStore((state) => state.increment);

  return <button onClick={increment}>{count}</button>;
}

// ❌ Bad: 전체 상태 구독 (불필요한 리렌더링)
function Counter() {
  const state = useMyStore();
  return <button onClick={state.increment}>{state.count}</button>;
}
```

### 영속화 (Persist)

```typescript
// SSR 안전한 Storage 설정
const emptyStorage: Storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
  clear: () => undefined,
  key: () => null,
  length: 0,
};

export const useMyStore = create<MyState>()(
  persist(
    (set) => ({ /* ... */ }),
    {
      name: 'my-store',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? window.localStorage : emptyStorage
      ),
      partialize: (state) => ({
        // 저장할 필드만 선택
        count: state.count,
      }),
    }
  )
);
```

---

## 📊 인디케이터 개발 가이드

### 공통 패널 요구사항

모든 지표 설정 패널은 다음 패턴을 따릅니다:

1. **입력값**: 기간, 길이, 배수 등 계산 파라미터
2. **스타일**: 색상, 선 종류, 선 굵기, 투명도
3. **드로잉 조건**: 지표 값 기반 마커/오버레이 표시
4. **초기화 버튼**: 해당 지표만 기본값으로 리셋
5. **요약 정보**: 현재 설정 요약 표시

### 지표별 사양

#### MA (Moving Average)

**입력 기본값**
- 기간: 120
- 최대 5개 라인 추가 가능

**스타일 옵션**
- 각 라인별 색상, 선 종류, 선 굵기 개별 지정

**드로잉 조건**
- 공통 캔들 조건 (high/open/close/low)
- MA 기준값 대비 `over/under` 구간에 배경 오버레이
- 투명도 조절 가능 (기본 12%)
- 추가 조건 블록 생성 가능 (AND/OR/ELSE)

**구현 예시**
```typescript
// indicatorConfigStore.ts
const createMaConfig = (length: number, color: string): MaConfig => ({
  id: createId(),
  length,
  color,
  lineWidth: 2,
  lineStyle: 'solid',
  highlight: {
    candleField: 'close',
    opacity: 0.12,
    over: { enabled: false, color: '#22c55e', markerShape: 'arrowUp' },
    under: { enabled: false, color: '#ef4444', markerShape: 'arrowDown' },
  },
});
```

#### BOLL (Bollinger Bands)

**입력 기본값**
- Period: 20
- StdDev: 2
- Source: close

**스타일 옵션**
- Median/Upper/Lower 라인별 색상, 선 종류, 선 굵기
- 배경 투명도 (기본 5%)

**드로잉 조건**
- 공통 캔들 조건과 결합
- 상단/중단/하단 밴드 기준 선택
- AND/OR/ELSE 조합 지원

#### RSI (Relative Strength Index)

**입력 기본값**
- 기간: 14
- 한계선: 상단 70, 중간 50, 하단 30

**스타일 옵션**
- Plot 라인 색상, 선 종류, 선 굵기
- Upper/Middle/Lower 한계선 스타일
- 배경 투명도 (기본 10%)

**드로잉 조건**
- RSI 값 0~100 범위 기준
- `over/under` 구간 색상 오버레이
- 과매수(70+) / 과매도(30-) 조건

#### MACD

**입력 기본값**
- Fast Length: 12
- Slow Length: 26
- Signal Length: 9
- Source: close
- Oscillator/Signal MA Type: EMA

**스타일 옵션**
- 히스토그램 컬럼 색상 (4개)
- MACD 라인, Signal 라인 스타일

**드로잉 조건**
- 히스토그램 상승/하락 전환 시 화살표
- MACD·Signal 교차 시 화살표
- 메인 캔들 차트에 표시

#### DMI (Directional Movement Index)

**입력 기본값**
- DI Length: 14
- ADX Smoothing: 14

**스타일 옵션**
- `+DI`, `-DI`, `DX`, `ADX`, `ADXR` 각각의 색상, 선 종류, 선 굵기

**드로잉 조건**
- `+DI > -DI` 또는 `<` 구간 배경 오버레이
- ADX/ADXR 0~100 `over/under` 구간 오버레이
- 지정값 도달 시 화살표 표시

### 새 지표 추가 체크리스트

- [ ] `src/lib/analysis/indicators.ts`에 계산 로직 추가
- [ ] `src/types/indicator.ts`에 Config 타입 정의
- [ ] `indicatorConfigStore.ts`에 상태 관리 추가
  - [ ] Default config 정의
  - [ ] Update/reset 메서드
  - [ ] 버전 관리 및 마이그레이션
- [ ] `src/components/trading/indicators/`에 UI 컴포넌트 생성
- [ ] `ChartControlPanel.tsx`에 통합
- [ ] `CandlestickChart.tsx`에 렌더링 로직 추가
- [ ] 이 문서에 사양 추가

---

## 🤖 자동매매 개발 가이드

### 조건 시스템 구조

자동매매는 **조건 트리(Condition Tree)** 기반으로 동작합니다.

```typescript
// 조건 트리 구조
interface ConditionGroup {
  operator: 'AND' | 'OR';
  conditions: Array<ConditionLeaf | ConditionGroup>;
}

interface ConditionLeaf {
  type: 'indicator' | 'candle' | 'status';
  indicator?: IndicatorType;
  field?: CandleField;
  comparator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'crossUp' | 'crossDown';
  target: number | 'value' | IndicatorMetric;
}
```

### 조건 평가 흐름

1. **조건 정의** (`ConditionsEditorModal.tsx`)
   - 사용자가 조건 그룹 및 개별 조건 생성
   - Zustand 스토어에 저장

2. **조건 평가** (`src/lib/trading/engine/conditions.ts`)
   - `evaluateConditionNode`: 재귀적으로 조건 트리 평가
   - `evaluateLeafCondition`: 개별 조건 평가
   - 지표 값은 `indicatorSignals.ts`에서 계산

3. **시그널 생성** (`src/lib/trading/engine/indicatorSignals.ts`)
   - 현재 캔들 데이터로 지표 값 계산
   - MA, RSI, MACD, Bollinger, DMI 등

4. **주문 계획** (`src/lib/trading/engine/orderPlanner.ts`)
   - 조건 충족 시 주문 파라미터 생성
   - 포지션 크기, 레버리지, 진입가 계산

5. **실시간 실행 엔진** (`src/lib/trading/execution/ExecutionEngine.ts`) ✅ 완료
   - 전략 로드 및 정규화 (`loadActiveStrategies`, `normalizeStrategy`)
   - WebSocket 기반 실시간 마켓 데이터 스트림
   - 1초 간격 전략 평가 (`evaluateStrategy`)
   - 조건 충족 시 자동 주문 실행

6. **주문 실행** (`src/lib/trading/execution/OrderExecutor.ts`) ✅ 완료
   - 진입 주문: `executeEntry()`
   - 청산 주문: `executeExit()`
   - 주문 수량 자동 계산 (`calculateOrderQuantity`)
   - 레버리지 설정 (`setLeverage`)
   - Binance Futures API 연동

7. **포지션 추적** (`src/lib/trading/execution/PositionTracker.ts`) ✅ 완료
   - 실시간 포지션 상태 관리
   - 손익 계산 및 업데이트
   - `positions` 테이블에 데이터 저장
   - 청산 시 realized PnL 계산

### 새 조건 타입 추가

1. **타입 정의** (`src/types/trading/auto-trading.ts`)
```typescript
export type NewConditionType = {
  type: 'newCondition';
  parameter: string;
  threshold: number;
};
```

2. **평가 로직** (`src/lib/trading/engine/conditions.ts`)
```typescript
function evaluateLeafCondition(condition: ConditionLeaf, data: MarketData): boolean {
  if (condition.type === 'newCondition') {
    const value = calculateNewCondition(data, condition.parameter);
    return compareValues(value, condition.threshold, condition.comparator);
  }
  // ...
}
```

3. **UI 컴포넌트** (`ConditionsEditorModal.tsx`)
```typescript
// 조건 선택 드롭다운에 추가
<Select value={condition.type} onChange={handleTypeChange}>
  <option value="indicator">지표</option>
  <option value="candle">캔들</option>
  <option value="status">현재 상태</option>
  <option value="newCondition">새 조건</option>
</Select>
```

4. **포매터** (`src/lib/trading/conditionFormatters.ts`)
```typescript
export function formatCondition(condition: ConditionLeaf): string {
  if (condition.type === 'newCondition') {
    return `새 조건: ${condition.parameter} ${formatComparator(condition.comparator)} ${condition.threshold}`;
  }
  // ...
}
```

### 자동매매 백엔드 API

#### API 명세

**GET /api/trading/binance/futures-symbols**
```typescript
// 응답
{
  markets: Array<{
    symbol: string;          // "BTCUSDT"
    base: string;            // "BTC"
    quote: string;           // "USDT"
    minNotional: number;     // 최소 주문 금액
    minQty: number;          // 최소 주문 수량
    pricePrecision: number;  // 가격 소수점 자릿수
    quantityPrecision: number; // 수량 소수점 자릿수
    leverageBrackets: Array<{
      bracket: number;
      initialLeverage: number;
      notionalCap: number;
      notionalFloor: number;
      maintMarginRatio: number;
    }>;
  }>;
}
```

**GET /api/trading/binance/account?symbol=BTCUSDT**
```typescript
// 응답
{
  ok: boolean;
  account: {
    walletUSDT: number;              // USDT 지갑 잔고
    positionNotionalUSDT: number;    // 포지션 금액 (근사값)
    positions: Array<{
      symbol: string;
      side: 'LONG' | 'SHORT' | 'BOTH';
      positionAmt: number;
      entryPrice: number;
      unrealizedProfit: number;
      leverage: number;
    }>;
  };
}
```

**POST /api/trading/binance/place-order**
```typescript
// 요청
{
  symbol: string;                      // "BTCUSDT"
  orders?: PlannedOrder[];             // 주문 계획 배열
  payloads?: BinancePayload[];         // 또는 직접 바이낸스 포맷
  dryRun: boolean;                     // true: 모의, false: 실전
  safety?: {
    maxOrders: number;                 // 최대 주문 수
    maxNotional: number;               // 1건 최대 금액
  };
  positionMode?: 'one_way' | 'hedge'; // 포지션 모드 검증
}

// 응답 (dryRun: true)
{
  ok: boolean;
  dryRun: true;
  payloads: BinancePayload[];
}

// 응답 (dryRun: false)
{
  ok: boolean;
  dryRun: false;
  results: Array<{
    ok: boolean;
    request: BinancePayload;
    response?: any;                    // 성공 시 응답
    error?: string;                    // 실패 시 에러
    code?: string;                     // 에러 코드
    hint?: string;                     // 에러 힌트
  }>;
}
```

#### 표현식(가격 참조) 문법

자동매매에서 가격을 참조할 때 사용하는 표현식 문법입니다.

**지표 ID 참조**
```
ind-xxxx  # 조건 트리 내 지표 노드 ID
```

**교차 표현식**
```
expr:cross:<A>:<B>:dir=up|down|both:when=recent|previous

# 예시
expr:cross:ind-ma20:close:dir=up:when=recent
# → MA20과 종가의 상향 교차 (최근 봉)
```

**최소/최대/평균/비율**
```
expr:min:<A>:<B>      # A와 B 중 최소값
expr:max:<A>:<B>      # A와 B 중 최대값
expr:avg:<A>:<B>      # A와 B의 평균
expr:ratio:<A>:<B>    # A / B 비율
```

**오프셋 퍼센트**
```
expr:offset:<A>:pct=<-1000..1000>

# 예시
expr:offset:close:pct=5
# → 현재 종가의 +5% 가격
```

**해석 규칙**
- 모든 표현식은 봉 단위로 계산됩니다
- 교차값은 교차 봉에서 `(A+B)/2`로 근사합니다
- 보간 옵션: `interp=linear`을 추가하면 직선 보간 교차 지점 계산

#### 안전장치

**클라이언트**
- 주문 전 확인 다이얼로그
- 최대 주문 수 제한
- 1건 최대 금액 제한

**서버**
```typescript
// src/app/api/trading/binance/place-order/route.ts
const DEFAULT_SAFETY = {
  maxOrders: 10,
  maxNotional: 100000  // USDT
};

// 안전장치 검증
if (orders.length > safety.maxOrders) {
  return NextResponse.json(
    { error: `주문 수가 ${safety.maxOrders}개를 초과했습니다.` },
    { status: 400 }
  );
}
```

**에러 코드 매핑**
```typescript
// src/lib/trading/exchange/errorHints.ts
export const ERROR_HINTS: Record<string, string> = {
  'FILTER_NOTIONAL': '주문 금액이 최소 금액보다 작습니다.',
  'INSUFFICIENT_MARGIN': '마진이 부족합니다.',
  'FILTER_PRICE': '가격이 허용 범위를 벗어났습니다.',
  'FILTER_LOT_SIZE': '수량이 허용 범위를 벗어났습니다.',
  // ...
};
```

### GroupListPanelV2 컴포넌트 가이드

조건 그룹 관리를 위한 새로운 UI 컴포넌트입니다.

#### 주요 특징

1. **시각적 그룹 구분**
   - 그룹 카드: 각 조건 그룹을 카드로 명확히 구분
   - 그룹 번호: "조건 그룹 1", "조건 그룹 2" 형태
   - AND/OR 배지: 노란색(AND), 파란색(OR)

2. **명확한 버튼**
   - "조건 그룹 추가": 무엇을 추가하는지 명확
   - 개별 편집/삭제: 각 조건마다 버튼 제공
   - 그룹 편집/삭제: 그룹 전체 제어

3. **초보자 친화적**
   - 한글 도움말
   - 사용 예시
   - 아이콘 및 색상 가이드

#### 기본 사용법

```typescript
import { GroupListPanelV2 } from '@/components/trading/automation/GroupListPanelV2';
import type { IndicatorConditions } from '@/types/trading/auto-trading';

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
      preview={{
        symbol: 'BTCUSDT',
        interval: '1h',
        direction: 'long'
      }}
    />
  );
}
```

#### UI 구조

```
GroupListPanelV2
├── 그룹 간 관계 안내 (OR)
├── ConditionGroupCard (그룹 1)
│   ├── 헤더 (번호, AND 배지, 편집/삭제)
│   ├── 조건 목록
│   │   ├── 📊 지표 조건 (편집/삭제)
│   │   ├── AND 구분선
│   │   └── 📈 캔들 조건 (편집/삭제)
│   └── 조건 추가 버튼
├── OR 구분선 (점선)
├── ConditionGroupCard (그룹 2)
│   └── ...
└── 조건 그룹 추가 버튼
```

#### 색상 구분

- **노란색**: 그룹 내 AND 관계
- **파란색**: 그룹 간 OR 관계
- **아이콘 색상**:
  - 📊 지표: 파란색 테두리
  - 💰 상태: 초록색 테두리
  - 📈 캔들: 보라색 테두리

#### 마이그레이션 (GroupListPanel → V2)

```typescript
// 기존
import { GroupListPanel } from '@/components/trading/automation/GroupListPanel';

<GroupListPanel
  value={conditions}
  onChange={setConditions}
  // ... 많은 props
/>

// 변경 후
import { GroupListPanelV2 } from '@/components/trading/automation/GroupListPanelV2';

<GroupListPanelV2
  value={conditions}
  onChange={setConditions}
  preview={{ symbol, interval, direction }}
/>
```

---

## 🗄️ 데이터베이스 (Supabase)

### 테이블 스키마 (현재)

```sql
-- profiles 테이블
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'user',
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 정책
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- strategies: 자동매매 전략 저장 ✅ 구현됨
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  settings JSONB NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- positions: 포지션 추적 ✅ 구현됨
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'LONG' | 'SHORT'
  direction TEXT NOT NULL, -- 'long' | 'short'
  entry_price DECIMAL NOT NULL,
  exit_price DECIMAL,
  quantity DECIMAL NOT NULL,
  leverage INT NOT NULL,
  unrealized_pnl DECIMAL,
  realized_pnl DECIMAL,
  fees DECIMAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'opened', -- 'opened' | 'closed'
  opened_at TIMESTAMPTZ NOT NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 향후 추가 예정 테이블

```sql
-- chart_settings: 차트 설정 저장
CREATE TABLE chart_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  overlays JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, symbol, interval)
);

-- trading_logs: 거래 로그
CREATE TABLE trading_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  strategy_id UUID REFERENCES strategies(id) ON DELETE SET NULL,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL, -- 'BUY' | 'SELL'
  type TEXT NOT NULL, -- 'MARKET' | 'LIMIT'
  quantity DECIMAL NOT NULL,
  price DECIMAL,
  executed_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL, -- 'PENDING' | 'FILLED' | 'CANCELLED' | 'FAILED'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 데이터 마이그레이션

Supabase 마이그레이션은 SQL 파일로 관리합니다:

```bash
# 마이그레이션 파일 생성
supabase migration new add_strategies_table

# 마이그레이션 적용
supabase db push
```

---

## 🧪 테스트 가이드

### 테스트 구조

```
src/
├── lib/
│   └── trading/
│       ├── engine/
│       │   ├── conditions.ts
│       │   └── __tests__/
│       │       └── conditions.test.ts
│       └── margin.ts
│       └── __tests__/
│           └── margin.test.ts
└── components/
    └── trading/
        └── automation/
            ├── ConditionsEditorModal.tsx
            └── __tests__/
                ├── ConditionsEditorModal.test.tsx
                └── ConditionsEditorModal.snapshot.test.tsx
```

### 유닛 테스트

```typescript
// src/lib/trading/__tests__/margin.test.ts
import { calculateRequiredMargin } from '../margin';

describe('calculateRequiredMargin', () => {
  it('should calculate margin correctly', () => {
    const result = calculateRequiredMargin({
      price: 50000,
      quantity: 1,
      leverage: 10,
    });

    expect(result).toBe(5000);
  });

  it('should handle edge cases', () => {
    expect(() => calculateRequiredMargin({ price: 0, quantity: 1, leverage: 10 }))
      .toThrow('Price must be positive');
  });
});
```

### 컴포넌트 테스트

```typescript
// src/components/__tests__/Button.test.tsx
import { render, screen } from '@/test-utils/render';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<Button onClick={onClick}>Click me</Button>);

    await userEvent.click(screen.getByText('Click me'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
```

### Snapshot 테스트

```typescript
// src/components/__tests__/Modal.snapshot.test.tsx
import { render } from '@/test-utils/render';
import { Modal } from '../Modal';

describe('Modal snapshots', () => {
  it('matches snapshot when open', () => {
    const { container } = render(
      <Modal isOpen title="Test Modal">
        Content
      </Modal>
    );
    expect(container).toMatchSnapshot();
  });
});
```

---

## 🚀 API Routes 개발

### Route Handler 패턴

```typescript
// src/app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    // 1. 인증 확인
    const supabase = getSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. 요청 파라미터 추출
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    // 3. 비즈니스 로직 실행
    const data = await fetchData(symbol);

    // 4. 응답 반환
    return NextResponse.json({ data }, { status: 200 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // POST 로직
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
```

### API 에러 핸들링

```typescript
// src/lib/api/errors.ts
export class APIError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export function handleAPIError(error: unknown): NextResponse {
  if (error instanceof APIError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    );
  }

  console.error('Unexpected error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}
```

---

## 🔐 보안 체크리스트

### 클라이언트 사이드

- [ ] API 키는 절대 클라이언트에 노출하지 않음
- [ ] 사용자 입력 검증 (XSS 방지)
- [ ] 민감한 데이터는 localStorage가 아닌 서버에 저장

### 서버 사이드

- [ ] 모든 API 라우트에서 인증 확인
- [ ] 역할 기반 접근 제어 (RBAC)
- [ ] SQL Injection 방지 (Supabase ORM 사용)
- [ ] Rate Limiting (향후)
- [ ] API 키 암호화 저장

### 환경 변수

```bash
# ✅ Good: 공개 가능한 URL
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co

# ❌ Bad: 비밀 키를 NEXT_PUBLIC_로 시작하면 안됨
NEXT_PUBLIC_BINANCE_API_SECRET=xxx  # 위험!

# ✅ Good: 서버 전용 환경 변수
BINANCE_API_SECRET=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx
```

---

## 📊 모니터링 UI 개발 가이드

### 모니터링 대시보드 구조

모니터링 대시보드는 실시간으로 전략 실행 상태와 거래 성과를 추적합니다.

#### 주요 컴포넌트

**1. ActiveStrategyPanel** - 활성 전략 현황
- 실행 중인 전략 정보 표시
- 평가 횟수, 다음 평가까지 카운트다운
- 성공률, 평균 평가 시간
- 레버리지, 타임프레임, 포지션 모드
- 모니터링 종목 목록 (최대 20개 표시)
- 10초마다 자동 새로고침

```typescript
// 사용 예시
import { ActiveStrategyPanel } from '@/components/trading/monitoring/ActiveStrategyPanel';

export default function MonitoringPage() {
  return <ActiveStrategyPanel />;
}
```

**2. OpenPositionsPanel** - 실시간 포지션 현황
- 현재 보유 중인 포지션 목록
- 진입가, 현재가, 손익률 표시
- 레버리지 및 마진 정보
- 미실현 손익 (Unrealized PnL)
- 3초마다 자동 새로고침

**3. PnLChartPanel** - 손익 추이 차트
- lightweight-charts 기반 시계열 차트
- 기간 선택 (1h, 24h, 7d, 30d)
- 누적 손익 (Cumulative PnL) 시각화
- 승률, 평균 수익/손실, Profit Factor
- 10초마다 자동 업데이트

```typescript
// API 엔드포인트
GET /api/monitoring/pnl-history?period=24h

// 응답 형식
{
  timeline: Array<{
    time: string;           // ISO 8601 타임스탬프
    realizedPnl: number;    // 실현 손익
    cumulativePnl: number;  // 누적 손익
  }>,
  stats: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRate: number;        // 승률 (%)
    avgWin: number;         // 평균 수익
    avgLoss: number;        // 평균 손실
    profitFactor: number;   // Profit Factor
    totalPnl: number;       // 총 손익
  }
}
```

**4. StrategyPerformancePanel** - 전략별 성과 분석
- 각 전략의 상세 성과 지표
- Sharpe Ratio (연환산)
- Max Drawdown
- Risk/Reward 비율
- 기대값 (Expected Value)
- 30초마다 자동 업데이트

```typescript
// Sharpe Ratio 계산 (간소화 버전)
const calculateSharpeRatio = (timeline: PnLData[]): number => {
  const returns = [];
  for (let i = 1; i < timeline.length; i++) {
    const prevPnl = timeline[i - 1].cumulativePnl;
    const currPnl = timeline[i].cumulativePnl;
    if (prevPnl !== 0) {
      returns.push((currPnl - prevPnl) / Math.abs(prevPnl));
    }
  }

  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const stdDev = Math.sqrt(
    returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  );

  return stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0; // 연환산
};

// Max Drawdown 계산
const calculateMaxDrawdown = (timeline: PnLData[]): number => {
  let maxPnl = timeline[0].cumulativePnl;
  let maxDrawdown = 0;

  for (const point of timeline) {
    const pnl = point.cumulativePnl;
    if (pnl > maxPnl) {
      maxPnl = pnl;
    } else {
      const drawdown = ((maxPnl - pnl) / (Math.abs(maxPnl) || 1)) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  return maxDrawdown;
};
```

**5. ActivityLogPanel** - 실시간 활동 로그
- 시스템 이벤트 로그 스트림
- 타임스탬프 및 로그 레벨 (info, warning, error)
- 실시간 업데이트 (5초 간격)
- 자동 스크롤 및 필터링

### 데이터 검증 패턴

모니터링 UI에서는 API 응답 검증이 중요합니다.

```typescript
// ✅ Good: response.ok를 먼저 체크
const fetchData = async () => {
  const response = await fetch('/api/monitoring/pnl-history?period=24h');

  if (!response.ok) {
    // 인증 오류는 조용히 처리
    if (response.status === 401) {
      setIsLoading(false);
      return;
    }
    throw new Error('Failed to fetch data');
  }

  const data = await response.json(); // 안전하게 파싱
  setData(data);
};

// ❌ Bad: response.json()을 먼저 호출
const fetchData = async () => {
  const response = await fetch('/api/monitoring/pnl-history?period=24h');
  const data = await response.json(); // 에러 페이지 HTML을 JSON으로 파싱 시도!

  if (!response.ok) {
    throw new Error('Failed to fetch data');
  }

  setData(data);
};
```

### 실시간 업데이트 주기

각 패널의 업데이트 주기는 데이터 중요도에 따라 다릅니다:

- **포지션 현황**: 3초 (가장 빈번)
- **활동 로그**: 5초
- **손익 차트**: 10초
- **전략 성과**: 30초 (계산 비용이 높음)

```typescript
// 업데이트 패턴
useEffect(() => {
  fetchData();
  const interval = setInterval(fetchData, 10000); // 10초
  return () => clearInterval(interval);
}, [fetchData]);
```

---

## 📚 추가 리소스

### 공식 문서
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Supabase Documentation](https://supabase.com/docs)
- [CCXT Documentation](https://docs.ccxt.com/)
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)

### 프로젝트 문서
- [로드맵](./ROADMAP.md) - 프로젝트 전체 계획 및 진행 상황
- [CLAUDE.md](../CLAUDE.md) - Claude Code를 위한 가이드
- [indicatorctl.md](./indicatorctl.md) - 지표 패널 상세 사양 (레거시)

---

*이 문서는 프로젝트 발전에 따라 지속적으로 업데이트됩니다.*
