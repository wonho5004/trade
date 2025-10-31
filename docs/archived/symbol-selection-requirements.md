# 종목 선택 UI 요구사항 분석

## 📋 출처
edithistory.md → "종목 선택/제외 & 레버리지" 섹션

---

## 🎯 핵심 요구사항

### 1. 종목 검색창
```
┌─────────────────────────────────────┐
│ 🔍 종목 검색                         │
│ ┌─────────────────────────────────┐ │
│ │ [USDT] [USDC]    [검색어...]    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 정렬: [알파벳순 ▼]                  │
│       - 알파벳순                    │
│       - 거래량순 (vol)              │
│       - 시가총액 (cap)              │
│       - 상승률순 (일)               │
│       - 하락률순 (일)               │
└─────────────────────────────────────┘
```

**기능:**
- USDT/USDC 쿼터 선택 (탭 or 버튼)
- 바이낸스 API 호출 → 종목 리스트업
- 5가지 정렬 기준
- 리스트에서 추가/삭제 버튼

### 2. 선택 종목 테이블
```
┌──────────────────────────────────────────────────────────────┐
│ 📊 선택 종목 (5개)                                           │
├────┬──────┬────────┬────────┬──────┬──────┬──────┬──────────┤
│ No │ 심볼 │레버리지│ 포지션 │추가매수│ 매도 │ 손절 │   액션   │
├────┼──────┼────────┼────────┼──────┼──────┼──────┼──────────┤
│ 1  │BTCUSDT│ [20x]│ [양방향]│ [O]  │ [O]  │ [O]  │ [삭제]   │
│ 2  │ETHUSDT│ [15x]│  [롱]  │ [O]  │ [O]  │ [X]  │ [삭제]   │
│ 3  │BNBUSDT│[기본] │ [양방향]│ [O]  │ [O]  │ [O]  │ [삭제]   │
└────┴──────┴────────┴────────┴──────┴──────┴──────┴──────────┘

💡 표에서 설정한 값이 '기본 설정' 값보다 우선 적용됩니다.
```

**컬럼:**
1. **No**: 순번
2. **심볼**: 종목명 (BTCUSDT 등)
3. **레버리지**: 입력 or "기본값" 선택
4. **포지션**: 롱/숏/양방향
5. **추가매수**: 선택(O) / 제외(X)
6. **매도**: 선택(O) / 제외(X)
7. **손절**: 선택(O) / 제외(X)
8. **액션**: 삭제 버튼

**인라인 편집:**
- 레버리지: 클릭 → 입력 or 드롭다운
- 포지션: 드롭다운 (long/short/both)
- 체크박스: 추가매수/매도/손절 선택/제외

### 3. 제외 종목 테이블
```
┌──────────────────────────────────────┐
│ 🚫 제외 종목 (2개)                   │
├────┬──────────────────────────────┬──┤
│ No │ 심볼                    │ 액션 │
├────┼──────────────────────────┼──┤
│ 1  │ USDCUSDT (스테이블코인)  │[삭제]│
│ 2  │ BUSDUSDT (스테이블코인)  │[삭제]│
└────┴──────────────────────────┴──┘

💡 기본 제외 항목: 스테이블코인 자동 표시
```

### 4. 종목 제외 규칙
```
┌─────────────────────────────────────┐
│ ⚙️ 종목 제외 규칙                   │
│                                     │
│ □ 상장일 [7]일 이하 제외            │
│ □ 상장일 정보 없음 제외             │
│                                     │
│ 거래량 (vol):                       │
│   □ 상위 [10]위 이상 제외           │
│   □ 하위 [10]위 이하 제외           │
│                                     │
│ 시가총액 (cap):                     │
│   □ 상위 [5]위 이상 제외            │
│   □ 하위 [5]위 이하 제외            │
│                                     │
│ 일일 상승률:                        │
│   □ 상위 [10]% 이상 제외            │
│   □ 하위 [-10]% 이하 제외           │
│                                     │
│ 일일 하락률:                        │
│   □ 상위 [10]% 이상 제외            │
│   □ 하위 [-10]% 이하 제외           │
└─────────────────────────────────────┘
```

---

## 🔄 동작 흐름

### 종목 추가
```
1. 사용자: USDT 탭 클릭
2. 시스템: 바이낸스 API 호출 (USDT 종목 목록)
3. 사용자: "거래량순" 선택
4. 시스템: 목록 정렬
5. 사용자: BTCUSDT 클릭 → "추가" 버튼
6. 시스템: "선택 종목" 테이블에 추가
7. 시스템: 제외 규칙 적용 → 통과하면 추가
```

### 종목 제외
```
1. 사용자: "선택 종목" 테이블에서 "삭제" 클릭
2. 시스템: "제외 종목" 테이블로 이동
3. 또는
1. 사용자: 검색창에서 종목 클릭 → "제외" 버튼
2. 시스템: "제외 종목" 테이블에 추가
```

### 수동 + 랭킹 조합
```
기본설정: 거래 10종목
수동 선택: 5종목 (BTC, ETH, BNB, SOL, ADA)
랭킹 추가: 거래량 상위 20위

실제 거래:
1. 수동 5종목 우선
2. 나머지 5종목 = 거래량 상위 20위 중 순서대로
   (단, 수동 5종목과 중복 제외)
```

### 종목 수 미달
```
기본설정: 거래 10종목
현재 선택: 3종목

→ ❌ 오류 안내:
"최소 10개 종목이 필요합니다. 현재 3개 선택됨."
```

---

## 📊 데이터 구조

