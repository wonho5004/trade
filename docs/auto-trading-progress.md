## 자동매매 설정 개발 진행현황 (Progress & Plan)

본 문서는 현재 자동매매 설정(Trading Automation) 화면 및 저장 로직 전반의 진행상황과, 이후 단계 계획을 정리합니다. 새 세션에서도 이 문서를 기준으로 동일한 작업을 이어갈 수 있습니다.

### 1) 완료 사항 (요약)

- 공통/저장 안정화
  - 그룹 편집 모달 저장 시 지표가 사라지던 문제 해결(정규화 중 리프 누락/ID 변조 레이스 제거).
  - 지표 변경은 onChange에 즉시 영속화(정규화 우회 Raw 저장), 섹션 ‘저장’은 재검증/스냅샷 용도로 항상 활성.
  - 도움말(ⓘ) 모달 도입: 섹션별 설명을 모달로 표시.

- 기본설정
  - 레이아웃 2-2-2.
  - 로직명 중복확인 버튼/저장된 이름 목록 및 삭제 기능.
  - ‘롱 사용’ 기본값 해제.

- 진입(매수)
  - ‘즉시 매수’ 체크 시 조건 그룹 편집 비활성화.

- 조건/상태
  - 현재 수익률(−10000%~10000%) 편집 UI를 추가매수/청산/헤지/손절 섹션에 추가.
  - 상태 조건 노드(StatusLeafNode) 도입: 수익률/마진/매수횟수/진입경과. 편집/삽입/삭제/이동 지원.

- 종목 선택(1차)
  - 심볼검색 상단에 쿼트(USDT/USDC) + 검색 + 정렬 통합.
  - 목록 전폭 테이블(심볼/베이스/쿼트/거래량/거래금액/변동률/상장일수) + 행 단위 “추가/제거, 제외/제외해제”.
  - 선택/제외 표를 위/아래 스택 배치(완료). 선택 표에 제거 버튼/드롭다운(레버리지 기본설정/직접입력, 포지션 기본/롱/숏/양방향, 기능 오버라이드 기본/제외).
  - 자동선택 카드: 거래량순(상위/하위), 일변동률(상승/하락), 시가총액(상위/하위) 기준으로 선택/제외에 일괄 반영.
  - 상단에 “현재 선택 N / 부족 M” 표시(기본설정 종목수 기준).
  - 좌측 필터 패널(목록 표시 전용): 스테이블 제외, 상장일 정보 없음 숨기기, 상장일 ≤N 숨기기. 최소 거래량/거래대금 항목은 제거됨.
  - 서버: `/api/markets` 결과를 quote로 필터링, search/limit 지원. 소스: 정렬 후 전체 반환으로 누락 최소화.
  - UI 마감(추가): 컬럼 토글(거래량/거래대금/변동률/상장일수), 헤더 sticky 적용.

- 엔진/실행 흐름(1차)
  - 조건 평가기(evaluateConditions): 그룹 AND/OR, 상태(수익률/마진/매수횟수/진입경과), 캔들(기본 비교), 지표(신호맵) 지원.
  - 실행계획(toExecutablePlan): 지표/상태/캔들/그룹 노드 수집 및 루트 반환.
  - 브라우저 워커(createEngineWorker): 백그라운드 평가 실행.
  - 지표 신호 자동계산 스텁(buildIndicatorSignals): MA/RSI/Bollinger/MACD/DMI 지원.
  - DMI/ADX 스냅샷/수치표시(computeDmiSnapshot) 추가.
  - 성능 최적화: lookback 산정(requiredLookback), 신호 캐시, 평가 스로틀(150ms).

- 프리뷰/트레이스(1차)
  - 프리뷰 ConditionsPreview: 실시간 캔들 구독 + 자동 신호 계산 + 상태 가정값 입력(수익률/마진/매수횟수/경과일).
  - 섹션/그룹/지표 편집 모달 상단에 프리뷰/심볼 입력/쿼트 토글/“지표 신호 가정(ON)” 일관 적용.
  - 트레이스 ConditionsTrace: 지표/상태/캔들/그룹 노드별 통과 여부 + 캔들 now 값/지표 비교 조건(간략) 표시.

- 지표 편집/신호
  - Bollinger ‘터치’ 허용 오차 옵션화(touchTolerancePct). MACD 비교+히스토그램 동시 조건 시 AND 처리.

- 심볼 입력 UX
  - 심볼 유효성 훅(useSymbolValidation): /api/markets 기반 제안/검증/로딩 제공. datalist 통합. blur 시 자동 정규화.

### 2) 진행 중 (In Progress)

