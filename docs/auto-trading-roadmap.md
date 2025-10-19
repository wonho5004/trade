# 자동매매 설정 UI/로직 개선 개발 플랜

요구사항을 효율적으로 구현하기 위해 아래와 같이 단계별 로드맵을 수립합니다. 각 단계 완료 후 QA 및 코드 리뷰를 통해 검증하며 진행합니다.

## 진행 현황
- [ ] Phase 0 ― 사전 준비 (테스트 전략 문서화 잔여)
- [x] Phase 1 ― 데이터 모델 확장
- [ ] Phase 2 ― 마진 계산 로직 고도화 (ETH/USDT 실측 QA 대기)
- [x] Phase 3 ― UI 리팩터링 (조건 편집 모달/섹션 래퍼 도입)
- [x] Phase 4 ― 섹션별 저장 & 접기 UX (기본 설정/매수 섹션 적용)
- [x] Phase 5 ― 로직 생성 버튼 & 검증 (API Key 확인 포함)
- [ ] Phase 6 ― QA & 문서화

---

## Phase 0. 사전 준비
- [x] 현재 `AutoTradingSettingsForm` 구조 및 스토어(`autoTradingSettingsStore`) 의존성 분석  
  ↳ 폼 컴포넌트가 단일 스토어 상태(`settings`)에 직접 의존하며, `updateSettings` 호출 시 전역 구조를 복제/마이그레이션 하는 것을 확인. 롱/숏 분리를 위해 `entry/scaleIn/exit` 각 영역을 구조체 단위로 확장해야 함.
- [x] 기 저장 데이터와 호환성을 보장할 수 있는 마이그레이션 전략 정리  
  ↳ `persist` 옵션의 `merge` 훅을 이용해 신규 필드 기본값과 방향/지표 초기화를 수행. 롤아웃 시 버전 키 변경 또는 추가 마이그레이션 로직 필요 여부를 추후 결정.
- [x] 디자인 가이드(간격, 강조 색상, 접기/펼치기 패턴) 합의  
  ↳ 별도 브랜드 가이드는 없으며 다크 테마 기반의 전문가용(바이낸스 앱 스타일) UI를 지향. 여백은 최소화, 핵심 정보를 우선 배치하고 길어지는 작업에는 Spinner 등 진행 표시를 적용.
- [x] 테스트 전략(단위 테스트, 스냅샷, 수동 QA 시나리오) 수립  
  ↳ **커버리지**: 설정/매수/매도/헤지 등 모든 영역이 최소한 “선택 안 함” 상태를 갖도록 검증, 필수값 누락 시 경고 확인.  
  ↳ **단위 테스트**: 마진 계산(최소/최대), USDT 기준 금액 → 수량 변환, 방향 배열 정규화 함수 등을 `vitest` 또는 `jest` 기반으로 작성.  
  ↳ **스냅샷/스토리북**: 주요 섹션(기본 세팅, 매수/매도 롱/숏 탭, 헤지 조건)을 Storybook 컴포넌트로 분리해 상태별 UI 스냅샷 생성.  
  ↳ **수동 QA 시나리오(1차)**  
    1. **기본값**: 신규 사용자, 최소 필수 항목만 입력 후 저장/생성 → 경고/미설정 안내가 정상 출력되는지 확인  
    2. **롱·숏 분리**: 롱만 설정 → 숏 탭은 “설정 안 함” 표시 확인, 반대로 숏만 설정 케이스도 확인  
    3. **헤지 모드**: 포지션 모드를 ‘hedge’로 전환 → 헤지 조건 저장 & 접기, 다시 ‘one_way’ 전환 시 UI 숨김 확인  
    4. **계산 검증**: ETH/USDT(150x, 300k USDT 한도) 입력 → 최소/최대 마진 표기가 거래소 규칙과 일치하는지 확인  
    5. **API 키 검증**: 마이페이지에서 API Key/Secret 누락 → 로직 생성 시 Alert 발생 확인  
- [ ] (Phase 0 완료 후) 테스트 전략 문서화 및 협의

---

## Phase 1. 데이터 모델 확장
- [x] `Entry`, `ScaleIn`, `Exit` 조건에 대해 롱/숏 별도 상태(지표 세트, 방향, 저장 메타 정보) 정의
- [x] 캔들 조건 `reference` 필드(현재/이전) 및 USDT 기준 입력을 위한 필드 추가
- [x] 스토어(`autoTradingSettingsStore`) 업데이트: 기본값, 저장/로드 마이그레이션, 검증 로직 강화
- [x] 타입(`auto-trading.ts`) 정비 및 주석 문서화

