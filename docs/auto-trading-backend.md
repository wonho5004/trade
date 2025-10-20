# 자동매매 백엔드: API & 개발 가이드

본 문서는 자동매매(선물) 백엔드/엔진의 현재 현황, API 명세, 구성 요소, 안전장치, 배포/테스트, 그리고 최종 단계까지의 상세 로드맵을 제공합니다. 새로운 협업/채팅 세션에서도 이 문서만으로 개발을 이어갈 수 있도록 작성되었습니다.

## 1. 개요(현재 상태)
- UI/엔진 연결
  - 조건 트리(Indicator/Status/Group) + 액션(Action: 매수/매도/스탑로스) 지원
  - 지표값 참조/파생식(expr)으로 지정가/스탑 가격 해석(봉 단위)
  - 수량 산출(정밀도/최소주문 대응) → 주문 계획(Materialize)
- 서버/API
  - GET `/api/trading/binance/futures-symbols` 심볼 메타(가격/수량 소수, 최소 주문, 레버리지 티어)
  - GET `/api/trading/binance/account?symbol=…` 지갑 USDT, 심볼 포지션금액(근사)
  - POST `/api/trading/binance/place-order` 주문 생성(dryRun/실전, 안전장치 포함, positionMode 검증)
- 안전/오류
  - 클라/서버 안전장치(최대 주문수, 1건 최대 금액)
  - 오류 코드/힌트 매핑(FILTER_NOTIONAL, INSUFFICIENT_MARGIN 등)

## 2. 아키텍처
- 프런트 프리뷰
  - `ConditionsPreview` → 시세 구독 → 엔진 평가 → 액션/주문 미리보기/전송
- 엔진(핵심 모듈)
  - `engine/conditions.ts` 실행 계획/평가(trace)
  - `engine/indicatorSignals.ts` 시계열/지표 시그널/숫자 시계열 생성
  - `engine/priceResolver.ts` 가격 해석(expr/id)
  - `engine/actions.ts` 조건 충족 시 액션 의도 생성
  - `engine/orderPlanner.ts` 정밀도/최소 주문 반영하여 주문 계획 산출
- 서버(API, Next.js Route)
  - `/api/trading/binance/*` 계정/심볼/주문
  - `exchange/binanceOrders.ts` PlannedOrder → 바이낸스 포맷 매핑
  - `exchange/errorHints.ts` 오류 코드/힌트 매핑
- 외부 라이브러리: ccxt(binanceusdm)

보강 사항(업데이트됨)
- 서버 positionMode 자동 감지: 계정 모드 조회 후 one_way/hedge 검증 자동화
- 오류 코드 라벨/문서 링크: 결과 코드 클릭 시 `/docs/errors#CODE` 이동
- 교차값 보간 옵션: `expr:cross:...:interp=linear`로 직선 보간 교차 가격 해석

## 3. 표현식(가격 참조) 문법
- 지표ID: `ind-xxxx` 등(조건 트리 내 지표 노드 id)
- 파생식(expr)
  - 교차: `expr:cross:<A>:<B>:dir=up|down|both:when=recent|previous`
  - 최소/최대/평균/비율: `expr:(min|max|avg|ratio):<A>:<B>`
  - 오프셋%: `expr:offset:<A>:pct=<-1000..1000>`
- 해석 규칙: 봉 단위. 교차값은 교차 봉에서 (A+B)/2 근사

## 4. API 명세
- GET `/api/trading/binance/futures-symbols`
  - 응답: `{ markets: [{ symbol, base, quote, minNotional, minQty, pricePrecision, quantityPrecision, leverageBrackets, ... }] }`
- GET `/api/trading/binance/account?symbol=BTCUSDT`
  - 응답: `{ ok, account: { walletUSDT, positionNotionalUSDT, positions: [...] } }`
