# 자동매매 실행 엔진 통합 테스트 가이드

## 개요

이 문서는 Phase 4에서 구현한 자동매매 실행 엔진의 통합 테스트 방법을 안내합니다.

## 사전 준비

### 1. 데이터베이스 마이그레이션

```bash
# Supabase Dashboard에서 SQL Editor 실행
# 1. engine_state 테이블 생성
supabase/migrations/20250125_create_engine_state_table.sql

# 2. positions 테이블 업데이트
supabase/migrations/20250125_update_positions_table.sql
```

#### SQL 실행 (Supabase Dashboard)

```sql
-- 1. Engine State Table
CREATE TABLE IF NOT EXISTS engine_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  is_running BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  stopped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO engine_state (id, is_running)
VALUES ('singleton', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Update Positions Table
ALTER TABLE positions
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS entry_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS entry_order_id TEXT,
  ADD COLUMN IF NOT EXISTS exit_price NUMERIC,
  ADD COLUMN IF NOT EXISTS exit_time TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS exit_order_id TEXT;

UPDATE positions SET direction = LOWER(side) WHERE direction IS NULL;
UPDATE positions SET entry_time = opened_at WHERE entry_time IS NULL;

ALTER TABLE positions
  ADD CONSTRAINT positions_direction_valid CHECK (direction IN ('long', 'short'));

ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_user_symbol_unique;

CREATE UNIQUE INDEX IF NOT EXISTS positions_user_symbol_direction_open_unique
  ON positions(user_id, symbol, direction)
  WHERE status = 'OPEN';
```

### 2. Binance API Credentials

```bash
# .env.local에 테스트용 API key 설정
# ⚠️ 반드시 TESTNET 사용 권장!

NEXT_PUBLIC_BINANCE_API_KEY=your_testnet_api_key
NEXT_PUBLIC_BINANCE_API_SECRET=your_testnet_api_secret
```

Credentials를 DB에 저장:
1. `/profile` 페이지 접속
2. Binance API Key/Secret 입력 및 저장

## 테스트 시나리오

### Scenario 1: 전략 생성 및 활성화

**목적**: 진입/청산 조건이 있는 전략을 생성하고 활성화

**Steps**:
1. `/trading/automation` 페이지 접속
2. 새 로직 생성:
   - **심볼**: BTCUSDT 선택
   - **타임프레임**: 5m
   - **레버리지**: 10x
   - **초기 마진**: 100 USDT

3. **진입 조건** 설정:
   - 지표 추가: RSI(14)
   - 조건: RSI < 30 (과매도)

4. **청산 조건** 설정:
   - 지표 추가: RSI(14)
   - 조건: RSI > 70 (과매수)
   OR
   - 상태 조건: 수익률 > 5%

5. "전략으로 저장" 클릭
   - 전략명 입력: "RSI Scalping Test"
   - "활성화" 체크
   - 저장

**예상 결과**:
- ✅ 전략이 DB에 저장됨
- ✅ `is_active=true`로 설정됨

### Scenario 2: 엔진 시작 및 마켓 데이터 스트림

**목적**: 엔진을 시작하고 실시간 가격 데이터 수신 확인

**Steps**:
1. `/trading/monitoring` 페이지 접속
2. "엔진 시작" 버튼 클릭
3. 브라우저 개발자 도구 Console 확인

**예상 결과** (Console Logs):
```
🚀 ExecutionEngine starting...
📋 Loaded 1 active strategies
✅ Credentials loaded
📊 Loaded 0 open positions
📡 Starting market data streams for 1 symbol/interval pairs...
✅ Binance WebSocket connected
📥 Loading initial klines for BTCUSDT 5m...
✅ Loaded 500 klines for BTCUSDT 5m
✅ Market data streams started
✅ ExecutionEngine started (Note: will stop after request ends in serverless)
```

**확인 사항**:
- ✅ WebSocket 연결 성공
- ✅ 초기 500개 캔들 로드
- ✅ `engine_state.is_running = true` (DB 확인)

### Scenario 3: 조건 평가 및 시그널 감지

**목적**: 실시간으로 조건을 평가하고 진입/청산 시그널 감지

