# CCXT 기능 총정리 (공식 문서 기반) — 가능한 모든 기능, 메서드 목록, 설명, 예시
_최종 업데이트: 2025‑10‑26_  
참고 문서: CCXT 공식 매뉴얼/위키/패키지 문서(각주 참조)

---

## 0) CCXT 한눈에 보기
- **CCXT**는 다수의 거래소 REST API를 **통합(unified) 인터페이스**로 제공하는 라이브러리입니다. 모든 거래소 클래스는 `Exchange` 베이스 클래스를 상속하며, **공통(통합) 메서드**와 **거래소별(암시적/implicit) 메서드**를 함께 제공합니다. 웹소켓은 **CCXT Pro(유료 애드온)**가 담당합니다. 〔근거: 매뉴얼 개요〕¹  
- 문서 전반에서 **통합 메서드**는 모든(혹은 다수) 거래소에 공통으로 제공되는 것을 뜻하고, **암시적 메서드**는 해당 거래소의 원래 REST 엔드포인트(예: `publicGet...`, `privatePost...`)를 자동 생성한 래퍼를 뜻합니다. 〔근거: Unified/Implicit API 설명〕¹

> **지원 언어**: JavaScript/TypeScript, Python, PHP.  
> **프로**: 실시간 스트리밍/웹소켓은 `ccxt.pro`에서 `watch*` 계열 메서드로 제공. 〔근거: CCXT Pro 문서〕²³

---

## 1) 기본 구조와 공통 속성
- **Exchange 인스턴스 구성요소(발췌)**  
  - `id`, `name`, `countries`, `version`, `urls`, `timeframes`, `markets`, `currencies`  
  - **레이트리밋**: `rateLimit`, `enableRateLimit`(기본 off → on 권장), `timeout` 등 〔근거: 매뉴얼/중국어 문서 요약〕⁴⁵  
  - **기능 지원 여부**: `exchange.has` 딕셔너리(예: `'fetchTickers'`, `'fetchOHLCV'` 등: `true|false|'emulated'|undefined`) 〔근거: has/설명 블록〕¹  
  - **샌드박스**: `setSandboxMode(true)` / `set_sandbox_mode(True)`—인스턴스 생성 직후 첫 호출 필요 〔근거: 샌드박스 섹션〕⁶

- **암시적(implicit) 메서드**  
  - 거래소 스키마의 `api` 정의를 바탕으로 **자동 생성**: `publicGet...`, `privatePost...`, `privatePut...`, `privateDelete...` 등. 통합 메서드로 안 되는 기능은 **암시적 메서드로 직접 호출** 〔근거: Implicit API Methods〕¹

---

## 2) 통합(Unified) 공통 메서드 — 카테고리별
> 실제 제공 여부는 `exchange.has`로 확인하세요. 파라미터는 `params`(거래소별 오버라이드)로 확장합니다. 〔근거: Unified API 목록·파라미터 규칙〕¹

### A. 마켓 메타데이터 / 상태
- `loadMarkets([reload])`, `fetchMarkets()`, `fetchCurrencies()`, `fetchStatus(params)` …  
  - **설명**: 거래가능 심볼/정밀도/최소주문/수수료·상태 등 메타데이터 조회 및 로컬 캐시. 〔근거〕¹

### B. 호가/체결/시세(REST)
- `fetchOrderBook(symbol, limit, params)` / `fetchL2OrderBook(...)`  
- `fetchTrades(symbol, since, limit, params)`  
- `fetchTicker(symbol)`, `fetchTickers(symbols?)`  
- `fetchOHLCV(symbol, timeframe, since, limit, params)`  
  - **설명**: 표준 시세/호가/체결/캔들. 페이징은 `since/limit`(또는 자동 페이지네이션) 사용. 〔근거: Unified·Pagination〕¹

### C. 계정/포트폴리오(프라이빗)
- `fetchBalance(params)` — 지갑/마진/파생 계정별 잔고  
- **입출금/이체**: `fetchDeposits()`, `fetchWithdrawals()`, `fetchDepositAddress()`, `transfer()` …  
  - **설명**: 거래소 제공 범위에 따라 가용. 일부는 `implicit` 필요. 〔근거: Public/Private API 설명〕¹

### D. 주문/거래
- 생성: `createOrder(symbol, type, side, amount, price?, params)`, `createOrders(orders, params)`  
- 조회: `fetchOrder(id, symbol?, params)`, `fetchOrders(...)`, `fetchOpenOrders(...)`, `fetchClosedOrders(...)`  
- 취소: `cancelOrder(id, symbol?, params)`  
- 체결내역: `fetchMyTrades(symbol?, since?, limit?, params)`  
  - **설명**: 주문 타입은 `limit/market/stop/stopLimit/stopMarket/takeProfit/trigger` 등 거래소별 지원. 트리거 파라미터(예: `stopPrice`, `reduceOnly`, `timeInForce`, `postOnly`, `clientOrderId`)는 `params`로 전달. 〔근거: Unified·params 규칙〕¹