- 종목 선택 2단계(사용성 마감)
  - [완료] 좌측 필터 패널 도입/목록에 적용.
  - [완료] 자동선택 동작 연결(선택/제외로 일괄 반영, 제외 사유 태그 표기).
  - [완료] 레거시 블록 제거(숨김 처리된 `SymbolsControlPanel` 등 코드 완전 삭제).
  - [완료] 제외 사유(excludedReasons) 영속 저장(UI↔스토어 배선, 저장/복원).
  - [계획] 반응형(고정 헤더/컬럼 토글).

- 조건그룹에 ‘상태’ 조건 결합(B 단계)
  - [설계] ConditionNode에 status 계열 노드(현재 수익률/현재 마진/매수횟수/진입시간 등) 추가.
  - [UI] ConditionsEditorModal에 상태 조건 탭/편집기 추가.
  - [검증] validators/마이그레이션/defaults 보강, Raw 저장 경로 유지.

### 3) 다음 단계 (구체 계획)

#### A. 종목 선택 마감(2단계)
1. [완료] 레거시 블록 제거(코드 정리). 불필요 API/상수 점검은 후속 진행.
2. [완료] 제외 사유(excludedReasons) 영속화
   - 타입/기본값/마이그레이션 반영 완료(SymbolSelection.excludedReasons: Record<string, string>).
   - 자동선택/수동제외 시 사유 기록 → 저장/복원 처리 완료.
3. 필터 패널/반응형
   - 저장 여부: 현재는 목록 표시 전용 유지(사용자 환경설정 저장은 보류).
   - [완료] 목록 헤더 sticky 적용, 표시 컬럼 토글(거래량/거래대금/변동률/상장일수)
   - [완료] 모바일 가독성: 목록 컨테이너 수평 스크롤 허용(`overflow-x-auto`), 최소 폭 지정(`min-w-[720px]`)
   - [완료] 사용자 환경설정 저장(표시 컬럼/필터: 스테이블 제외, 상장일 정보 숨김, 상장일수 임계)
   - [완료] 컬럼 순서 프리셋 저장(거래량/거래대금/변동률/상장일수 순서 이동 지원)
   - [완료] 컬럼 너비 프리셋 저장(px 단위, 64~240 범위)

#### B. 상태/캔들 조건 마감(조건그룹 내부)
1. [완료] 타입/마이그레이션/UI/검증/저장/엔진/프리뷰 연결.
2. [진행] 단위/범위 세부 검증(상태/캔들) 및 트레이스 비교 기준 풍부화(지표간 비교 타겟명 등).
3. [완료] 프리뷰에 OHLC/거래량/캔들 시간 표시 추가(컴포넌트: `src/components/trading/automation/ConditionsPreview.tsx`)
   - O/H/L/C, VOL, 캔들 오픈~클로즈 시간대로 표시. 모바일에서는 VOL 축약(숨김) 처리.
4. [완료] 트레이스 개선: 지표간 비교 시 타겟 지표명을 표시(예: `cmp 볼린저 밴드 (previous) over`)
   - `src/components/trading/automation/ConditionsTrace.tsx`에서 타겟 지표 ID를 매핑해 라벨링
5. [완료] 숫자 표시 개선: 트레이스의 캔들 now/타깃값은 의미 있는 자릿수만 표시(최대 4자리), 상태의 percent 단위는 `%`로 표기

#### D. 오버라이드 병합/해석
- [추가] 심볼별 오버라이드 해석 유틸: `src/lib/trading/engine/merge.ts`
  - `resolveSymbolConfig(settings, symbol)` → 레버리지/포지션 선호/기능 플래그 계산
3. ConditionsEditorModal에 상태 조건 추가(선택 → 편집 → 트리에 삽입/삭제/이동 지원).
4. GroupListPanel 요약에 상태 조건 표시.
5. 저장은 현 구조 유지(정규화 우회 Raw + compat 유지).

#### C. 진입/추가매수/청산/헤지/손절 세부 요구 반영
- 예상 투자금액/잔고조회, 최소 주문 단위 옵션, 금액 계산 보조(지갑/거래소 API 연동 or 모의값 기반).
- 헤지/손절 라인 자동 재생성 등 오버라이드 항목 확장.

### 4) 리스크/결정 필요
- 제외 사유 저장 방식: 영속 vs 뷰 전용 태그(현재는 뷰 전용 → 영속화 예정).
- 상태 조건 세트/범위/연산자 확정(현재 제안: 수익률(%), 마진(USDT/USDC), 매수 횟수(정수), 진입시간(일/시간)).
- 엔진 측 연동 포인트/명세(상태/캔들 평가 기준, 지표 신호 계산 근거, per-symbol 오버라이드 우선순위 등).
- 실시간 평가 부하 관리(워커 개수/스로틀/샘플링)와 데이터 소스 신뢰성(/api/markets, WebSocket) 대비책.

