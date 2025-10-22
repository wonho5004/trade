# 자동매매 설정 개발 순서(진행 기록 + 이어서 할 일)

본 문서는 새로운 채팅/세션에서도 연속 작업이 가능하도록 개발 순서와 현재 상태, 다음 작업 항목을 한눈에 정리합니다. 각 단계는 구현 파일 경로와 검증 포인트를 포함합니다.

## 0) 사전 세팅/기본 원칙
- Next.js + Zustand + shadcn/ui 스타일 준수, 타입 엄격(Strict)
- UI는 다크 테마 + 기능 집약(바이낸스 스타일), 저장/오류는 토스트로 피드백
- 테스트 우선: Jest + RTL, 마이그레이션/폼/스토어 최소 보장

## 1) 데이터 모델/마이그레이션
- 타입/기본값 정리: `src/types/trading/auto-trading.ts`, `src/lib/trading/autoTradingDefaults.ts`
- 마이그레이션: `src/lib/trading/migrations/autoTrading.ts`
  - legacy → 최신 스키마 변환, candle/entries 호환 필드 유지
  - 기본 트리 ID 결정적 고정(cond-root/cond-candle/cond-ind-1)
- 스토어: `src/stores/autoTradingSettingsStore.ts` (persist/migrate)
- 테스트: `src/stores/__tests__/autoTradingSettingsStore.migration.test.ts` (통과)

## 2) 조건 편집 모달(지표/캔들/비교/그룹)
- 모달: `src/components/trading/automation/ConditionsEditorModal.tsx`
  - 지표 선택 → 편집 모드 전환, 파라미터 편집 + 비교(캔들/값/다른 지표)
  - 그룹 트리 편집(AND/OR, 하위 그룹/지표 추가, 제거)
  - DnD 정렬(지표/그룹) + 키보드 접근성(↑/↓, ⌘/Ctrl+D, Delete)
  - Undo/Redo(최대 20 스텝)
- 지표 파라미터 에디터: `src/components/trading/indicators/IndicatorParamEditor.tsx`
  - MA/RSI 허용 조합 강제, DMI(ADX vs DI) 확장, MACD/Bollinger/RSI 파라미터
- 트리 유틸: `src/lib/trading/conditionsTree.ts` (수집/치환/이동/복제)

## 3) 섹션 래퍼/저장 UX
- 섹션 프레임: `src/components/trading/automation/SectionFrame.tsx`
  - 변경 감지 → 저장 버튼 → 성공 시 자동 접기 + 토스트, 실패 시 에러 토스트
- 토스트 Provider: `src/components/common/ToastProvider.tsx` (페이지에 제공)
- 설정 페이지: `src/components/trading/automation/AutoTradingSettingsForm.tsx`
  - 기본/매수/추가매수/매도/손절/헤지/심볼/레버리지 섹션 구성
  - 심볼 선택 UX: `SymbolSelector`(검색/자동완성) + `src/lib/trading/symbols.ts`

## 4) 검증/전략 생성
- 검증: `src/lib/trading/validators/autoTrading.ts`
  - 기본/매수/추가매수/매도 섹션별 상세 검증(필수 지표/허용 조합/비교 타겟)
  - 저장 시 검증 연동(섹션별 onSave 내부)
- 전략 생성: `src/lib/trading/services/autoTradingStrategy.ts`
  - API Key/Secret 확인 → `/api/strategies` 저장(메타데이터)
  - API: `src/app/api/strategies/route.ts` (1개 제한/백업)

## 5) 심볼/마켓 데이터
- 마켓 API: `src/app/api/markets/route.ts` → `src/lib/trading/markets.ts`
- 자동완성: `src/components/trading/automation/SymbolSelector.tsx`, `src/hooks/useDebounce.ts`

## 6) 현재 상태(요약)
- 테스트: 26 passed / 0 failed
- 핵심 기능: 조건 모달(DnD/Undo), 섹션 저장/검증/토스트, 심볼 자동완성, 전략 저장 API

## 7) 다음 작업(우선순위)
1) 조건 DnD 시각적 가이드 고도화(드롭 라인/플레이스홀더)
   - ✅ 2025-10-18: 드래그 오버 시 인디케이터 위/아래 드롭 라인 표시, 그룹 호버 하이라이트 + 플레이스홀더 안내 추가
   - 구현: `src/components/trading/automation/ConditionsEditorModal.tsx`
   - 확인: 지표 끌어 순서 변경 시 초록색 라인이 위/아래에 표시되고, 그룹 전체가 연두색 라인/링으로 강조됨