### E. 파생상품/마진/레버리지·포지션
- 자주 쓰는 통합/교차 기능(거래소별 지원 상이):  
  - 레버리지/모드: `setLeverage(leverage, symbol, params)`, `setMarginMode(marginMode, symbol, params)`, `setPositionMode(hedged, symbol?, params)`  
  - 포지션: `fetchPositions(symbols?, params)`  
  - 펀딩: `fetchFundingRate(symbol, params)`, `fetchFundingRates(symbols, params)`, `fetchFundingRateHistory(symbol, since, limit, params)`  
  - 금리/차입: `fetchCrossBorrowRate`, `fetchIsolatedBorrowRate`, `borrowMargin`, `repayMargin`, `fetchBorrowInterest` …  
  - 파생 통계: `fetchOpenInterest`, `fetchSettlementHistory`, `fetchLiquidations`, `fetchGreeks`, `fetchOption`, `fetchOptionChain` …  
  - **설명**: 거래소·상품군(선물/스왑/옵션)에 따라 `has`가 다릅니다. 〔근거: Unified 목록 확장〕¹

### F. 자동 페이지네이션(실험적)
- `params = { paginate: true, paginationCalls: 10, maxRetries: 3, paginationDirection: 'backward|forward' }`  
  - **OHLCV/펀딩/오픈인터레스트는 병렬(결정적) 페이징**, 트레이드/오더는 시간기반 페이징. 〔근거: Automatic Pagination〕¹

---

## 3) CCXT Pro (웹소켓) 주요 메서드
> `ccxt.pro`에서 제공. 비동기/await 기반. 〔근거: CCXT Pro Manual〕²³⁷

- **마켓 데이터(퍼블릭)**  
  - `watchOrderBook`, `watchTicker(s)`, `watchTrades`, `watchOHLCV`, `watchBidsAsks`, `watchLiquidations` …  
- **프라이빗**(거래/계정 채널은 거래소별): `watchPositions`, `watchOrders`, `watchMyTrades`, `watchBalance` 등(지원 시).  
- **연결/재연결/백오프**: CCXT Pro가 **자동 레이트리밋/지수 백오프/keepalive** 처리. 〔근거〕³⁷

---

## 4) 실전 설정 포인트
- **레이트리밋**: `enableRateLimit: true`, `rateLimit(ms)`, `timeout(ms)` 설정 권장. 〔근거〕⁵  
- **샌드박스/테스트넷**: `setSandboxMode(true)`(생성 직후 호출), 테스트 키 사용. 〔근거〕⁶  
- **파라미터 오버라이드**: 모든 통합 메서드는 마지막 인자 `params`로 거래소별 필드를 전달. 〔근거〕¹  
- **브라우저/프록시**: 브라우저에서 CORS 회피 시 프록시 사용(`proxyUrl` 등). 〔근거〕⁶  
- **설치/업데이트**: npm/pip/Composer로 설치·업데이트. 〔근거〕⁹

---

## 5) 예시 코드

### 5.1 Python — 시세/주문/포지션
```python
import ccxt
ex = ccxt.binanceusdm({'enableRateLimit': True, 'timeout': 15000})
ex.set_sandbox_mode(True)  # 샌드박스(지원 거래소만)
markets = ex.load_markets()

# 시세/호가/체결
ob = ex.fetch_order_book('BTC/USDT', limit=50)
ticker = ex.fetch_ticker('BTC/USDT')
trades = ex.fetch_trades('BTC/USDT', limit=50)

# 캔들 (1m, 과거부터 페이징)
ohlcv = ex.fetch_ohlcv('BTC/USDT', timeframe='1m', limit=1000)

# 잔고
balance = ex.fetch_balance()

# 신규주문 (예: 선물 Reduce-Only, clientOrderId 지정)
order = ex.create_order(
    'BTC/USDT', 'limit', 'buy', 0.001, 50000,
    {'reduceOnly': False, 'timeInForce': 'GTC', 'clientOrderId': 'my-123'}
)

# 주문 조회/취소
open_orders = ex.fetch_open_orders('BTC/USDT')
ex.cancel_order(order['id'], 'BTC/USDT')

# 파생: 레버리지/포지션/펀딩
ex.set_leverage(10, 'BTC/USDT')
positions = ex.fetch_positions(['BTC/USDT'])
fr = ex.fetch_funding_rate('BTC/USDT')
```