### 체크리스트
- [x] 기존 저장본과의 호환 여부 확인
- [x] 타입 검사 및 ESLint 통과

### 구현 상세
#### Phase 1 ― 기존 저장본 호환성 확인
- 로컬 스토리지에 저장된 V0/V1 `settings` 구조를 `PersistedAutoTradingSettings` 샘플로 정리하고, 신규 스키마와 필드 매핑표를 작성해 누락 필드를 확인합니다.
- `src/stores/autoTradingSettingsStore.ts`의 `persist` 옵션에 `version`과 `migrate`를 추가하고, 저장 데이터가 없거나 구조가 달라졌을 때 `normalizeAutoTradingSettings`로 안전하게 보정합니다.
- `src/lib/trading/migrations/autoTrading.ts`(신규)에서 `normalizeAutoTradingSettings`를 구현해 롱/숏 구조, 지표 기본값, 헤지 방향 배열 등을 일괄 변환합니다.
- `src/stores/__tests__/autoTradingSettingsStore.migration.test.ts`에서 V0 샘플(JSON fixture) → 최신 스키마로 변환되는 단위 테스트를 작성해 필수 필드 기본값, 방향 배열, 지표 옵션이 기대값과 일치하는지 검증합니다.
- 수동 QA: 기존 저장본을 `localStorage.setItem('auto-trading-settings', sampleV0Json)`으로 주입 후 앱을 재로딩하고, UI에서 롱/숏 탭/헤지 옵션이 정상적으로 복원되는지 확인합니다.

---

## Phase 2. 마진 계산 로직 고도화
- [x] `fetchLeverageTiers` 데이터를 반영해 거래소 최대 노미널과 잔고 기반 한도를 비교
- [x] 최소 마진: `min_notional / leverage` / USDT 기준 → `amount` 계산 및 가격 정밀도 적용
- [x] 추가 매수 예산 계산식 업데이트(매수 마진 비율, 1000% 상한 등)
- [x] 계산 결과와 라벨(거래소 한도/전략 한도) UI 반영

### 체크리스트
- [x] 단위 테스트(계산 함수) 작성
- [x] Jest `npm run test` 실행(2025-10-18) ― `marketDataStore`, `margin` 스위트 통과
- [ ] 주요 시나리오(ETH/USDT 150x 등) 수동 검증

### 구현 상세
#### Phase 2 ― 마진 계산 로직 고도화
    - `src/lib/trading/margin.ts`에 `resolveMarginCap`, `calculateMinMargin`, `calculateMinPosition`, `calculateMaxPosition`, `toQuantityByNotional`, `calculateScaleInBudget`을 분리해 거래소 한도/전략 한도와 최소/최대/추가 매수 포지션을 유틸 함수로 제공합니다.
    - `fetchLeverageTiers` 응답을 `src/lib/trading/adapters/binanceLeverage.ts`에서 정규화하고, 노미널 상한·레버리지 구간을 `findTier(symbol, leverage)` 형태의 헬퍼로 조회합니다.
    - `toQuantityByNotional`은 가격/수량 정밀도(`quantityPrecision`)와 최소 수량(`minQty`)을 반영해 USDT 기준 입력을 수량으로 환산하며, `calculateScaleInBudget`은 잔고·마진 비율/최소 주문 단위를 고려해 1회 추가 매수 예산을 산출하고 1,000% 상한을 적용합니다.
    - `src/lib/trading/__tests__/margin.test.ts`에서 최소/최대 마진, 추가 매수 예산 분배, 한도 제한 라벨, 티어 미존재 시 동작을 검증하는 단위 테스트를 작성합니다.
    - QA: ETH/USDT 150x, BTC/USDT 125x 등 주요 심볼을 대상으로 한도 표시 UI와 계산 결과를 비교표로 캡처해 공유합니다.

---

## Phase 3. UI 리팩터링 (롱/숏 탭 및 컴포넌트 구조)
- [x] 매수/추가 매수/매도 조건 영역을 탭 기반으로 분리, 각 탭에서 롱/숏 설정 가능하게 처리
- [x] 캔들 조건을 지표 영역에 통합하고 UI 간격/강조 색상 재구성
- [x] Storybook 시각 검증 흐름 구축(롱/숏/헤지 케이스)
- [x] 컴포넌트별 최소/최대 높이·폭 조정, 여백 축소
- [x] 섹션 라벨과 경계선 스타일 통일
- ✅ 2025-10-18: 섹션별 아코디언 저장 플로우와 시나리오 요약 카드 추가