- POST `/api/trading/binance/place-order`
  - 요청(택1):
    - `{ symbol, orders: PlannedOrder[], dryRun: boolean, safety?: { maxOrders, maxNotional } }`
    - `{ symbol, payloads: BinancePayload[], dryRun: boolean, safety?: {...} }` (개별 재시도/디버깅용)
  - 요청 옵션: `positionMode?: 'one_way' | 'hedge'` (서버에서 `positionSide` 불일치 차단)
  - 응답:
    - `dryRun: true` → `{ ok, dryRun: true, payloads }`
    - `dryRun: false` → `{ ok, dryRun: false, results: [{ ok, request, response?, error?, code?, hint? }] }`
  - 서버 안전장치: 주문수/1건 최대 금액 검사(위반 시 400)
  - 실행 플래그: reduceOnly, workingType(MARK/CONTRACT), positionSide(BOTH/LONG/SHORT)

## 5. 실행/배포
- 환경변수(서버)
  - `BINANCE_FUTURES_API_KEY`, `BINANCE_FUTURES_API_SECRET`, (옵션)`BINANCE_FUTURES_API_PASSWORD`
- 로컬 시연
 - 프리뷰에서 “주문 미리보기 → 모의 전송(로컬)” 진행
 - 실전 전송은 확인 다이얼로그 + 서버 키 필요
  - 계정/포지션 폴링: 프리뷰에서 기본 15초 간격(5/15/30/60 조절 가능)

## 6. 테스트
- 추가됨: `src/lib/trading/__tests__/expr.test.ts`
  - expr 파서/priceResolver 교차/오프셋/비율 등
- 권장 추가
  - `orderPlanner`(정밀도/최소주문/노미널 보정) 단위 테스트
  - `/place-order` 안전장치/에러코드 맵핑 테스트

## 7. 보안/안전
- 비밀키는 서버 환경변수로만 관리. 클라이언트 전송 금지
- 서버/API 입력 검증: 주문수/노미널 상한, 포맷 검사
- 포지션 모드/positionSide 불일치 경고/차단(서버/클라)

## 8. 개발 로드맵(최종 단계까지)
1) 주문 실행 안정화(Now)
   - [ ] `/place-order` 오류코드 상세 노출(클라) 및 툴팁/도움말 연결
   - [ ] `orderPlanner` 테스트 추가, 수량/정밀도 모서리 케이스 보정
   - [ ] positionMode(one_way/hedge) 서버 검증 강제(불일치 시 거부)
2) 계정/포지션 동기화
   - [ ] 포지션/지갑 주기적 갱신(폴링/웹훅 대체) 및 프리뷰 자동 반영
   - [ ] 최초매수금액 추정(체결/주문내역 캐싱)
3) 전략 실행기(백그라운드)
   - [ ] 전략 영속화(DB, ex. Supabase) 및 스케줄러/워크커(전략별 런너)
   - [ ] 실행 로그/알림(체결/오류) + 재시작/중지/상태 대시보드
   - [ ] 리스크 한도(총 노미널/심볼당/시나리오) 정책 레이어
4) 지표/파생 고도화
   - [ ] 교차점 보간(직선 교차 지점) 옵션
   - [ ] 표현식 유효성 검사(미존재 ID/NaN) → 안전 폴백
5) UI/UX 개선
   - [ ] 실행 결과 상세 테이블(오류코드/힌트/재시도 버튼)
   - [ ] positionSide/모드 경고 상시 노출 + 빠른 전환 UX
6) 문서/운영
   - [ ] 운영 리드미(키 설정, 제한/수수료, 포지션 모드 별 주의사항)
   - [ ] 장애 대응 가이드(에러코드별 조치, 재시도 정책)

## 9. 개발 제안사항
- 백그라운드 실행기 도입: Next.js Route 기반 요청형을 보완하기 위해 큐/워크커(예: Supabase Edge/서버리스 Cron/Queue)를 활용해 전략 지속 실행
- 리스크 레이어: 총/개별 노미널 상한, 손절/헤지 자동 재생성 정책 서버 측 강제
- 포지션 모드 일관성: UI 설정/서버 검증/주문 전송까지 단일 레이어에서 검증
- 모의 계정 레이어: 모든 주문을 시뮬레이터로 먼저 흘려보내고 결과/체결을 UI에 반영(실계정 스위치 명확화)

