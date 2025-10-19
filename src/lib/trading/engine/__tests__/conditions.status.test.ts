import type { ConditionGroupNode, StatusLeafNode } from '@/types/trading/auto-trading';
import { evaluateConditions } from '@/lib/trading/engine/conditions';

function group(children: any[] = []): ConditionGroupNode {
  return { kind: 'group', id: 'root', operator: 'and', children } as ConditionGroupNode;
}

describe('evaluateConditions – status nodes', () => {
  it('evaluates profitRate with percent unit', () => {
    const status: StatusLeafNode = { kind: 'status', id: 's1', metric: 'profitRate', comparator: 'gte', value: 5, unit: 'percent' };
    const conds: any = { root: group([status]) };
    expect(evaluateConditions(conds, { symbol: 'BTCUSDT', direction: 'long', profitRatePct: 6 })).toBe(true);
    expect(evaluateConditions(conds, { symbol: 'BTCUSDT', direction: 'long', profitRatePct: 3 })).toBe(false);
  });

  it('evaluates margin with matching asset', () => {
    const status: StatusLeafNode = { kind: 'status', id: 's2', metric: 'margin', comparator: 'gte', value: 100, unit: 'USDT' };
    const conds: any = { root: group([status]) };
    expect(evaluateConditions(conds, { symbol: 'ETHUSDT', direction: 'short', margin: { asset: 'USDT', value: 120 } })).toBe(true);
    // different asset should fail comparison
    expect(evaluateConditions(conds, { symbol: 'ETHUSDT', direction: 'short', margin: { asset: 'USDC', value: 200 } })).toBe(false);
  });

  it('evaluates buyCount as integer comparator', () => {
    const status: StatusLeafNode = { kind: 'status', id: 's3', metric: 'buyCount', comparator: 'lte', value: 2, unit: 'count' };
    const conds: any = { root: group([status]) };
    expect(evaluateConditions(conds, { symbol: 'SOLUSDT', direction: 'long', buyCount: 2 })).toBe(true);
    expect(evaluateConditions(conds, { symbol: 'SOLUSDT', direction: 'long', buyCount: 3 })).toBe(false);
  });

  it('evaluates entryAge in days', () => {
    const status: StatusLeafNode = { kind: 'status', id: 's4', metric: 'entryAge', comparator: 'over', value: 3, unit: 'days' };
    const conds: any = { root: group([status]) };
    expect(evaluateConditions(conds, { symbol: 'XRPUSDT', direction: 'short', entryAgeDays: 2 })).toBe(false);
    expect(evaluateConditions(conds, { symbol: 'XRPUSDT', direction: 'short', entryAgeDays: 4 })).toBe(true);
  });
});

