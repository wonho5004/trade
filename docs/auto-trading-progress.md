# 자동 매매 개발 진행 로그

## 개요
이 문서는 자동 매매(Next.js 대시보드 + Python 분석/백테스트) 개발의 단계별 진행 상황을 추적합니다. 각 스텝은 목표, 산출물, 검증 방법으로 기록합니다.

## 로드맵(요약)
- 환경 점검 및 기본 실행 경로 확인
- 최소 백테스트 파이프라인 정리 및 예시 전략 스켈레톤
- 실시간/모의 트레이딩 연동(안전장치 포함) 설계
- API 입력 검증·로그 관측 추가 및 에러 표준화
- 테스트 보강(>=80% 커버리지) 및 린트/빌드 파이프라인 안정화

## 선행 작업(차단 사항)
- 자동매매설정 페이지 보완
- 오류 해결 UI 개선

## 체크리스트
- [ ] Next.js 로컬 부팅 확인(`npm run dev`)
- [ ] 프로덕션 번들 스모크 테스트(`npm run build && npm run start`)
- [ ] 분석/백테스트 엔트리포인트 실행(`python python/analysis/main.py`)
- [x] 테스트 통과 및 워치(`npm run test --watch`) — 현재 26 passed / 0 failed
- [x] API 입력 검증(심볼 서버 검증) 추가 — `/api/markets/validate`
- [ ] 에러 포맷 표준화(프론트/백 공통 에러 스키마 합의)
- [x] 자동매매설정 페이지 핵심 플로우 보완(조건 모달, 저장/검증/토스트)
- [x] 오류 해결 UX 개선(실패 필드 하이라이트, Undo 토스트 액션)

## 실행/검증 명령
- `npm install`
- `npm run dev` → http://localhost:3000
- `npm run build && npm run start`
- `npm run lint`
- `npm run test [--watch]`
- `python python/analysis/main.py`

## 히스토리
### 2025-10-18
- 조건 DnD 시각 가이드 고도화(드롭 라인/그룹 하이라이트) — `ConditionsEditorModal.tsx`
- 저장 실패 필드 하이라이트/포커스, 저장 성공 토스트에 되돌리기 액션 추가 — `SectionFrame.tsx`, `ToastProvider.tsx`
- 심볼/레버리지 서버 검증 API 추가 및 프론트 연동 — `/api/markets/validate`, `src/lib/trading/markets.ts`

### 2025-10-20
- 진행 로그 문서 생성: docs/auto-trading-progress.md
- 초기 로드맵/체크리스트 추가, 기본 실행 명령 수집
- 다음 액션 제안: 최소 백테스트 경로 정리 및 샘플 전략 스켈레톤 추가

#### 결정사항
- 자동매매 관련 심화 개발(백테스트/실거래 연동)은 "자동매매설정 페이지 보완"과 "오류 해결 UI 개선" 완료 이후로 보류합니다.

### 2025-10-20 (UI 보완)
- 자동선택 규칙 개수 제한(포함+제외 합산 ≤10): `src/components/trading/automation/SymbolsPickerPanel.tsx`
- 거래량순 → 거래금액순 전환(자동선택 블록): `src/components/trading/automation/SymbolsPickerPanel.tsx:574`
- 상장일 제외 규칙 배지 노출 및 해제: `src/components/trading/automation/SymbolsPickerPanel.tsx:386`
- 선택종목 패널 레버리지(기본/입력값) + 포지션(기본/롱/숏/양방향) 복원: `src/components/trading/automation/SymbolsPickerPanel.tsx:786`
- 저장 시 상장 ≤ N일 제외 값 영속화: `src/components/trading/automation/AutoTradingSettingsForm.tsx:230`
- 드롭다운 위치 좌측 10px 보정(레버리지/포지션/기능, 자동선택 섹션): `src/components/trading/automation/SymbolsPickerPanel.tsx:665,787,808,820`
- 안내 문구 단일 행/가독성 향상: `src/components/trading/automation/SymbolsPickerPanel.tsx:640`
- 변동률 색상/아이콘(▲/▼) 적용, 상장일수 표기 1일 형식: `src/components/trading/automation/SymbolsPickerPanel.tsx:599`

> 기록 원칙: 날짜별 소제목으로 추가하고, 각 항목에 목표·산출물·검증을 간략히 남깁니다. 커밋 메시지는 Conventional Commits를 사용합니다.
