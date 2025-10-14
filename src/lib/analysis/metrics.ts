export interface EquityPoint {
  timestamp: number;
  balance: number;
}

export function calculateDrawdown(points: EquityPoint[]) {
  let peak = -Infinity;
  let maxDrawdown = 0;

  for (const point of points) {
    if (point.balance > peak) {
      peak = point.balance;
    }

    const drawdown = peak === 0 ? 0 : (point.balance - peak) / peak;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

export function calculateCumulativePnL(points: EquityPoint[]) {
  if (points.length === 0) {
    return 0;
  }

  const start = points[0].balance;
  const end = points[points.length - 1].balance;

  return end - start;
}
