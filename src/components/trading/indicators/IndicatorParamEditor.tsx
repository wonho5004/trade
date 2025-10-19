import type {
  BollingerCondition,
  DmiCondition,
  IndicatorKey,
  MacdCondition,
  MaCondition,
  RsiCondition,
  ThresholdCondition
} from '@/types/trading/auto-trading';

type CommonProps<T> = {
  value: T;
  onChange: (next: T) => void;
};

export function BollingerEditor({ value, onChange }: CommonProps<BollingerCondition>) {
  return (
    <div className="grid gap-2 md:grid-cols-5">
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>길이</span>
        <input
          type="number"
          min={1}
          max={500}
          value={value.length}
          onChange={(e) => onChange({ ...value, length: Math.max(1, Number(e.target.value) || 1) })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>표준편차</span>
        <input
          type="number"
          min={0}
          max={10}
          step={0.1}
          value={value.standardDeviation}
          onChange={(e) => onChange({ ...value, standardDeviation: Math.max(0, Number(e.target.value) || 0) })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>오프셋</span>
        <input
          type="number"
          min={-50}
          max={50}
          value={value.offset}
          onChange={(e) => onChange({ ...value, offset: Number(e.target.value) || 0 })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>밴드</span>
        <select
          value={value.band}
          onChange={(e) => onChange({ ...value, band: e.target.value as BollingerCondition['band'] })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          <option value="upper">상단</option>
          <option value="middle">중단</option>
          <option value="lower">하단</option>
          <option value="none">없음</option>
        </select>
      </label>
      {/* 액션 항목 제거: 비교 기준에서 연산 수행 */}
    </div>
  );
}

export function MaEditor({ value, onChange }: CommonProps<MaCondition>) {
  return (
    <div className="grid gap-2 md:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>기간</span>
        <input
          type="number"
          min={1}
          max={1000}
          value={value.period}
          onChange={(e) => onChange({ ...value, period: Math.max(1, Number(e.target.value) || 1) })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </label>
      {/* MA 액션 항목 제거: 비교 기준에서 연산 수행 */}
    </div>
  );
}

export function RsiEditor({ value, onChange }: CommonProps<RsiCondition>) {
  const isDisabled = (key: RsiCondition['actions'][number]) => {
    const a = new Set(value.actions);
    if (a.has('cross_above')) return key === 'cross_below' || key === 'stay_below';
    if (a.has('cross_below')) return key === 'cross_above' || key === 'stay_above';
    if (a.has('stay_above')) return key === 'stay_below' || key === 'cross_below';
    if (a.has('stay_below')) return key === 'stay_above' || key === 'cross_above';
    return false;
  };
  const toggle = (key: RsiCondition['actions'][number]) => {
    if (isDisabled(key)) return;
    const has = value.actions.includes(key);
    let next = has ? value.actions.filter((k) => k !== key) : [...value.actions, key];
    if (key === 'cross_above') next = next.filter((k) => k !== 'cross_below' && k !== 'stay_below');
    if (key === 'cross_below') next = next.filter((k) => k !== 'cross_above' && k !== 'stay_above');
    if (key === 'stay_above') next = next.filter((k) => k !== 'stay_below' && k !== 'cross_below');
    if (key === 'stay_below') next = next.filter((k) => k !== 'stay_above' && k !== 'cross_above');
    onChange({ ...value, actions: next });
  };
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>기간</span>
        <input
          type="number"
          min={1}
          max={100}
          value={value.period}
          onChange={(e) => onChange({ ...value, period: Math.max(1, Number(e.target.value) || 1) })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>스무딩</span>
        <select
          value={value.smoothing}
          onChange={(e) => onChange({ ...value, smoothing: e.target.value as RsiCondition['smoothing'] })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          <option value="sma">SMA</option>
          <option value="ema">EMA</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-300">
        <span>임계값</span>
        <input
          type="number"
          min={0}
          max={100}
          value={value.threshold}
          onChange={(e) => onChange({ ...value, threshold: Math.max(0, Number(e.target.value) || 0) })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 text-xs text-zinc-300">
        {[
          ['cross_above', '상향 교차'],
          ['cross_below', '하향 교차'],
          ['stay_above', '상단 유지'],
          ['stay_below', '하단 유지']
        ].map(([k, label]) => (
          <label key={k} className="flex items-center gap-2">
            <input type="checkbox" checked={value.actions.includes(k as any)} disabled={isDisabled(k as any)} onChange={() => toggle(k as any)} />
            {label}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">허용 조합: 상향 교차+상단 유지, 하향 교차+하단 유지. 그 외 조합은 사용할 수 없습니다.</p>
    </div>
  );
}

function ThresholdEditor({ value, onChange, label }: { value: ThresholdCondition; onChange: (next: ThresholdCondition) => void; label: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-zinc-300">
      <span>{label}</span>
      <div className="flex gap-2">
        <select
          value={value.comparator}
          onChange={(e) => onChange({ ...value, enabled: true, comparator: e.target.value as any })}
          className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        >
          <option value="none">선택안함</option>
          <option value="over">크다({">"})</option>
          <option value="under">작다({"<"})</option>
          <option value="eq">같다(=)</option>
          <option value="gte">크거나같다({">="})</option>
          <option value="lte">작거나같다({"<="})</option>
        </select>
        <input
          type="number"
          value={value.value}
          onChange={(e) => onChange({ ...value, enabled: true, value: Number(e.target.value) || 0 })}
          className="w-28 rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
        />
      </div>
    </label>
  );
}

export function DmiEditor({ value, onChange }: CommonProps<DmiCondition>) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-4">
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>DI 기간</span>
          <input
            type="number"
            min={1}
            max={200}
            value={value.diPeriod}
            onChange={(e) => onChange({ ...value, diPeriod: Math.max(1, Number(e.target.value) || 1) })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>ADX 기간</span>
          <input
            type="number"
            min={1}
            max={200}
            value={value.adxPeriod}
            onChange={(e) => onChange({ ...value, adxPeriod: Math.max(1, Number(e.target.value) || 1) })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>DI 비교</span>
          <select
            value={value.diComparison ?? ''}
            onChange={(e) => onChange({ ...value, diComparison: (e.target.value || null) as DmiCondition['diComparison'] })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="">없음</option>
            <option value="plus_over_minus">DI+ &gt; DI-</option>
            <option value="minus_over_plus">DI- &gt; DI+</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <ThresholdEditor label="ADX" value={value.adx} onChange={(next) => onChange({ ...value, adx: next })} />
        <ThresholdEditor label="DI+" value={value.diPlus} onChange={(next) => onChange({ ...value, diPlus: next })} />
        <ThresholdEditor label="DI-" value={value.diMinus} onChange={(next) => onChange({ ...value, diMinus: next })} />
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>ADX vs DI 비교</span>
          <select
            value={(value as any).adxVsDi ?? ''}
            onChange={(e) => onChange({ ...value, adxVsDi: (e.target.value || null) as any })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="">없음</option>
            <option value="adx_gt_di_plus">ADX &gt; DI+</option>
            <option value="adx_lt_di_plus">ADX &lt; DI+</option>
            <option value="adx_gt_di_minus">ADX &gt; DI-</option>
            <option value="adx_lt_di_minus">ADX &lt; DI-</option>
          </select>
        </label>
      </div>
      <p className="col-span-4 text-[11px] text-zinc-500">비교 연산자를 ‘선택안함’으로 두고 교차/유지 동작을 조합해 사용할 수 있습니다.</p>
    </div>
  );
}

export function MacdEditor({ value, onChange }: CommonProps<MacdCondition>) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-5">
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>FAST</span>
          <input
            type="number"
            min={1}
            max={200}
            value={value.fast}
            onChange={(e) => onChange({ ...value, fast: Math.max(1, Number(e.target.value) || 1) })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>SLOW</span>
          <input
            type="number"
            min={1}
            max={300}
            value={value.slow}
            onChange={(e) => onChange({ ...value, slow: Math.max(1, Number(e.target.value) || 1) })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>SIGNAL</span>
          <input
            type="number"
            min={1}
            max={200}
            value={value.signal}
            onChange={(e) => onChange({ ...value, signal: Math.max(1, Number(e.target.value) || 1) })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>소스</span>
          <select
            value={value.source}
            onChange={(e) => onChange({ ...value, source: e.target.value as MacdCondition['source'] })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="open">Open</option>
            <option value="high">High</option>
            <option value="low">Low</option>
            <option value="close">Close</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>MA 방식</span>
          <select
            value={value.method}
            onChange={(e) => onChange({ ...value, method: e.target.value as MacdCondition['method'] })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="EMA">EMA</option>
            <option value="SMA">SMA</option>
          </select>
        </label>
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>비교</span>
          <select
            value={value.comparison ?? ''}
            onChange={(e) => onChange({ ...value, comparison: (e.target.value || null) as MacdCondition['comparison'] })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="">없음</option>
            <option value="macd_over_signal">MACD &gt; SIGNAL</option>
            <option value="macd_under_signal">MACD &lt; SIGNAL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-zinc-300">
          <span>히스토그램</span>
          <select
            value={value.histogramAction ?? ''}
            onChange={(e) => onChange({ ...value, histogramAction: (e.target.value || null) as MacdCondition['histogramAction'] })}
            className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-100"
          >
            <option value="">없음</option>
            <option value="increasing">증가</option>
            <option value="decreasing">감소</option>
          </select>
        </label>
      </div>
      <p className="text-[11px] text-zinc-500">비교 연산자가 ‘선택안함’인 경우, MACD/Signal/Histogram 기준을 활용해 트리거를 구성하세요.</p>
    </div>
  );
}

export function IndicatorParamEditor({
  type,
  value,
  onChange
}: {
  type: IndicatorKey;
  value: BollingerCondition | MaCondition | RsiCondition | DmiCondition | MacdCondition;
  onChange: (next: typeof value) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-xs text-zinc-300">
        <input
          type="checkbox"
          checked={(value as any).enabled}
          onChange={(e) => onChange({ ...(value as any), enabled: e.target.checked })}
        />
        사용
      </label>
      {(value as any).enabled ? (
        type === 'bollinger' ? (
          <BollingerEditor value={value as BollingerCondition} onChange={onChange as any} />
        ) : type === 'ma' ? (
          <MaEditor value={value as MaCondition} onChange={onChange as any} />
        ) : type === 'rsi' ? (
          <RsiEditor value={value as RsiCondition} onChange={onChange as any} />
        ) : type === 'dmi' ? (
          <DmiEditor value={value as DmiCondition} onChange={onChange as any} />
        ) : (
          <MacdEditor value={value as MacdCondition} onChange={onChange as any} />
        )
      ) : (
        <p className="text-[11px] text-zinc-500">지표를 사용하려면 토글을 켜세요.</p>
      )}
    </div>
  );
}