2) 저장 전 에러 필드 하이라이트(섹션 내 포커스 이동), Undo 토스트 액션(되돌리기)
   - ✅ 2025-10-18: 섹션 저장 시 검증 실패하면 해당 필드/버튼 하이라이트 및 첫 오류 포커스 이동
   - ✅ 2025-10-18: 저장 성공 토스트에 '되돌리기' 액션 추가(섹션별 undo 지원)
   - 구현: `ToastProvider` 액션 버튼, `SectionFrame` undo 액션 처리, `AutoTradingSettingsForm` 각 섹션 onSave에서 undo 반환 및 포커스 처리
3) 심볼/레버리지 서버 검증(거래소 티어/허용 레버리지), 예외 케이스 안내
   - ✅ 2025-10-18: 서버 측 심볼 유효성 검증 API 추가(`/api/markets/validate`), 수동/제외/오버라이드 입력 검증 연동
   - 제한: 레버리지 티어 상세는 바이낸스 서명 API 필요. 현재는 1~125 범위 기본 검증만 수행(Phase 2에서 티어 연동 예정)
   - 구현: `src/app/api/markets/validate/route.ts`, `src/lib/trading/markets.ts#fetchPerpetualSymbolSet`
   - 프론트 연동: 심볼 섹션 저장 시 서버 검증 후 저장. 실패 시 섹션 토스트 에러로 사유 표시
4) Phase 2 연동: 레버리지 티어 기반 마진 계산(최소/최대/수량 산식) + UI 가이드
   - 진행: 코어 계산 유틸 분리/구현 완료(`src/lib/trading/margin.ts`), 티어 정규화 어댑터 추가
   - 잔여: ETH/USDT 150x 등 주요 시나리오 수동 QA, 한도/라벨 UI 교차검증, 계산식 사용자 가이드 반영
5) 전략 관리 UI: 현재/백업 조회(관리자), 재발행/삭제/복원, 이름 중복 서버 기반 검사
   - API 확장 제안: `GET /api/strategies/list`, `POST /api/strategies/backup`, `POST /api/strategies/restore`, `DELETE /api/strategies/:id`
   - 프론트: 설정 페이지 하단 “전략 관리” 패널(버전/백업/복원/삭제)
6) 접기 상태 영속화: 섹션 접기/펼치기 상태를 로컬에 저장(`uiPreferencesStore`)하고 새로고침 후 유지
7) 에러 포맷 표준화: API/프론트 공통 에러 스키마 합의(JSON), 토스트/필드 하이라이트와 일관 연결

## 8) 빠른 검증 방법
- 페이지: `/trading/automation` → 각 섹션에서 편집/저장/토스트 확인
- 모달: “조건 추가/편집” → 지표/그룹 편집, DnD/Undo/Redo 동작 확인
- 심볼: 종목/제외/오버라이드 추가/제거, 값 범위/정규화(BTC/USDT → BTCUSDT) 확인
- 테스트: `npm test` (Jest), 린트: `npm run lint`
- Phase 2 수동 QA: `docs/qa/phase2-margin-qa.md`

## 9) 파일 레퍼런스(핵심)
- 타입/기본값: `src/types/trading/auto-trading.ts`, `src/lib/trading/autoTradingDefaults.ts`
- 모달/에디터: `src/components/trading/automation/ConditionsEditorModal.tsx`, `src/components/trading/indicators/IndicatorParamEditor.tsx`
- 섹션/페이지: `src/components/trading/automation/SectionFrame.tsx`, `src/components/trading/automation/AutoTradingSettingsForm.tsx`
- 스토어/마이그레이션: `src/stores/autoTradingSettingsStore.ts`, `src/lib/trading/migrations/autoTrading.ts`
- 검증: `src/lib/trading/validators/autoTrading.ts`
- 심볼: `src/components/trading/automation/SymbolSelector.tsx`, `src/lib/trading/symbols.ts`
- 전략 API/서비스: `src/app/api/strategies/route.ts`, `src/lib/trading/services/autoTradingStrategy.ts`

---
- 본 문서에 체크/메모를 추가하며 이어서 개발하세요. (문서 경로: `docs/auto-trading-dev-sequence.md`)