**Steps**:
1. 엔진이 실행 중인 상태에서 Console 모니터링
2. 5초마다 평가 로그 확인

**예상 결과** (Console Logs - 평가 루프):
```
📊 Evaluating strategy: RSI Scalping Test

  Symbol: BTCUSDT (5m)
    Current Price: 65432.50
    Position: NO
    Entry Signal: ❌ FALSE

    📝 [ENTRY] Evaluation Details:
      Symbol: BTCUSDT
      Signal: ❌ FALSE
      Indicators:
        rsi_node_abc123: 45.2314

✓ Evaluated strategy xxx (count: 1)
```

**진입 시그널 발생 시**:
```
📊 Evaluating strategy: RSI Scalping Test

  Symbol: BTCUSDT (5m)
    Current Price: 65100.00
    Position: NO
    Entry Signal: ✅ TRUE
    🎯 ENTRY SIGNAL DETECTED for BTCUSDT!

💼 Executing ENTRY order for BTCUSDT (long)
  Available USDT balance: 1000.00
  Initial margin: 100.00 USDT
  Leverage: 10x, Notional: 1000.00 USDT
  Final quantity: 0.015 BTC
  ✅ Leverage set to 10x for BTCUSDT
  📤 Placing order: {symbol: BTCUSDT, side: BUY, type: MARKET, quantity: 0.015}
  ✅ Order placed: {orderId: 12345, avgPrice: 65100.00}
✅ Entry order successful
✅ Position tracked: BTCUSDT_long
✅ Trade recorded: ENTRY_LONG BTCUSDT
```

**확인 사항**:
- ✅ RSI 값 계산 정확
- ✅ 조건 평가 로직 동작
- ✅ 진입 시그널 감지
- ✅ 주문 실행 (Testnet)
- ✅ DB에 포지션 저장

### Scenario 4: 포지션 청산

**목적**: 청산 조건 충족 시 포지션 자동 청산

**Steps**:
1. 포지션이 오픈된 상태에서 대기
2. RSI > 70 또는 수익률 > 5% 조건 충족 대기

**예상 결과** (Console Logs):
```
📊 Evaluating strategy: RSI Scalping Test

  Symbol: BTCUSDT (5m)
    Current Price: 68700.00
    Position: YES
    Exit Signal: ✅ TRUE
    🎯 EXIT SIGNAL DETECTED for BTCUSDT!

💼 Executing EXIT order for BTCUSDT (long)
  📤 Placing order: {symbol: BTCUSDT, side: SELL, type: MARKET, quantity: 0.015, reduceOnly: true}
  ✅ Order placed: {orderId: 12346, avgPrice: 68700.00}
✅ Exit order successful
✅ Position exit tracked in DB: xxx PnL: 54.00 USDT
✅ Trade recorded: EXIT BTCUSDT
✅ Position closed: BTCUSDT_long
```

**DB 확인**:
```sql
SELECT * FROM positions WHERE id = 'xxx';
-- status: CLOSED
-- exit_price: 68700.00
-- realized_pnl: 54.00

SELECT * FROM trading_logs WHERE symbol = 'BTCUSDT' ORDER BY created_at DESC LIMIT 2;
-- 2개 레코드: ENTRY_LONG, EXIT
```

### Scenario 5: 엔진 중지 및 상태 확인

**목적**: 엔진을 안전하게 중지하고 상태 복원 확인

**Steps**:
1. "엔진 중지" 버튼 클릭
2. 페이지 새로고침
3. 엔진 상태 확인

**예상 결과**:
```
🛑 ExecutionEngine stopping...
⏸️ Stopped all market data streams
✅ ExecutionEngine stopped
```

**DB 확인**:
```sql
SELECT * FROM engine_state WHERE id = 'singleton';
-- is_running: false
-- stopped_at: 2025-10-25 13:45:00
```

**확인 사항**:
- ✅ WebSocket 연결 종료
- ✅ 엔진 상태 DB에 저장
- ✅ 새로고침 후에도 "중지됨" 상태 유지

## 에러 시나리오

### Error 1: Credentials 없음

**상황**: API credentials 없이 엔진 시작