### 5.2 Node.js — 페이징과 파라미터 오버라이드
```js
import ccxt from 'ccxt';
const ex = new ccxt.okx({ enableRateLimit: true });

await ex.loadMarkets();
const since = ex.milliseconds() - 24 * 60 * 60 * 1000; // 24h

// 자동 페이지네이션(실험적): OHLCV는 결정적 병렬 페이징
const candles = await ex.fetchOHLCV('BTC/USDT', '5m', since, 200, {
  paginate: true, paginationCalls: 5
});

// 거래소별 파라미터: isIsolated=true 예시
const o = await ex.createOrder('BTC/USDT', 'market', 'sell', 0.01, undefined, {
  isIsolated: true
});
```

### 5.3 CCXT Pro (Python, 비동기 웹소켓)
```python
import ccxt.pro as ccxtpro
import asyncio

async def main():
    ex = ccxtpro.binanceusdm({'newUpdates': False})
    await ex.load_markets()
    while True:
        ob = await ex.watch_order_book('BTC/USDT')
        best_ask = ob['asks'][0]; best_bid = ob['bids'][0]
        print('A1/B1:', best_ask, best_bid)

asyncio.run(main())
```

---

## 6) 자주 쓰는 고급 주제
- **정밀도/제한**: `markets[symbol]['precision']`, `['limits']['amount'/'price'/'cost']`  
- **수수료**: `fetchTradingFees()`(개인/공개), 심볼별 maker/taker  
- **원본 응답**: 통합 객체의 `info` 필드(가능 시)로 원본 JSON 참조 〔참고 Q/A〕¹⁰  
- **심볼·타임프레임 표준화**: `XBT→BTC`, `USD→USDT` 등 CCXT의 통일 규칙 적용 〔근거〕¹  
- **CLI 활용**: 코드 없이도 메서드 호출 가능(Examples/CLI) 〔근거: CLI 문서〕¹¹

---

## 7) 체크리스트
- [ ] `enableRateLimit=true`, `timeout` 설정  
- [ ] `loadMarkets()` 캐시 후 심볼/정밀도/제한 확인  
- [ ] 파생 거래 시 `setLeverage`, `setMarginMode`, `setPositionMode` 지원 여부(`has`) 확인  
- [ ] 주문 타입·트리거·TP/SL 파라미터는 `params`로 전달(거래소별 상이)  
- [ ] 대량 히스토리 = 페이징 필수 (`since/limit` or `paginate`)  
- [ ] 테스트는 `setSandboxMode(true)` + 샌드박스 키

---

## 8) 참조(공식·권위 문서)
1. **CCXT Manual (GitHub Wiki)** — 개요/Unified & Implicit API/메서드 목록/페이징/파라미터 규칙/레이트리밋 안내. https://github.com/ccxt/ccxt/wiki/manual  
2. **CCXT Pro 개요 페이지** — WebSocket 지원, 구조, Unified watch* 목록. https://github.com/ccxt/ccxt/wiki/ccxt.pro  
3. **CCXT Pro Manual** — 인스턴스 생성, 비동기, 자동 백오프/재연결. https://github.com/ccxt/ccxt/wiki/ccxt.pro.manual  
4. **설치/속성 요약**(설치, 언어, rateLimit 등): CCXT Wiki Install/Exchange Structure. https://github.com/ccxt/ccxt/wiki/Install  
5. **레이트리밋 세부(중문 문서 미러)** — `enableRateLimit`, `timeout` 설명. https://ccxtcn.readthedocs.io/zh_CN/latest/manual.html  
6. **Sandbox 모드** — `setSandboxMode(true)` 사용법과 주의점. https://github.com/ccxt/ccxt/wiki/manual (sandbox section)  
7. **Streaming Specifics/자동 백오프** — CCXT Pro 연결/재연결/레이트리밋. https://github.com/ccxt/ccxt/wiki/ccxt.pro.manual  
8. **통합 메서드 – 파생/펀딩/옵션/오픈인터레스트 등 확장 목록** — Manual의 Unified API 섹션. (동일 문서 내)  
9. **패키지 페이지** — PyPI/NPM의 CCXT 설명(공개/프라이빗 API 범위). https://pypi.org/project/ccxt/ , https://www.npmjs.com/package/ccxt/  
10. **원본 응답(info 필드) 관련 Q/A** — 통합 객체의 `info` 참조. https://stackoverflow.com/questions/67660643/  
11. **CLI** — 커맨드라인에서 CCXT 호출. https://github.com/ccxt/ccxt/wiki/CLI

> **주의**: 모든 메서드가 모든 거래소에 있는 것은 아닙니다. 각 거래소 인스턴스의 `exchange.has`를 확인하거나, 필요한 경우 **암시적 메서드**로 해당 거래소의 원 엔드포인트를 직접 호출하세요.
