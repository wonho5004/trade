# 바이낸스 트레이딩 플랫폼 - 개발 우선순위 및 실행 계획

## 📋 문서 개요
이 문서는 프로젝트의 체계적인 개발을 위한 우선순위별 실행 계획입니다.
**사용자 친화성**, **혼동 방지**, **초보자 접근성**을 최우선 목표로 합니다.

---

## 🎯 개발 철학
1. **사용자 중심**: 초보자도 쉽게 이해할 수 있는 UI/UX
2. **명확성**: 혼동을 줄 수 있는 용어/UI 제거
3. **안전성**: 실수를 방지하는 검증 시스템
4. **단계적 진행**: 각 단계 검증 후 다음 단계 진행
5. **문서화**: 모든 기능에 대한 상세 도움말 제공

---

## ⚙️ Phase 0: 필수 환경 설정 (현재)

### 0.1 개발 환경 점검
- [ ] Node.js 버전 확인 (20+ LTS)
- [ ] 패키지 의존성 확인 (`npm install`)
- [ ] TypeScript 컴파일 확인 (`npm run typecheck`)
- [ ] 테스트 실행 (`npm test`)
- [ ] 개발 서버 실행 (`npm run dev`)

### 0.2 MCP 서버 설정
- [ ] MCP 서버 필요 여부 확인
- [ ] 필요 시 설정 파일 생성
- [ ] 연결 테스트

### 0.3 환경 변수 확인
```bash
필수 환경 변수:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (선택)
- BINANCE_FUTURES_API_KEY (서버용, 테스트 시)
- BINANCE_FUTURES_API_SECRET (서버용, 테스트 시)
```

### 0.4 Git 상태 확인
- [ ] 현재 브랜치 확인
- [ ] Uncommitted changes 확인
- [ ] 작업 브랜치 생성 (`feature/priority-improvements`)

**완료 기준**: 개발 서버가 정상 실행되고, 테스트가 통과하며, Git 준비 완료

---

## 🚀 Phase 1: UI/UX 개선 (긴급 - 1-2주)

### 목표
edithistory.md에 명시된 사용자 혼동 요소를 제거하고, 직관적인 UI로 개선

### 1.1 조건 그룹 UI 개편 (최우선)

#### 문제점
- "조건 추가" 버튼이 무엇을 추가하는지 불명확
- 단일 지표 편집 시 전체 그룹이 열려 혼란
- 그룹 구분이 시각적으로 명확하지 않음
- AND/OR 관계가 직관적이지 않음

#### 해결 방안
```typescript
1. 버튼 명명 변경
   "조건 추가" → "조건 그룹 추가"

2. 그룹 카드 UI 도입
   ┌─────────────────────────────────┐
   │ 조건 그룹 1          [편집] [삭제] │
   │ ┌─────────────────────────────┐ │
   │ │ 📊 RSI > 70          [편집]  │ │
   │ │ 📈 MA(20) 상단돌파    [편집]  │ │
   │ └─────────────────────────────┘ │
   │ 그룹 내: AND 조건               │
   └─────────────────────────────────┘

3. 지표 단일 편집 모달 생성
   - 파일: IndicatorEditModal.tsx (신규)
   - 기능: 해당 지표만 편집
   - UI: 지표 파라미터 + 비교 기준만 표시

4. 명시적 관계 표시
   - 그룹 내부: "AND" 배지 (노란색)
   - 그룹 간: "OR" 구분선 (파란색)
```

#### 구현 파일
- `src/components/trading/automation/ConditionGroupCard.tsx` (신규)
- `src/components/trading/automation/IndicatorEditModal.tsx` (신규)
- `src/components/trading/automation/ConditionsEditorModal.tsx` (수정)
- `src/components/trading/automation/GroupListPanel.tsx` (수정)

#### 도움말 추가
```markdown
💡 조건 그룹이란?
- 하나의 그룹 안에 여러 지표 조건을 추가할 수 있습니다
- 같은 그룹 내 조건들은 모두 만족해야 합니다 (AND)
- 다른 그룹 중 하나만 만족하면 됩니다 (OR)

예시:
그룹 1: RSI > 70 AND MA(20) 상단돌파
또는
그룹 2: 볼린저밴드 상단돌파 AND 거래량 급증

→ 그룹 1 또는 그룹 2 중 하나가 만족되면 매수 신호
```

### 1.2 비교 연산자 단순화

#### 문제점
- MA "상단 돌파", "하단 유지" 등 액션 방식이 복잡
- RSI/MACD는 지정값 기준이라 일관성 없음

