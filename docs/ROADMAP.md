# 프로젝트 로드맵

> 최종 업데이트: 2025-10-25

## 📋 프로젝트 개요

**프로젝트명**: Binance-Style Cryptocurrency Trading Dashboard
**목표**: 바이낸스 수준의 UI/UX를 가진 암호화폐 선물(Futures) 거래 및 자동매매 앱
**대상 사용자**: 암호화폐 트레이더, 자동매매 시스템 운영자

### 기술 스택

**Frontend**
- Next.js 15 (App Router) + TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- Zustand (persist) + React Query
- Lightweight Charts

**Backend**
- Next.js API Routes
- CCXT (Binance Futures API)
- Supabase (PostgreSQL + Authentication)

**분석 (향후)**
- Python: pandas, numpy, scipy

---

## ✅ 완료된 기능 (Phase 1~5 완료)

### Phase 1: 차트 시스템 ✅ (100%)

**완료 시점**: 2024년 10월 중순

- [x] Lightweight Charts 기반 실시간 캔들스틱 차트
- [x] 다양한 시간봉 지원 (1m, 5m, 15m, 1h, 4h, 1d)
- [x] 드래그/줌 기능, 가격 스케일 조정
- [x] 기술적 지표
  - [x] 이동평균선 (MA) - 최대 5개 추가 가능
  - [x] 볼린저밴드 (Bollinger Bands)
  - [x] RSI (Relative Strength Index)
  - [x] MACD
  - [x] DMI (Directional Movement Index)
- [x] 드로잉 기능
  - [x] 지표 기반 조건 설정 (캔들 high/low/open/close 비교)
  - [x] 조건 충족 시 마커/화살표 표시
  - [x] 배경 오버레이 (투명도 조절)
- [x] 지표 설정 UI
  - [x] 입력 파라미터 (기간, 길이, 배수)
  - [x] 스타일 옵션 (색상, 선 종류, 선 굵기)
  - [x] 개별 지표 초기화 버튼
- [x] localStorage 영속화 (Zustand persist)

### Phase 2: 인증 및 권한 시스템 ✅ (100%)

**완료 시점**: 2024년 10월 중순

- [x] Supabase Auth 연동
- [x] 로그인/회원가입 페이지 (`/login`, `/register`)
- [x] 역할 기반 접근 제어
  - [x] `user`: 일반 사용자
  - [x] `admin`: 관리자
  - [x] `sys_admin`: 시스템 관리자
- [x] 보호된 라우트
  - [x] `/dashboard`: 인증된 사용자
  - [x] `/admin`: admin 이상
  - [x] `/ops`: sys_admin만
- [x] 프로필 테이블 및 RLS 정책
- [x] 미들웨어 기반 세션 검증
- [x] 마이페이지 (프로필 수정, 비밀번호 변경)

### Phase 3: 자동매매 설정 UI ✅ (90%)

**완료 시점**: 2024년 10월 하순

- [x] **조건 편집 시스템**
  - [x] 조건 그룹 관리 (AND/OR 연산)
  - [x] 개별 조건 설정 (지표, 비교 연산자, 임계값)
  - [x] 조건 트리 구조 (진입/청산/분할매수)
  - [x] 시각적 조건 미리보기
  - [x] 조건 평가 디버그 도구 (ConditionsTrace)
  - [x] 한글 조건 요약 표시
- [x] **심볼 선택 시스템**
  - [x] 심볼 검색 및 선택 UI
  - [x] 화이트리스트 모드
  - [x] 제외 규칙 (패턴 기반)
  - [x] 심볼 유효성 검사
- [x] **매수금액 설정**
  - [x] 고정 금액 / 비율 선택
  - [x] 레버리지 설정
  - [x] 실제 잔고 조회 연동
  - [x] 계산기 UI
- [x] **상태 조건 편집**
  - [x] 포지션 상태별 조건 (진입, 보유, 청산)
  - [x] Long/Short 별도 설정