### SymbolConfig
```typescript
type SymbolConfig = {
  symbol: string; // "BTCUSDT"
  quote: 'USDT' | 'USDC';

  // Override 설정 (기본값 우선순위 낮음)
  leverage?: number; // undefined = 기본값 사용
  positionMode?: 'long' | 'short' | 'both'; // undefined = 기본값
  enableScaleIn?: boolean; // undefined = 기본값
  enableExit?: boolean; // undefined = 기본값
  enableStopLoss?: boolean; // undefined = 기본값
};

type SymbolSelection = {
  // 수동 선택 종목
  manualSymbols: SymbolConfig[];

  // 제외 종목
  excludedSymbols: string[];
  excludedReasons: Record<string, string>; // "USDCUSDT": "스테이블코인"

  // 랭킹 기준 (추가 선택)
  ranking?: {
    enabled: boolean;
    criteria: 'volume' | 'marketcap' | 'gainers' | 'losers';
    top: number; // 상위 N개
  };

  // 제외 규칙
  exclusionRules: {
    minListingDays?: number;
    excludeUnknownListing: boolean;

    volume?: {
      excludeTop?: number; // 상위 N개 제외
      excludeBottom?: number; // 하위 N개 제외
    };

    marketCap?: {
      excludeTop?: number;
      excludeBottom?: number;
    };

    dailyGain?: {
      excludeAbove?: number; // % 이상 제외
      excludeBelow?: number; // % 이하 제외
    };

    dailyLoss?: {
      excludeAbove?: number;
      excludeBelow?: number;
    };
  };
};
```

### MarketData (API 응답)
```typescript
type MarketData = {
  symbol: string;
  quote: 'USDT' | 'USDC';
  price: number;
  volume24h: number;
  marketCap?: number;
  dailyChange: number; // %
  listingDate?: string; // ISO 8601

  // 거래소 제한
  minNotional: number;
  pricePrecision: number;
  quantityPrecision: number;
  maxLeverage: number;
};
```

---

## 🎨 컴포넌트 구조

```
SymbolSelectionPanel
├─ SymbolSearchPanel
│  ├─ QuoteTabs (USDT/USDC)
│  ├─ SearchInput
│  ├─ SortSelector (5가지)
│  └─ SymbolList
│     └─ SymbolListItem
│        ├─ 심볼 정보
│        ├─ [추가] 버튼
│        └─ [제외] 버튼
│
├─ SelectedSymbolsTable
│  ├─ TableHeader
│  └─ TableRow[]
│     ├─ No, Symbol
│     ├─ LeverageInput (inline edit)
│     ├─ PositionModeSelect
│     ├─ EnableToggles (추가매수/매도/손절)
│     └─ DeleteButton
│
├─ ExcludedSymbolsTable
│  └─ TableRow[]
│     ├─ No, Symbol (+ 이유)
│     └─ DeleteButton
│
└─ ExclusionRulesPanel
   ├─ ListingDaysFilter
   ├─ VolumeFilter
   ├─ MarketCapFilter
   ├─ DailyGainFilter
   └─ DailyLossFilter
```

---

## 🔌 API 연동

### 필요한 API
```typescript
// 1. 종목 목록 가져오기
GET /api/binance/futures/symbols?quote=USDT
Response: MarketData[]

// 2. 종목 상세 정보
GET /api/binance/futures/symbol/:symbol
Response: MarketData

// 3. 정렬된 종목 목록
GET /api/binance/futures/symbols?quote=USDT&sort=volume&order=desc
Response: MarketData[]
```

### 기존 API 확인
- `/api/trading/binance/futures-symbols/route.ts` 존재
- 활용 가능 여부 확인 필요

---

## ✅ 검증 규칙

### 1. 종목 수 검증
```typescript
const minSymbols = settings.symbolCount; // 기본설정
const selected = symbolSelection.manualSymbols.length;
const fromRanking = symbolSelection.ranking?.top || 0;

const total = selected + fromRanking;

if (total < minSymbols) {
  error(`최소 ${minSymbols}개 종목이 필요합니다. 현재 ${total}개 선택됨.`);
}
```

### 2. 중복 검증
```typescript
const duplicates = findDuplicates(symbolSelection.manualSymbols);
if (duplicates.length > 0) {
  error(`중복 종목: ${duplicates.join(', ')}`);
}
```

### 3. 레버리지 검증
```typescript
for (const config of symbolSelection.manualSymbols) {
  const market = await fetchMarketData(config.symbol);

  if (config.leverage && config.leverage > market.maxLeverage) {
    error(`${config.symbol}: 최대 레버리지 ${market.maxLeverage}배를 초과할 수 없습니다.`);
  }
}
```

---

## 📋 우선순위

### Phase 4.1 (현재)
- [x] 요구사항 분석 및 문서화
- [ ] 데이터 구조 타입 정의

### Phase 4.2 (다음)
- [ ] SymbolSearchPanel 컴포넌트
- [ ] 바이낸스 API 연동 확인

### Phase 4.3
- [ ] SelectedSymbolsTable 컴포넌트
- [ ] 인라인 편집 기능

### Phase 4.4
- [ ] ExcludedSymbolsTable 컴포넌트
- [ ] ExclusionRulesPanel 컴포넌트

### Phase 4.5
- [ ] 전체 통합 및 검증
- [ ] 테스트 작성

---

## 💡 기술적 고려사항

### 성능
- 종목 목록: 1000+ 개 → 가상화 스크롤 필요
- 정렬: 클라이언트 vs 서버 사이드
- 캐싱: React Query or SWR

### 상태 관리
- 현재: autoTradingSettingsStore (Zustand)
- 검색창 상태: 로컬 state
- API 데이터: React Query

### UI 라이브러리
- 테이블: shadcn/ui Table
- 인라인 편집: shadcn/ui Popover + Input
- 가상 스크롤: react-window or @tanstack/virtual

---

생성일: 2025-10-25