#### 해결 방안
```typescript
// 기존 (복잡)
MA 액션: "상단 돌파" | "하단 돌파" | "상단 유지" | "하단 유지"

// 변경 (단순)
비교 연산자: ">" | "<" | "=" | ">=" | "<=" | "선택안함"
비교 기준: 캔들(종가/고가/저가/시가) | 지표 | 고정값

예시:
- 종가 > MA(20)
- RSI > 70
- 볼린저밴드 상단 < 종가
```

#### 구현 파일
- `src/types/trading/auto-trading.ts` (타입 수정)
- `src/components/trading/indicators/IndicatorParamEditor.tsx` (UI 수정)
- `src/lib/trading/engine/conditions.ts` (평가 로직 수정)

#### 도움말 추가
```markdown
💡 비교 연산자 사용법
- ">": ~보다 크면 (돌파)
- "<": ~보다 작으면 (하락)
- ">=": ~보다 크거나 같으면 (유지)
- "<=": ~보다 작거나 같으면 (유지)
- "=": 같으면 (교차)
- "선택안함": 지표 값만 참조 (비교하지 않음)

초보자 추천:
- 매수: 종가 > MA(20) → 이동평균선 위에서 거래
- 과매수 회피: RSI < 70 → 과열 구간 피하기
```

### 1.3 종목 선택 UI 전면 개편

#### 현재 문제
- USDT/USDC 구분 없음
- 정렬 기준 제한적
- 선택된 종목의 상세 설정(레버리지/포지션) 수정 불편
- 제외 규칙이 단순함

#### 해결 방안
```typescript
1. 검색창 개선
   ┌─────────────────────────────────────┐
   │ 🔍 종목 검색                          │
   │ [USDT] [USDC]  정렬: [거래금액 ▼]   │
   │                                     │
   │ 검색 결과:                           │
   │ ☑ BTCUSDT   $45,123  +2.5% ↑       │
   │ ☐ ETHUSDT   $12,456  -1.2% ↓       │
   │ ☑ SOLUSDT   $3,789   +5.3% ↑       │
   └─────────────────────────────────────┘

2. 선택 종목 표 (상세 설정 가능)
   ┌──────────────────────────────────────────────────────────┐
   │ 선택 종목 (5개)                                           │
   ├────┬────────┬──────┬────────┬────────┬────────┬────────┤
   │ No │ 심볼   │레버리지│포지션  │추가매수│ 매도   │ 손절   │
   ├────┼────────┼──────┼────────┼────────┼────────┼────────┤
   │ 1  │BTCUSDT │ [20x]│[양방향]│  ✓     │  ✓     │  ✓     │
   │ 2  │ETHUSDT │[기본]│ [롱만] │  ✓     │  ✓     │  ✓     │
   └────┴────────┴──────┴────────┴────────┴────────┴────────┘

   클릭 시 드롭다운으로 즉시 변경 가능

3. 제외 규칙 확장
   ☑ 상장일 30일 이하 제외
   ☑ 상장일 정보 없음 제외
   ☐ 거래금액 하위 50% 제외
   ☐ 시가총액 하위 100위 제외
   ☐ 일일 변동률 상위 10% 제외 (과도한 변동성)
   ☐ 일일 변동률 하위 10% 제외 (거래 부진)
```

#### 구현 파일
- `src/components/trading/automation/SymbolsPickerPanel.tsx` (대규모 수정)
- `src/components/trading/automation/SymbolSearchModal.tsx` (신규)
- `src/components/trading/automation/SelectedSymbolsTable.tsx` (신규)
- `src/components/trading/automation/ExclusionRulesPanel.tsx` (신규)

#### 도움말 추가
```markdown
💡 종목 선택 가이드

1. 수동 선택
   - 거래하고 싶은 종목을 직접 검색하여 선택
   - 종목별로 레버리지, 포지션 타입 개별 설정 가능

2. 자동 선택 (랭킹 기반)
   - 거래금액 상위 10위: 유동성이 높은 종목
   - 시가총액 상위 20위: 안정적인 대형 코인
   - 상승률 상위 10위: 모멘텀 트레이딩

3. 제외 규칙
   - 신규 상장 코인 제외: 변동성이 매우 큼
   - 거래량 부족 종목 제외: 체결이 어려울 수 있음

초보자 추천 설정:
- 거래금액 상위 10위 선택
- 상장일 30일 이하 제외
- 레버리지 5-10배 (안전)
```