### 체크리스트
- [x] 반응형(모바일/데스크톱) 레이아웃 확인
- [x] 접근성(키보드 네비게이션) 점검
- [ ] Storybook 정적 빌드(SB_BUILDER-WEBPACK5_0002) 안정화

### 구현 상세
#### Phase 3 ― UI 리팩터링
  - `src/components/trading/AutoTradingSettingsForm/index.tsx`를 섹션 컴포넌트(`EntrySection`, `ScaleInSection`, `ExitSection`)로 분리하고, 각 섹션에서 `LongShortTabs` 컴포넌트를 공유하도록 구조화합니다.
    - 캔들 조건과 지표 필드를 `src/components/trading/indicators/IndicatorFieldset.tsx`로 모듈화하고, 동일한 스타일 토큰(`flex gap-3`, `text-brand-300`)을 적용해 디자인 가이드를 맞춥니다.
    - 지표 조건 편집은 모달에서 캔들 기준 + 지표 체인(AND/OR)을 구성하도록 전환했습니다.
- LongShortTabs 컴포넌트에 tablist/tabpanel aria 속성과 키보드 네비게이션을 추가하고, 모바일에서도 자연스럽게 전환되도록 레이아웃을 정리합니다.
- Storybook에 `AutoTradingSettingsForm.visual` 스토리를 추가해 롱/숏/헤지 케이스를 시각적으로 검수합니다.
    - `src/test-utils/fixtures/autoTradingSettings.ts`에 `longOnly`, `shortOnly`, `hedgeBalanced` 샘플 상태를 정의해 스토리와 RTL 테스트에서 동일한 데이터를 재사용합니다.
    - `src/components/trading/automation/__stories__/AutoTradingSettingsForm.visual.stories.tsx`에서 `scenario` 컨트롤 기반 스토리를 선언하고, `play` 플로우(`verifyVisualStates`)를 통해 탭 전환·헤지 토글·핵심 인풋 변경을 자동 재현합니다.
    - `.storybook/main.ts`, `.storybook/preview.tsx`를 도입해 Next.js + Tailwind 환경을 Storybook과 동기화하고, `npm run storybook`/`npm run storybook:build` 스크립트를 추가했습니다.
    - 현재 `npm run storybook:build` 실행 시 `SB_BUILDER-WEBPACK5_0002` 캐시 훅 오류가 발생해 정적 빌드가 중단되며, Storybook 8.6.x 이슈로 추적 중입니다(워크어라운드: dev 서버에서 수동 캡처 진행).
      - `webpackFinal`에서 캐시/플러그인 가드를 적용했으나 `Compiler.cache` 후크에서 `tap`이 정의되지 않아 종료됨. 후속 조치: Storybook 8.6.15 이상 패치 여부 확인 또는 빌더 교체 검토.
    - Visual Regression(CI/Chromatic) 연동은 Phase 6 QA 단계에서 진행하며, 현재는 Storybook `chromatic.pauseAnimationAtEnd` 파라미터만 선적용된 상태입니다.
    - `LongShortTabs` UI를 도입해 매수/추가 매수/매도 섹션에서 롱/숏 각각의 지표·수익률·즉시매수 설정을 독립적으로 편집하고, 비활성 상태 안내·추가 매수 예산 요약을 제공하도록 개선합니다.