- [x] **진입/청산/분할매수 조건**
  - [x] Long/Short 진입 조건
  - [x] 분할 매수 (Scale-In) 조건
  - [x] 청산 (Exit) 조건
  - [x] 헤지 활성화 조건
  - [x] 스톱로스 라인 설정
- [x] **도움말 시스템**
  - [x] 인라인 도움말 툴팁
  - [x] 단계별 가이드 위저드
  - [x] 도움말 센터 페이지 (`/help`)
- [x] **설정 영속화**
  - [x] Zustand persist 기반 localStorage 저장
  - [x] 마이그레이션 시스템 (버전 관리)
  - [x] 설정 초기화 기능

### Phase 3.5: 거래 인프라 ✅ (100%)

**완료 시점**: 2024년 10월

- [x] CCXT 라이브러리 연동
- [x] Binance Futures API 클라이언트
- [x] API Routes
  - [x] `/api/binance/klines` - 캔들 데이터
  - [x] `/api/binance/ticker` - 티커 정보
  - [x] `/api/trading/binance/futures-symbols` - 심볼 목록
  - [x] `/api/trading/binance/account` - 계좌 조회
  - [x] `/api/trading/binance/place-order` - 주문 실행
  - [x] `/api/trading/binance/position-mode` - 포지션 모드
  - [x] `/api/markets` - 마켓 데이터 캐싱
  - [x] `/api/markets/validate` - 심볼 유효성 검사
- [x] 마진 계산 로직
- [x] 주문 계획 엔진 (orderPlanner)
- [x] 실시간 WebSocket 가격 스트림
- [x] 재연결 및 오류 처리
- [x] 거래 실행 엔진 완성

### Phase 4: 실시간 거래 실행 엔진 ✅ (100%)

**완료 시점**: 2024년 10월 25일

- [x] **거래 실행 엔진 (ExecutionEngine)**
  - [x] 조건 평가 시스템 (conditions.ts)
  - [x] 지표 시그널 계산 (indicatorSignals.ts)
  - [x] 실시간 조건 모니터링 (1초 간격 평가)
  - [x] 자동 주문 생성 및 실행
  - [x] 포지션 추적 및 업데이트 (PositionTracker)
  - [x] 에러 핸들링 및 데이터 검증
  - [x] 전략 정규화 (normalizeStrategy)
- [x] **주문 실행 (OrderExecutor)**
  - [x] 진입 주문 실행 (executeEntry)
  - [x] 청산 주문 실행 (executeExit)
  - [x] 주문 수량 자동 계산
  - [x] 레버리지 설정
  - [x] 포지션 조회 (getAllPositions)
- [x] **WebSocket 실시간 데이터**
  - [x] 기본 WebSocket 연결 (realtime.ts)
  - [x] 재연결 로직
  - [x] 다중 심볼 구독
  - [x] 데이터 버퍼링 및 최적화
- [x] **포지션 추적 (PositionTracker)**
  - [x] 포지션 상태 관리 (opened/closed)
  - [x] 실시간 손익 계산
  - [x] 데이터베이스 저장 (positions 테이블)
  - [x] 수수료 추적 및 계산

### Phase 5: 모니터링 UI 개선 ✅ (100%)

**완료 시점**: 2024년 10월 25일

- [x] **실시간 포지션 현황 UI**
  - [x] 포지션 목록 테이블 (OpenPositionsPanel)
  - [x] 진입가, 현재가, 손익률 표시
  - [x] 레버리지 및 마진 정보
  - [x] 3초마다 자동 새로고침
- [x] **수익률 차트 및 성과 지표**
  - [x] PnL 시계열 차트 (PnLChartPanel)
  - [x] lightweight-charts 기반 시각화
  - [x] 기간 선택 (1h, 24h, 7d, 30d)
  - [x] 승률, 평균 수익/손실, Profit Factor 표시
  - [x] 10초마다 자동 업데이트
