import { calculateDrawdown, calculateCumulativePnL } from './metrics';

describe('calculateDrawdown', () => {
  it('낙폭을 백분율로 계산한다', () => {
    const drawdown = calculateDrawdown([
      { timestamp: 1, balance: 10_000 },
      { timestamp: 2, balance: 9_000 },
      { timestamp: 3, balance: 9_500 }
    ]);

    expect(drawdown).toBeCloseTo(-0.1, 5);
  });
});

describe('calculateCumulativePnL', () => {
  it('처음과 마지막 자산 차이를 반환한다', () => {
    const pnl = calculateCumulativePnL([
      { timestamp: 1, balance: 10_000 },
      { timestamp: 2, balance: 11_500 }
    ]);

    expect(pnl).toBe(1_500);
  });
});