### 5) 테스트 가이드(핵심 시나리오)
- 지표 편집 → 패널 반영 → 새로고침 유지.
- 섹션 ‘저장’ 클릭 → 값 유지(재검증/스냅샷).
- 종목 선택: 쿼트/검색/정렬/필터 → 목록 반영. 행 버튼(추가/제외) → 표 반영.
- 자동선택: 기준/N 입력 → 선택/제외에 추가. 상단 부족 개수 감소 확인.
- 제외 표: 자동선택 사유 태그 표시.
- 프리뷰: 심볼/쿼트 변경, 상태 가정값, 지표 신호 가정 토글 → 평가 결과/트레이스 즉시 반영.
- DMI/ADX: 수치표시가 설정 파라미터와 일치하는지 확인(경계값/기간 변경 포함).

### 6) 파일 포인트
- 종목 UI: `src/components/trading/automation/SymbolsPickerPanel.tsx`
- 섹션 컨테이너/도움말: `src/components/trading/automation/SectionFrame.tsx`, `src/components/trading/automation/helpContent.tsx`
- 저장/스토어: `src/stores/autoTradingSettingsStore.ts` (updateIndicatorsRaw 등)
- 서버/데이터: `src/app/api/markets/route.ts`, `src/lib/trading/markets.ts`
- 엔진/평가: `src/lib/trading/engine/{conditions.ts, worker.ts, indicatorSignals.ts, merge.ts}`
- 프리뷰/훅: `src/hooks/useConditionsEvaluator.ts`, `src/components/trading/automation/{ConditionsPreview.tsx, ConditionsTrace.tsx}`
- 검증/에디터: `src/lib/trading/validators/autoTrading.ts`, `src/components/trading/indicators/IndicatorParamEditor.tsx`
- 문서: `docs/logicconst.md` (요구서 갱신), `docs/auto-trading-progress.md`(본 문서)

---
마지막 업데이트: 2025-10-20
#### E. 엔진/성능 고도화
- [진행] 지표 신호 롤링 업데이트(EMA/RSI/MACD 누적식은 단계적 도입 예정). 현재 단계: 시계열 배열 캐시(준-롤링) 도입.
- [완료] lookback 산정 + 신호 캐시 + 평가 스로틀(150ms) — `useConditionsEvaluator`에 cond/시리즈 길이/최종 ts 기반 캐시 도입.
- [완료] 평가 메트릭 수집(최근/평균 지연) 및 프리뷰 표시.
- [완료] 워커 취소/에러 격리(하드-캔슬: 워커 리셋) — 연속 평가 시 이전 작업 즉시 중단.

#### F. 통합/테스트
- 단위 테스트: 변환/마이그레이션/validator/엔진 평가/신호계산(임계 케이스) 추가.
  - [추가] 상태 조건 평가 테스트(`conditions.status.test.ts`)
  - [추가] 오버라이드 병합 유틸 테스트(`merge.test.ts`)
  - [추가] lookback 산정 기본 보장 테스트(`indicatorSignals.test.ts`)
- E2E(프리뷰/트레이스/편집 흐름) 스냅샷.
  - [추가] ConditionsTrace 스냅샷(`ConditionsTrace.snapshot.test.tsx`)
  - [추가] ConditionsEditorModal 스냅샷(`ConditionsEditorModal.snapshot.test.tsx`)
- [추가] /api/markets 안정성 회귀 테스트(`src/app/api/markets/route.test.ts`)
  - 네트워크 예외/HTML 응답(Invalid JSON)에서 `items` JSON 응답 보장
  - 잘못된 quote 파라미터 시 안전 기본값(USDT) 필터링
  - search/limit 동작 확인
  - [완료] UI 테스트 기대값 갱신 및 흐름 보정(`AutoTradingSettingsForm.short-entry.test.tsx`) — 현재 전체 테스트 통과

#### G. 실행 파이프라인/백엔드 연동(초안)
- 실행기 스펙 정리: 실행계획(지표 파라미터/상태/캔들) → 신호 수집 → 평가 → 액션(매수/추가/청산/헤지/손절).
- 오버라이드 병합(resolveSymbolConfig) 적용 시점/우선순위 문서화 및 적용.
- 실계좌/모의 백엔드 인터페이스 정의(보안/쿼터/재시도/백오프 포함).

#### H. UI 마감/접근성
- 컨트롤 라벨/툴팁/키보드 내비 개선, 색상 대비/상태 배지 일관화.
- 프리뷰 바 고정/축소 모드, 설정 유지(사용자 환경설정 저장) 검토.
- [완료] 모바일 레이아웃: 프리뷰 헤더/캔들 요약의 시각 소음 축소(평가 메트릭/시간 표시를 작은 화면에서 숨김 처리)
- [완료] 요약 숫자 표기: 트레이스/그룹 요약의 숫자 자릿수 정리(최대 4자리, 말단 0 제거)
 - [완료] GroupListPanel 요약: 지표-지표 비교 시 타깃 지표명을 직접 표기(예: cmp 이동평균선 gte ...)