### 1.4 매수금액 설정 완성

#### 현재 상태
- 90% 구현 완료
- 잔고 연동 필요
- 예상 주문금액 계산 필요

#### 구현 내용
```typescript
1. 잔고 조회 기능
   ┌─────────────────────────────────┐
   │ 💰 예상 투자금액: $1,000        │
   │ [실제 잔고 조회]                 │
   │                                 │
   │ 실제 잔고: $5,432.15            │
   │ - Wallet Balance: $5,432.15    │
   │ - Available: $4,123.45         │
   │ - In Use: $1,308.70            │
   └─────────────────────────────────┘

2. 매수 금액 설정 옵션
   ○ USDT 고정 금액: [100] USDT
   ○ 종목별 잔고 비율: [10]% (예상: $54.32 per symbol)
   ○ 전체 잔고 비율: [5]% (예상: $271.61 total)
   ○ 최소 주문 단위: 거래소 최소값 사용

   ☑ 최소 주문 미달 시 최소값으로 주문
   ☐ 최소 주문 미달 시 주문 생략

3. 실시간 계산 표시
   예상 주문 금액: $100.00
   레버리지 10배 적용: $1,000.00 포지션
   필요 마진: $100.00
```

#### 구현 파일
- `src/components/trading/automation/CapitalSettingsPanel.tsx` (완성)
- `src/app/api/trading/binance/account/route.ts` (잔고 API 보강)
- `src/lib/trading/margin.ts` (계산 로직 최종 검증)

#### 도움말 추가
```markdown
💡 매수 금액 설정 가이드

1. USDT 고정 금액 (초보자 추천)
   - 장점: 명확한 리스크 관리
   - 예시: 종목당 $100씩 10개 = 총 $1,000 투자
   - 추천: 전체 잔고의 1-5%

2. 잔고 비율
   - 종목별 비율: 각 종목에 동일 비율 배분
   - 전체 비율: 전체 잔고의 일정 비율만 사용
   - 주의: 여러 종목 동시 진입 시 자금 부족 가능

3. 최소 주문 단위
   - 거래소가 정한 최소 주문 금액
   - 소액 설정 시 자동으로 최소값 사용 권장

위험 경고:
⚠️ 레버리지 10배 = 1% 가격 변동 = 10% 손익
⚠️ 높은 레버리지는 청산 위험 증가
초보자는 5-10배 이하 권장
```

### 1.5 현재 상태 조건 추가 (StatusLeafNode)

#### 필요성
- 추가매수 조건: "현재 손실 -5% 이상일 때만"
- 손절 조건: "매수 후 24시간 경과 시"
- 헤지 조건: "현재 마진이 초기 투자의 200% 초과 시"

#### 구현 내용
```typescript
// src/types/trading/auto-trading.ts 확장

export type StatusMetric =
  | 'profitRate'        // 현재 수익률 (%)
  | 'marginAmount'      // 현재 마진 금액 (USDT)
  | 'buyCount'          // 매수 횟수
  | 'entryAge'          // 포지션 진입 후 경과 시간 (시간)
  | 'walletBalance'     // 잔고 (USDT)
  | 'initialMarginRate' // 초기 마진 대비 현재 마진 비율 (%)

export interface StatusCondition {
  metric: StatusMetric;
  operator: ComparisonOperator; // '>' | '<' | '>=' | '<=' | '='
  value: number;
  unit?: 'percent' | 'usdt' | 'count' | 'hours' | 'days';
}

// UI에서 선택
1. 현재 수익률: [>=] [-5] %
2. 현재 마진 금액: [>] [1000] USDT
3. 매수 횟수: [<] [5] 회
4. 포지션 경과 시간: [>] [24] 시간
5. 잔고 잔액: [>] [1000] USDT
```

#### 구현 파일
- `src/types/trading/auto-trading.ts` (타입 확장)
- `src/components/trading/automation/StatusConditionEditor.tsx` (신규)
- `src/lib/trading/engine/conditions.ts` (평가 로직 추가)

#### 도움말 추가
```markdown
💡 현재 상태 조건이란?

거래 중인 포지션의 실시간 상태를 기준으로 조건을 설정합니다.

활용 예시:

1. 추가매수 (물타기)
   조건: 현재 수익률 < -3% AND 매수 횟수 < 3회
   → 손실 시 최대 3번까지만 추가 매수

2. 손절 (손해 제한)
   조건: 현재 수익률 < -10% OR 포지션 경과 > 48시간
   → 10% 손실 또는 2일 경과 시 강제 청산

3. 헤지 (양방향 진입)
   조건: 현재 마진 금액 > 초기 투자 * 150%
   → 마진이 커지면 반대 포지션으로 위험 헤지

초보자 주의:
⚠️ 무분별한 추가매수는 손실 확대 위험
⚠️ 명확한 손절 기준 설정 필수
```

