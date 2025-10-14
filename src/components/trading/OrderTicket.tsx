'use client';

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { useChartStore } from '@/stores/chartStore';

const defaultForm = {
  symbol: 'BTCUSDT',
  side: 'buy',
  quantity: '0.01',
  price: ''
};

export function OrderTicket() {
  const [form, setForm] = useState(defaultForm);
  const currentSymbol = useChartStore((state) => state.symbol);

  useEffect(() => {
    setForm((prev) => ({ ...prev, symbol: currentSymbol }));
  }, [currentSymbol]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 주문 제출 로직은 CCXT 주문 생성 모듈 연동 후 구현 예정입니다.
    console.info('주문 요청', form);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-950 p-6"
    >
      <div className="grid gap-2">
        <label className="text-sm text-zinc-400" htmlFor="symbol">
          거래쌍
        </label>
        <input
          id="symbol"
          name="symbol"
          value={form.symbol}
          onChange={handleChange}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm text-zinc-400" htmlFor="side">
          매매 방향
        </label>
        <select
          id="side"
          name="side"
          value={form.side}
          onChange={handleChange}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        >
          <option value="buy">매수</option>
          <option value="sell">매도</option>
        </select>
      </div>
      <div className="grid gap-2">
        <label className="text-sm text-zinc-400" htmlFor="quantity">
          수량
        </label>
        <input
          id="quantity"
          name="quantity"
          value={form.quantity}
          onChange={handleChange}
          type="number"
          step="0.0001"
          min="0"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm text-zinc-400" htmlFor="price">
          지정가 (선택)
        </label>
        <input
          id="price"
          name="price"
          value={form.price}
          onChange={handleChange}
          type="number"
          step="0.1"
          min="0"
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
        />
      </div>
      <button
        type="submit"
        className="rounded bg-emerald-500 px-4 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-400"
      >
        주문 실행
      </button>
    </form>
  );
}