**추가내용(수정내용)** : 현재 상태에서 수정 내용만 추가로 기재함.
로직생성기 구현 방식은 (자동매매 기본설정 > 매수조건설정 > 추가매수설정 > 매도설정 > 손절설정) 순으로 결정됨.
금액은 모두 USDT or USDC 기준값을 받지만 실제 주문은 수량(amount)로 주문실행함.
  - 기본 설정
    1. 레버리지 설정
      전 종목 동일 레버리지 , 종목별 레버리지 설정 으로 분리(종목 선택 단계에서 설정 가능)
    2. 최초 마진 사용 금액(아래 3조건 중 선택)
      - 잔고비율 기준 입력값(레버리지 해당 amount 계산)
      - USDT or USDC 기준 입력값 (레버리지 해당 amount 계산)
      - 최소 주문 단위 : 동시 선택 가능, 선택시 위 2가지 조건이 최소 주문 단위 이하일때 최소 주문 단위로 매수주문.
    3. 추가 매수 금액 설정(아래 4조건 중 선택)
      - 잔고비율 기준 입력값
      - USDT or USDC 기준 입력값
      - 현재 마진 금액 기준 or 최초 마진 금액 기준 입력값
      - 최소 주문 단위 : 동시 선택 가능, 선택시 위 3가지 조건이 최소 주문 단위 이하일때 최소 주문 단위로 매수주문.
    4. 추가 매수 한도(아래 4조건 중 선택)
      - 잔고비율 기준 입력값
      - USDT or USDC 기준 입력값
      - 현재 마진 금액 기준 or 최초 마진 금액 기준 입력값
      - 매수 횟수 기준 입력값
    5. 거래 종목 선택
      - 종목 별 레버리지 설정 가능
        - ✅ 2025-10-18: 종목 선택 팝업에서 커스텀 레버리지 입력 및 저장 지원 (기본값은 전 종목 동일 레버리지 적용)
      - 조건 검색일 경우 미리 설정된 종목은 레버리지 설정값 반영
      - 종목 선택과 레버리지만 설정 2개 구분
      - 제외종목 Ticker 형식 보정, BTC/USDT:USDT 형식
    6. 기본 설정 저장

  - 포지션 진입(매수) 설정
    1. 롱 / 숏 탭 구분해서 생성
    2. 조건 결합방식은 2번째 조건 결합시 부터 입력
    3. 캔들조건은 각 조건 결합조건 임
      ex) 캔들(종가/이전캔들) + 볼린저밴드상단돌파
        and(or) 캔들(종가/이전캔들) + MA120 상단유지
    4. 지표 조건은 현재 창에 조건을 나열하지 말고 팝업창에서 지표 추가하도록 변경(이 사항은 모든 조건 입력에 적용)
      - ✅ 2025-10-18: 조건 결합 방식 및 지표 편집을 모달로 분리하고, 지표별 AND/OR 선택 및 '조건 추가' 버튼으로 확장 가능
      - ** 지표 조건 설명 ** ex)숏 매수 지표 조건
        조건 <추가 버튼> : 누르면 지표를 선택할 수 있는 팝업창 오픈
        조건 <삭제 버튼> : 누르면 리스트에 있는 조건 삭제 선택 후 삭제 기능
        창에는 캔들(이전/현재)값 + 볼린저밴드 상단 돌파 <추가 버튼> : 누르면 지표 조건 목록에 리스트업
        리스트업된 목록 앞에는 (AND/OR) 선택, 리스트 그룹화
        예를 들어, 1,2번 조건은 AND 조건 3번은 OR 조건
        지표는 한가지 지표를 다른 수치로 추가 리스트업 할 수 있도록함. 같은 지표는 OR 조건만 만족.
        - 캔들조건 중에 이상/이하는 필요없는 조건(삭제) : ex) 이전캔들의 종가가 기준값이 되어 이 값이 볼린저 밴드 상단을 돌파하는지 여부를 판단.
        - 매도 조건은 수익율 조건만 선택할 수 있도록, 지표선택은 선택안함 항목 추가.
      - DMI 지표 일부 수정(ADX)
        - ADX > DI+ , ADX < DI+ , ADX > DI- , ADX < DI- : 4가지 조건 추가
    5. 지표 조건은 동일한 지표 다른 조건으로 중복 적용 가능.

  - 추가 매수 설정
    1. 포지션 진입 동일 조건에 수익율 추가

  - 양방향 매수 설정
    1. 추가 매수 설정에 롱/숏 포지션이 있을때 만 적용.

  - 매도 설정
    1. 롱/숏/양방향 롱/양방향 숏 탭으로 구분

  - UI 홈페이지 스타일보다, 기능성 앱 스타일로 여백을 최소화하고 기능 집약적 디자인 적용.
  - 제목, 구분항목 등 다크테마에 어울리는 강조색상 활용으로 시인성 확보.
  - 가장 선호하는 스타일은 바이낸스 트레이딩 플렛폼 스타일.
  


## Phase 4. 섹션별 저장 & 접기/펼치기 UX
- [x] 각 주요 섹션에 “변경 → 저장 → 접기” 플로우 도입 (저장 후 완료 배지 표시)
- [x] 저장 로직: 섹션 단위로 상태 diff 체크 후 스토어에 반영
- [x] 오류가 없을 경우 자동으로 섹션 접기 및 성공 알림 처리