**예상 로그**:
```
⚠️ No credentials found - orders will not be executed
✅ ExecutionEngine started

📊 Evaluating strategy...
  Entry Signal: ✅ TRUE
  🎯 ENTRY SIGNAL DETECTED for BTCUSDT!
  ⚠️ No credentials - skipping order execution
```

**해결**:
- `/profile`에서 API credentials 등록

### Error 2: 잔고 부족

**상황**: 초기 마진보다 잔고 적음

**예상 로그**:
```
💼 Executing ENTRY order...
  Available USDT balance: 50.00
  Initial margin: 100.00 USDT
  ⚠️ Quantity 0 is below minimum 0.001
❌ Entry order failed: 주문 수량 계산 실패
```

**해결**:
- 전략의 초기 마진 금액 줄이기
- 또는 계좌 잔고 충전

### Error 3: 심볼 정보 조회 실패

**상황**: 잘못된 심볼 또는 네트워크 오류

**예상 로그**:
```
Failed to calculate order quantity: Symbol XXXUSDT not found in exchange info
❌ Entry order failed: 주문 수량 계산 실패
```

**해결**:
- 전략 심볼을 유효한 Futures 심볼로 변경

## 성능 지표

### 정상 동작 기준

| 지표 | 목표 | 측정 방법 |
|------|------|-----------|
| 평가 주기 | 5초 | Console 로그 간격 |
| 지표 계산 시간 | < 100ms | 로그의 timestamp |
| 주문 실행 시간 | < 2초 | Entry/Exit 로그 |
| DB 저장 시간 | < 500ms | Position tracked 로그 |
| WebSocket 지연 | < 1초 | 실시간 가격 vs Exchange |

### 모니터링 체크리스트

- [ ] WebSocket 연결 안정성 (재연결 발생 시 로그 확인)
- [ ] 메모리 사용량 (장시간 실행 시 누수 확인)
- [ ] 평가 루프 안정성 (Circuit breaker 미발동)
- [ ] DB 쿼리 성능 (N+1 문제 없음)
- [ ] 주문 실행 성공률 > 95%

## 주의사항

### ⚠️ Serverless 제약

현재 Vercel 배포 환경에서는 `setInterval`이 request 종료 후 중단됩니다.

**해결 방안**:
1. **Production 배포**:
   - Railway, Render 등 장기 실행 가능한 Node.js 서버
   - PM2로 프로세스 관리

2. **Alternative**: Scheduled Jobs
   - Vercel Cron (1분 간격 제한)
   - AWS Lambda + EventBridge
   - 1분마다 조건 평가 실행

3. **Development**: Browser에서 테스트
   - 모니터링 페이지를 열어둔 상태에서 테스트
   - 페이지 닫으면 엔진 중지됨

### 🔒 보안

- **절대 Production API Key 사용 금지**
- Testnet API Key로만 테스트
- `.env.local`을 git에 커밋하지 않기
- 민감한 로그 제거 (API secret 등)

### 💰 리스크 관리

- **초기 마진 소액으로 시작** (10-50 USDT)
- **레버리지 낮게 설정** (5x 이하 권장)
- **Circuit breaker 설정 확인** (연속 5회 실패 시 중지)
- **Stop Loss 조건 반드시 설정**

## 다음 단계

Phase 4 완료 후:
1. **UI 개선**: 실시간 포지션 현황, 수익률 차트
2. **알림 시스템**: Discord/Telegram 봇 연동
3. **백테스팅**: 과거 데이터로 전략 검증
4. **멀티 전략**: 여러 전략 동시 실행
5. **Production 배포**: 장기 실행 서버 구축

## 문제 해결

문제 발생 시:
1. **Console 로그 확인**: 에러 메시지 확인
2. **DB 상태 확인**: Supabase Dashboard에서 테이블 조회
3. **Network 탭**: Binance API 요청/응답 확인
4. **엔진 재시작**: 중지 → 시작으로 상태 리셋

## 참고 자료

- [Binance Futures API Docs](https://binance-docs.github.io/apidocs/futures/en/)
- [ExecutionEngine 소스코드](src/lib/trading/execution/ExecutionEngine.ts)
- [OrderExecutor 소스코드](src/lib/trading/execution/OrderExecutor.ts)
- [PositionTracker 소스코드](src/lib/trading/execution/PositionTracker.ts)