---

## 📚 Phase 2: 도움말 시스템 구축 (1주)

### 목표
모든 기능에 초보자도 이해할 수 있는 상세 도움말 제공

### 2.1 인라인 도움말 시스템

#### 구조
```typescript
// src/components/common/HelpTooltip.tsx (신규)
<HelpTooltip id="leverage-setting">
  <InfoIcon />
</HelpTooltip>

// 호버 시 표시
┌─────────────────────────────────┐
│ 💡 레버리지란?                   │
│                                 │
│ 적은 자금으로 큰 포지션을 거래   │
│ 할 수 있는 배율입니다.          │
│                                 │
│ 예시:                           │
│ - 10배 레버리지로 $100 투자     │
│ → $1,000 포지션 거래            │
│                                 │
│ ⚠️ 위험: 손실도 10배 확대        │
│                                 │
│ [자세히 보기 →]                  │
└─────────────────────────────────┘
```

#### 도움말 컨텐츠 파일
```typescript
// src/content/help-content.ts
export const helpContent = {
  'leverage-setting': {
    title: '레버리지란?',
    summary: '적은 자금으로 큰 포지션을 거래할 수 있는 배율',
    content: `
      ### 레버리지 개념
      - 10배 레버리지 = 10배 큰 포지션
      - 수익도 10배, 손실도 10배

      ### 초보자 가이드
      - 5배 이하 권장
      - 높은 레버리지는 청산 위험

      ### 계산 예시
      ...
    `,
    examples: [...],
    warnings: [...],
    relatedTopics: ['margin', 'liquidation']
  },
  // ... 모든 주요 기능에 대한 도움말
}
```

### 2.2 단계별 가이드 (Wizard)

```typescript
// 신규 사용자를 위한 설정 마법사
<SetupWizard>
  <Step 1: 기본 정보>
    - 투자 경험: 초보 / 중급 / 고급
    - 선호 리스크: 안전 / 중립 / 공격적

  <Step 2: 추천 설정 적용>
    - 경험에 맞는 기본 설정 자동 적용
    - 레버리지: 초보 5배, 중급 10배, 고급 20배

  <Step 3: 종목 선택>
    - 안전: BTC, ETH 등 주요 코인
    - 중립: 거래량 상위 10위
    - 공격적: 상승률 상위 종목

  <Step 4: 완료>
    - 설정 요약
    - 백테스트 권장
</SetupWizard>
```

### 2.3 도움말 센터 페이지

```typescript
// src/app/help/page.tsx (신규)

/help
├── 시작하기
│   ├── 계정 설정
│   ├── API 키 등록
│   └── 첫 전략 만들기
├── 기본 개념
│   ├── 레버리지
│   ├── 마진
│   ├── 롱/숏
│   └── 펀딩비
├── 전략 설정
│   ├── 진입 조건
│   ├── 추가매수
│   ├── 손절/익절
│   └── 헤지 모드
├── 지표 가이드
│   ├── 이동평균선 (MA)
│   ├── RSI
│   ├─�� 볼린저밴드
│   └── MACD
└── FAQ
    ├── 자주 묻는 질문
    ├── 오류 해결
    └── 용어 사전
```

---

## 🔧 Phase 3: 백엔드 기반 구축 (2-3주)

### 3.1 전략 저장 시스템