### 체크리스트
- [ ] 저장 버튼 비활성/활성 상태 전환 테스트
- [ ] 접기/펼치기 상태 로컬 유지 여부 결정 및 구현

### 구현 상세
#### Phase 4 ― 섹션별 저장 & 접기 UX
- `src/components/trading/automation/SectionFrame.tsx`를 만들어 헤더, 저장 버튼, 배지, 접기 토글을 표준화하고, 섹션별로 상태 변경 감지를 위한 `useSectionDirtyFlag` 훅을 도입합니다.
- 저장 시에는 `diffSection(prev, next)` 유틸로 수정 여부를 판별하고, 차이가 없으면 버튼을 비활성화하며 토스트를 생략합니다.
- 접기 상태는 `src/stores/uiPreferencesStore`에 `autoTrading.collapsedSections` 키로 저장해 새로고침 후에도 유지되게 하고, `localStorage`와 동기화합니다.
- `src/components/trading/__tests__/AutoTradingSettingsForm.section.test.tsx`에서 저장 버튼 활성화/비활성, 성공 토스트, 접기 상태 유지 여부를 RTL로 검증합니다.

---

## Phase 5. 최종 저장(로직 생성) 버튼 & 검증
- [x] “임시 저장”과 별도로 “로직 생성” 버튼 추가
- [x] 로직 생성 시: 모든 섹션 저장 여부 확인 → 에러/미완료 섹션 안내
- [x] API Key/Secret Key 등록 여부 확인(마이페이지 값 기반) 및 누락 시 Alert
- [x] 준비 완료 상태(자동매매 시작 가능) 안내 메시지 제공

### 체크리스트
- [ ] 로직 생성 후 상태 초기화/재편집 플로우 정의

### 구현 상세
#### Phase 5 ― 로직 생성 버튼 & 검증
- `src/components/trading/AutoTradingSettingsForm/FooterActions.tsx`에서 “임시 저장”과 “로직 생성” 버튼을 분리하고, 후자에 `onGenerateStrategy` 핸들러를 연결합니다.
- `src/lib/trading/validators/autoTrading.ts`에 섹션별 완료 여부를 검사하는 `assertSectionReady` 함수를 추가하고, 실패 시 섹션 이름과 해결 방법을 포함한 에러를 throw합니다.
- `src/lib/trading/services/autoTradingStrategy.ts`에서 API 호출 전 API Key/Secret 검증을 수행하며, 누락 시 `useToast`로 Alert를 띄우고 `AccountSettings` 페이지 링크를 안내합니다.
- 테스트: 검증 실패 → Alert 노출, 모든 섹션 완료 → `createAutoTradingStrategy` 호출, 완료 후 스토어 초기화 → 기본값 복원까지를 통합 테스트(`AutoTradingSettingsForm.generate.test.tsx`)로 검증합니다.

---

## Phase 6. QA & 문서화
- [ ] 기능별 QA 시나리오 작성 및 실행
- [ ] 회귀 테스트(기존 기능 영향 여부) 확인
- [ ] 사용자 가이드/README 업데이트 (동작 설명, 계산식 명시)
- [ ] 추후 백엔드/자동매매 모듈 연동을 위한 TODO 정리

### 구현 상세
#### Phase 6 ― QA & 문서화
- 기능 QA 체크리스트를 `docs/qa/auto-trading-settings.md`에 작성하고, 각 항목별 스크린샷·재현 절차를 첨부합니다.
- 회귀 테스트는 기존 자동매매 설정 저장/불러오기, 거래소 API 연결 등 주요 흐름을 대상으로 Smoke 테스트 스크립트를 정리합니다.
- 사용자 가이드는 `docs/user-guide/auto-trading.md`에 UI 캡처, 각 필드 설명, 계산식(`minMargin`, `maxPosition`)을 표 형태로 문서화합니다.
- 백엔드 연동 TODO에는 전략 생성 API 엔드포인트, 시그널 전달 방식, 인증 요구사항 등을 Issue 링크와 함께 열거해 추후 협업 인입 시 참고하도록 합니다.

---

## 참고
- 우선순위는 Phase 1 → 2 → 3 → 5 → 4 → 6 순으로 진행하며, 각 단계 완료 시 `docs/auto-trading-roadmap.md` 내 체크박스를 업데이트합니다.
- 예상 리스크: 저장 스키마 변경, UI 복잡도 증가, 로컬 스토리지 마이그레이션, 계산 정확도. 단계별로 단위 테스트와 수동 검증을 병행합니다.