- [x] **전략별 통계 대시보드**
  - [x] 전략별 성과 분석 (StrategyPerformancePanel)
  - [x] Sharpe Ratio 계산 (연환산)
  - [x] Max Drawdown 계산
  - [x] Risk/Reward 비율
  - [x] 기대값 계산
  - [x] 30초마다 자동 업데이트
- [x] **실시간 로그 스트림**
  - [x] 활동 로그 패널 (ActivityLogPanel)
  - [x] 타임스탬프 및 로그 레벨 표시
  - [x] 실시간 업데이트 (5초 간격)
- [x] **데이터 검증 및 에러 처리**
  - [x] settings.symbols 배열 검증
  - [x] JSON 파싱 에러 수정 (response.ok 먼저 체크)
  - [x] 안전한 폴백 처리

---

## 📅 향후 계획 (Phase 6~8)

### Phase 6: 백테스팅 및 분석 (2024년 11월 ~ 12월)

- [ ] **백테스팅 엔진**
  - [ ] 과거 데이터 기반 시뮬레이션
  - [ ] 전략 성과 지표 계산
  - [ ] 드로다운 분석
  - [ ] 샤프 비율 계산 (백테스트용)
- [ ] **Python 분석 파이프라인**
  - [ ] pandas 기반 데이터 분석
  - [ ] 커스텀 지표 개발
  - [ ] matplotlib/plotly 시각화
  - [ ] Next.js API와 연동
- [ ] **성과 리포트**
  - [ ] 일별/주별/월별 리포트
  - [ ] 종목별 수익률 분석
  - [ ] 거래 내역 상세
  - [ ] 세금 계산 지원

### Phase 7: 데이터 영속화 확장 (2025년 1월)

- [ ] **추가 API 엔드포인트**
  - [ ] 지표 설정 저장 (`/api/preferences/chart`)
  - [ ] 거래 내역 조회 (`/api/trading/history`)
  - [ ] 알림 관리 (`/api/notifications`)
- [ ] **Supabase 스키마 확장**
  - [ ] `chart_settings` 테이블
  - [ ] `notifications` 테이블
  - [ ] `performance_snapshots` 테이블 (일별 성과 스냅샷)
- [ ] **동기화 로직**
  - [ ] localStorage ↔ Supabase 양방향 동기화
  - [ ] 충돌 해결 전략
  - [ ] 오프라인 지원

### Phase 8: 고급 기능 (2025년 2월 ~ 3월)

- [ ] **알림 시스템**
  - [ ] 조건 기반 알림 트리거
  - [ ] 브라우저 푸시 알림
  - [ ] 이메일/SMS 알림 (선택)
  - [ ] 알림 히스토리
- [ ] **수동 거래 패널**
  - [ ] 주문 폼 (시장가/지정가)
  - [ ] 스톱로스/테이크프로핏 설정
  - [ ] 포지션 크기 계산기
  - [ ] 원클릭 주문
- [ ] **투자 결과 시각화**
  - [ ] 수익률 추이 차트
  - [ ] 누적 손익 그래프
  - [ ] 승률 분석
  - [ ] 최대 드로다운
- [ ] **관리자 기능**
  - [ ] 사용자 관리 (`/admin/users`)
  - [ ] 감사 로그 (`/admin/audit`)
  - [ ] 시스템 모니터링
  - [ ] 권한 부여 관리 (`/ops`)

---

## 🎯 핵심 목표 및 우선순위

### 단기 목표 (2024년 11월 ~ 12월)

1. **백테스팅 엔진 개발** (최우선)
   - 과거 데이터 기반 전략 시뮬레이션
   - 성과 지표 계산 (Sharpe, Drawdown 등)
   - 백테스트 결과 시각화

2. **Python 분석 파이프라인**
   - pandas 기반 데이터 분석
   - 커스텀 지표 개발
   - Next.js와 연동

