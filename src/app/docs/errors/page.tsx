export const dynamic = 'force-static';

export default function ErrorsDocPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6 text-zinc-200">
      <h1 className="mb-2 text-xl font-semibold">자동매매 오류 안내</h1>
      <p className="mb-4 text-zinc-400">서버/거래소 오류코드에 대한 설명과 조치 가이드입니다. 프리뷰/전송 결과의 코드 라벨을 클릭하면 이 페이지로 이동합니다.</p>

      <section className="mb-4 rounded border border-zinc-800 bg-zinc-950 p-3">
        <h2 className="mb-2 text-lg">예시: 주문 Payload</h2>
        <pre className="overflow-auto rounded border border-zinc-800 bg-zinc-950 p-2 text-sm text-zinc-300"><code>{`{
  "symbol": "BTCUSDT",
  "orders": [
    { "id":"e1", "type":"LIMIT", "side":"BUY", "price": 63000, "quantity": 0.002, "reduceOnly": false, "positionSide":"BOTH" },
    { "id":"s1", "type":"STOP_MARKET", "side":"SELL", "stopPrice": 61000, "reduceOnly": true, "workingType":"MARK_PRICE", "positionSide":"BOTH" }
  ],
  "dryRun": true,
  "safety": { "maxOrders": 10, "maxNotional": 2000 },
  "positionMode": "one_way"
}`}</code></pre>
        <p className="mt-1 text-zinc-400">실전 전송에서는 <code className="rounded bg-zinc-900 px-1">dryRun</code>을 <code className="rounded bg-zinc-900 px-1">false</code>로 설정합니다.</p>
      </section>

      <section className="mb-4 rounded border border-zinc-800 bg-zinc-950 p-3">
        <h2 className="mb-2 text-lg">정밀도/최소노미널 계산</h2>
        <ul className="list-disc pl-5 text-zinc-300">
          <li>가격 반올림: <code className="rounded bg-zinc-900 px-1">pricePrecision</code> 자릿수로 반올림(예: 63000.123 → 63000.12)</li>
          <li>수량 반올림: <code className="rounded bg-zinc-900 px-1">quantityPrecision</code> 자릿수로 반올림(예: 0.002345 → 0.0023)</li>
          <li>최소 노미널: <code className="rounded bg-zinc-900 px-1">price * qty ≥ minNotional</code> 만족</li>
        </ul>
        <p className="mt-1 text-zinc-400">심볼 제약은 <code className="rounded bg-zinc-900 px-1">/api/trading/binance/futures-symbols</code> 응답을 참고하세요.</p>
      </section>

      <ErrorCard id="FILTER_NOTIONAL" title="최소 주문 금액 미달">
        <li>수량/금액을 늘리거나 레버리지를 조정하세요.</li>
        <li>심볼 제약(최소 주문 금액/수량)을 확인하세요.</li>
      </ErrorCard>
      <ErrorCard id="INSUFFICIENT_MARGIN" title="증거금 부족">
        <li>주문 금액 축소 또는 레버리지 하향.</li>
        <li>지갑 USDT 잔고와 포지션 노미널 확인.</li>
      </ErrorCard>
      <ErrorCard id="REDUCE_ONLY_REJECTED" title="Reduce-Only 거부">
        <li>옵션 해제 또는 수량 조정.</li>
      </ErrorCard>
      <ErrorCard id="POSITION_MODE_MISMATCH" title="포지션 모드 불일치">
        <li>One-Way: <code className="rounded bg-zinc-900 px-1">positionSide=BOTH</code></li>
        <li>Hedge: <code className="rounded bg-zinc-900 px-1">positionSide=LONG|SHORT</code></li>
      </ErrorCard>
      <ErrorCard id="INVALID_PRECISION" title="가격/수량 정밀도 오류">
        <li>심볼 <code className="rounded bg-zinc-900 px-1">pricePrecision</code>/<code className="rounded bg-zinc-900 px-1">quantityPrecision</code>에 맞춰 반올림.</li>
        <p className="mt-1 text-zinc-400">스탑/리밋 모두 동일하게 적용됩니다.</p>
      </ErrorCard>
      <ErrorCard id="INVALID_WORKING_TYPE" title="스탑 기준 오류">
        <li><code className="rounded bg-zinc-900 px-1">workingType=MARK_PRICE</code> 또는 <code className="rounded bg-zinc-900 px-1">CONTRACT_PRICE</code> 확인.</li>
      </ErrorCard>
      <ErrorCard id="SAFETY_LIMIT" title="안전장치 한도 초과">
        <li>설정의 <code className="rounded bg-zinc-900 px-1">maxOrders</code>/<code className="rounded bg-zinc-900 px-1">maxNotional</code> 조정.</li>
      </ErrorCard>
      <ErrorCard id="INVALID_INPUT" title="입력값 오류" />
      <ErrorCard id="UNSUPPORTED_TYPE" title="미지원 주문 타입" />

      <section className="mt-4 rounded border border-zinc-800 bg-zinc-950 p-3">
        <h2 className="mb-2 text-lg">BTCUSDT 예시(선물)</h2>
        <ul className="list-disc pl-5 text-zinc-300">
          <li>pricePrecision: 2 → 가격은 소수점 둘째 자리까지(예: 63000.12)</li>
          <li>quantityPrecision: 3 → 수량은 소수점 셋째 자리까지(예: 0.002)</li>
          <li>minNotional: 5 → price*qty ≥ 5 충족 필요</li>
        </ul>
        <p className="mt-1">예: <code className="rounded bg-zinc-900 px-1">price=63000.12</code>, <code className="rounded bg-zinc-900 px-1">qty=0.00005</code> → <code className="rounded bg-zinc-900 px-1">3.15</code>로 최소 금액 미달(FILTER_NOTIONAL). 수량을 <code className="rounded bg-zinc-900 px-1">0.0001</code> 이상으로 맞추거나 레버리지를 조정하세요.</p>
      </section>
    </main>
  );
}

function ErrorCard({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <section id={id} className="mb-4 rounded border border-zinc-800 bg-zinc-950 p-3">
      <h2 className="mb-1 text-lg"><span className="text-sky-300">{id}</span> — {title}</h2>
      {children ? <ul className="list-disc pl-5 text-zinc-300">{children}</ul> : <p className="text-zinc-400">상세 설명은 상단 가이드를 참고하세요.</p>}
    </section>
  );
}