#### Supabase 테이블 설계
```sql
-- 전략 테이블
CREATE TABLE strategies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  settings JSONB NOT NULL, -- AutoTradingSettings 전체
  status VARCHAR(50) DEFAULT 'draft', -- draft/active/paused/stopped
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_run_at TIMESTAMP,

  -- 메타데이터
  version INTEGER DEFAULT 1,
  is_template BOOLEAN DEFAULT false,
  tags TEXT[],

  UNIQUE(user_id, name)
);

-- 전략 실행 로그
CREATE TABLE strategy_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id UUID REFERENCES strategies NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  execution_type VARCHAR(50), -- entry/scale_in/exit/stop_loss/hedge

  -- 조건 평가 결과
  conditions_met JSONB,

  -- 주문 정보
  orders JSONB, -- PlannedOrder[]

  -- 실행 결과
  status VARCHAR(50), -- success/failed/partial
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- 포지션 추적
CREATE TABLE positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  strategy_id UUID REFERENCES strategies NOT NULL,
  symbol VARCHAR(50) NOT NULL,
  side VARCHAR(10), -- LONG/SHORT

  -- 진입 정보
  entry_price DECIMAL(20, 8),
  entry_time TIMESTAMP,
  initial_margin DECIMAL(20, 8),
  leverage INTEGER,

  -- 현재 상태
  current_quantity DECIMAL(20, 8),
  current_margin DECIMAL(20, 8),
  unrealized_pnl DECIMAL(20, 8),
  pnl_percent DECIMAL(10, 4),

  -- 추가매수 이력
  scale_in_count INTEGER DEFAULT 0,
  scale_in_history JSONB,

  -- 청산 정보
  exit_price DECIMAL(20, 8),
  exit_time TIMESTAMP,
  realized_pnl DECIMAL(20, 8),

  status VARCHAR(50), -- open/closed

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### 3.2 실행 워커 (Supabase Edge Functions)

```typescript
// supabase/functions/strategy-executor/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // 1. 활성 전략 조회
  const { data: strategies } = await supabase
    .from('strategies')
    .select('*')
    .eq('status', 'active')

  // 2. 각 전략 병렬 실행
  const results = await Promise.allSettled(
    strategies.map(strategy => executeStrategy(strategy))
  )

  return new Response(JSON.stringify({ results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

async function executeStrategy(strategy) {
  // 1. 심볼 목록 가져오기
  const symbols = resolveSymbols(strategy.settings.symbolSelection)

  // 2. 각 심볼 평가
  for (const symbol of symbols) {
    // 최신 시세 가져오기
    const klines = await fetchKlines(symbol, strategy.settings.timeframe)

    // 지표 계산
    const indicators = calculateIndicators(klines, strategy.settings)

    // 조건 평가
    const entrySignal = evaluateConditions(
      strategy.settings.entry,
      indicators,
      klines
    )

    if (entrySignal.met) {
      // 주문 생성
      const orders = planOrders(strategy, symbol, entrySignal)

      // 실행 (안전장치 포함)
      await executeOrders(orders, { dryRun: false })

      // 로그 저장
      await logExecution(strategy.id, symbol, entrySignal, orders)
    }
  }
}
```

### 3.3 실시간 모니터링 대시보드

```typescript
// src/app/dashboard/monitoring/page.tsx (신규)

<MonitoringDashboard>
  <StrategySummary>
    - 활성 전략: 3개
    - 운영 종목: 15개
    - 총 포지션: 8개
    - 오늘 수익률: +2.3%
  </StrategySummary>

  <ActivePositions>
    실시간 포지션 목록
    - 심볼, 진입가, 현재가, 손익률
    - 진입 시간, 레버리지
    - 다음 액션 (추가매수/손절 조건)
  </ActivePositions>

  <RecentExecutions>
    최근 실행 로그
    - 타임스탬프
    - 전략명, 심볼
    - 액션 (진입/청산/손절)
    - 결과 (성공/실패)
  </RecentExecutions>

  <PerformanceChart>
    자본 증감 그래프
    - 실시간 업데이트
    - 일간/주간/월간 뷰
  </PerformanceChart>
</MonitoringDashboard>
```

---

## 📊 Phase 4: 백테스팅 시스템 (2주)

### 4.1 Python 백테스트 엔진

```python
# python/backtesting/engine.py

from typing import Dict, List
import pandas as pd
import numpy as np

class BacktestEngine:
    """
    전략 백테스트 엔진
    """

    def __init__(self, strategy: Dict, data: pd.DataFrame):
        self.strategy = strategy
        self.data = data  # OHLCV + indicators
        self.positions = []
        self.equity_curve = []

    def run(self) -> Dict:
        """백테스트 실행"""
        for i in range(len(self.data)):
            current_bar = self.data.iloc[i]

            # 진입 조건 평가
            if self._check_entry_conditions(current_bar):
                self._open_position(current_bar)

            # 청산 조건 평가
            if self._check_exit_conditions(current_bar):
                self._close_position(current_bar)

            # 자본 기록
            self._record_equity(current_bar)

        return self._generate_report()

    def _generate_report(self) -> Dict:
        """성과 보고서 생성"""
        return {
            'total_return': ...,
            'sharpe_ratio': ...,
            'max_drawdown': ...,
            'win_rate': ...,
            'trades': len(self.positions),
            'equity_curve': self.equity_curve
        }
```

### 4.2 백테스트 UI

```typescript
// src/app/backtest/page.tsx (신규)

<BacktestPage>
  <BacktestConfig>
    - 전략 선택
    - 테스트 기간 (from ~ to)
    - 초기 자본
    - 수수료 설정
    - [백테스트 실행]
  </BacktestConfig>

  <BacktestResults>
    <SummaryMetrics>
      총 수익률: +45.2%
      샤프 비율: 1.85
      최대 낙폭: -12.3%
      승률: 62.5%
      총 거래: 127회
    </SummaryMetrics>

    <EquityCurve>
      자본 증감 그래프
    </EquityCurve>

    <TradeHistory>
      거래 내역 테이블
      - 날짜, 심볼, 액션, 가격, 손익
    </TradeHistory>

    <MonthlyReturns>
      월별 수익률 히트맵
    </MonthlyReturns>
  </BacktestResults>
</BacktestPage>
```

---

## ⚡ 즉시 실행 계획

### Week 1: 환경 설정 + UI 개선 시작

**Day 1-2: 환경 점검 및 준비**
- [ ] 개발 환경 완전 점검
- [ ] Git 브랜치 생성
- [ ] 현재 코드 분석 및 테스트

**Day 3-4: 조건 그룹 UI 개편**
- [ ] ConditionGroupCard 컴포넌트 생성
- [ ] IndicatorEditModal 컴포넌트 생성
- [ ] ConditionsEditorModal 수정
- [ ] 도움말 추가

**Day 5-7: 비교 연산자 단순화**
- [ ] 타입 정의 수정
- [ ] UI 컴포넌트 수정
- [ ] 평가 로직 수정
- [ ] 테스트 작성 및 검증

### Week 2: UI 완성 + 도움말

**Day 8-10: 종목 선택 UI 개편**
- [ ] 검색 모달 생성
- [ ] 선택 종목 테이블 생성
- [ ] 제외 규칙 패널 생성
- [ ] 통합 및 테스트

**Day 11-12: 매수금액 설정 완성**
- [ ] 잔고 조회 API 연동
- [ ] 계산 로직 완성
- [ ] UI 최종 검증

**Day 13-14: 도움말 시스템**
- [ ] HelpTooltip 컴포넌트
- [ ] 도움말 컨텐츠 작성
- [ ] 모든 주요 기능에 적용

---

## ✅ 검증 체크리스트

### 각 기능 완료 시 확인사항
- [ ] TypeScript 타입 에러 없음
- [ ] 단위 테스트 통과
- [ ] 개발 서버에서 정상 동작
- [ ] 반응형 디자인 확인 (모바일/태블릿/데스크톱)
- [ ] 접근성 확인 (키보드 네비게이션)
- [ ] 도움말 추가됨
- [ ] Git 커밋 (의미있는 메시지)

### Phase 완료 시 확인사항
- [ ] 전체 통합 테스트
- [ ] 사용자 시나리오 테스트 (실제 설정 만들어보기)
- [ ] 성능 확인 (로딩 시간, 렌더링 속도)
- [ ] 문서 업데이트
- [ ] Pull Request 생성 및 리뷰

---

## 📞 협업 프로토콜

### 확인이 필요한 경우
다음 상황에서는 진행 전 확인:
1. 기존 타입 정의의 대규모 변경
2. API 스펙 변경
3. 데이터베이스 스키마 변경
4. 사용자 경험에 큰 영향을 주는 UI 변경
5. 보안 관련 변경

### 진행 방식
1. 소규모 변경: 바로 구현 후 보고
2. 중규모 변경: 구현 계획 공유 → 승인 후 진행
3. 대규모 변경: 상세 설계서 작성 → 협의 → 단계별 진행

---

## 🎯 성공 지표

### Phase 1 완료 기준
- [ ] edithistory.md의 모든 요구사항 구현됨
- [ ] 초보자가 도움말만으로 설정 가능
- [ ] 사용자 혼동 요소 0건
- [ ] 모든 주요 기능에 도움말 존재

### 최종 목표
- 초보자도 30분 내에 첫 전략 생성 가능
- 전략 백테스트 결과 확인 가능
- 실제 자동매매 실행 및 모니터링 가능
- 안전장치로 인한 큰 손실 방지

---

*이 문서는 개발 진행에 따라 지속 업데이트됩니다.*
*최종 수정: 2025-10-25*