3. **성과 리포트 시스템**
   - 일별/주별/월별 리포트
   - 종목별 수익률 분석
   - 거래 내역 상세 조회

### 중기 목표 (2025년 1분기)

1. **데이터 영속화 확장**
   - 지표 설정 서버 저장
   - 성과 스냅샷 저장
   - Supabase 스키마 확장

2. **알림 시스템**
   - 조건 기반 알림
   - 브라우저 푸시 알림
   - 이메일/SMS 알림 (선택)

3. **수동 거래 패널**
   - 주문 UI 완성
   - 포지션 크기 계산기
   - 원클릭 주문

### 장기 목표 (2025년 2분기 이후)

1. **모바일 앱** (React Native)
2. **PWA** 지원
3. **소셜 기능** (트레이더 커뮤니티)
4. **다중 거래소 지원** (CCXT 활용)

---

## 🔧 기술 부채 및 개선 사항

### 우선순위 높음

- [ ] WebSocket 재연결 로직 개선
- [ ] API 에러 핸들링 표준화
- [ ] TypeScript 타입 안정성 강화
- [ ] 테스트 커버리지 증가 (현재 제한적)

### 우선순위 중간

- [ ] 컴포넌트 최적화 (React.memo, useMemo)
- [ ] 번들 크기 최적화
- [ ] 접근성 개선 (ARIA 레이블)
- [ ] 다국어 지원 준비 (i18n)

### 우선순위 낮음

- [ ] Storybook 커버리지 확대
- [ ] E2E 테스트 (Playwright/Cypress)
- [ ] 성능 모니터링 도구 도입
- [ ] 문서 자동화 (JSDoc → API 문서)

---

## 📊 성능 요구사항

| 항목 | 목표 | 현재 상태 |
|------|------|-----------|
| 실시간 데이터 업데이트 | 1초 이내 | ⚠️ 개선 필요 |
| 차트 렌더링 | 60fps | ✅ 달성 |
| 페이지 로딩 | 3초 이내 | ✅ 달성 |
| 동시 사용자 | 100명 이상 | 🚧 미검증 |

---

## 🔒 보안 체크리스트

- [x] API 키 서버 사이드 저장
- [x] HTTPS 통신
- [x] SQL Injection 방지 (Supabase ORM)
- [x] XSS 방지 (React 기본 제공)
- [x] 세션 관리 (Supabase Auth)
- [x] 환경 변수 `.env.local` 관리
- [ ] API 키 암호화 (DB 저장 시)
- [ ] Rate Limiting
- [ ] CSRF 토큰

---

## 📝 개발 프로세스

### Git 브랜치 전략

- `main`: 프로덕션 배포
- `develop`: 개발 통합
- `feature/*`: 기능 개발
- `bugfix/*`: 버그 수정

### 커밋 컨벤션

```
feat: 새로운 기능
fix: 버그 수정
refactor: 리팩토링
docs: 문서 수정
test: 테스트 추가/수정
chore: 기타 작업
```

### 코드 리뷰

- PR 생성 시 자동 타입 체크 및 린트 실행
- 최소 1명 이상 리뷰 필요 (향후)

---

## 🚀 배포 전략

### 개발 환경
- Vercel Preview Deployment (PR별)
- 로컬 개발: `npm run dev`

### 스테이징
- Vercel Staging 환경
- Supabase Staging 프로젝트

### 프로덕션
- Vercel Production
- Supabase Production 프로젝트
- 환경 변수 암호화 관리

---

## 📚 참고 문서

- [개발 가이드](./DEVELOPMENT_GUIDE.md) - 개발 가이드라인 및 컨벤션
- [CLAUDE.md](../CLAUDE.md) - Claude Code를 위한 프로젝트 가이드
- [패키지 문서](../package.json) - 사용 가능한 npm 스크립트

---

*이 문서는 프로젝트 진행 상황에 따라 지속적으로 업데이트됩니다.*