## 10. 파일/모듈 맵(핵심)
- 엔진: `src/lib/trading/engine/{conditions.ts, indicatorSignals.ts, priceResolver.ts, actions.ts, orderPlanner.ts}`
- 서버: `src/app/api/trading/binance/{futures-symbols,account,place-order}/route.ts`
- 매핑/에러: `src/lib/trading/exchange/{binanceOrders.ts, errorHints.ts}`
- 프리뷰: `src/components/trading/automation/{ConditionsPreview.tsx, ConditionsTrace.tsx, GroupEditModal.tsx}`
  - 프리뷰는 서버 포지션 모드 배지/경고를 표시하고, 계정/포지션 폴링(간격 조절/ON·OFF)을 지원합니다.

---
본 문서는 개발/운영 상황에 맞춰 계속 보강됩니다. 신규 세션 시작 시, 본 문서를 기준으로 작업 맥락을 이어가 주세요.

**마지막 응답**

• 진행했습니다. 새 세션에서도 이어가기 쉽게 서버 검증/힌트/테스트/문서 보강을 마무리했습니다.

  추가 구현

  - 서버 positionMode 검증
      - POST /api/trading/binance/place-order 요청에 positionMode(one_way/hedge) 수용
      - one_way에서 positionSide LONG/SHORT 사용 시 차단, hedge에서 BOTH 사용 시 차단
      - 안전장치와 함께 400(상세 invalid 목록) 반환
      - 파일: src/app/api/trading/binance/place-order/route.ts
  - 오류 힌트 맵핑
      - 서버에서 에러코드/힌트(code/hint) 포함해 응답
      - 클라 결과 리스트에 code 표시 + hint는 title 툴팁으로 노출
      - 파일: src/lib/trading/exchange/errorHints.ts, src/app/api/trading/binance/place-order/route.ts, src/components/
        trading/automation/ConditionsPreview.tsx
  - 개별 재시도(모의/실전)
      - 실패한 주문 payload 1건만 /place-order에 재송신(dryRun 또는 실전)
      - 파일: src/components/trading/automation/ConditionsPreview.tsx
  - 포지션 모드 경고(클라)
      - 프리뷰 실행 옵션과 주문 planned 비교해 One-Way/Hedge 불일치 경고 배너
      - 파일: src/components/trading/automation/ConditionsPreview.tsx
  - 테스트 추가
      - orderPlanner: 정밀도/최소주문 보정 케이스
      - 파일: src/lib/trading/tests/orderPlanner.test.ts
  - 문서 보강
      - docs/auto-trading-backend.md: /place-order에 positionMode 검증/옵션 명시 추가

  요약: 지금 상태로 프론트 프리뷰에서

  - 심볼/계정 메타 자동 채움 → 액션→가격(expr)→수량(정밀도/최소주문) → 주문 미리보기
  - 안전장치(최대 주문수/노미널), 포지션 모드 경고
  - 모의/실전 전송 + 실패 상세/개별 재시도
  - 서버는 안전장치 + positionMode 검증 + 에러 힌트 제공

  다음 추천 단계

  - 오류 디테일 UI: 서버 code/hint를 라벨/헬프 링크와 매핑(문서화된 안내 페이지 연결)
  - 서버: positionMode 자동 감지(계정 API로 모드 조회) 및 하향 호환
  - 테스트: place-order safety/에러 맵핑, priceResolver 교차값 보간 옵션

  원하시면 오류코드/힌트 툴팁 링크와 서버 positionMode 자동 감지를 다음으로 진행하겠습니다.
- GET `/api/trading/binance/position-mode`
  - 응답: `{ ok, positionMode: 'one_way'|'hedge', dualSidePosition }` (키 없을 시 ok=false)
