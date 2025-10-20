// @ts-nocheck
// Mock NextResponse to keep tests isolated from Next runtime
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({ ok: (init?.status ?? 200) < 400, status: init?.status ?? 200, json: async () => data })
  }
}));

// Mock exchange client module to avoid importing ccxt in tests
let mockClient: any = {};
jest.mock('@/lib/trading/exchange', () => ({
  createBinanceFuturesClient: () => mockClient
}));

import { POST } from './route';

describe('/api/trading/binance/place-order – validation', () => {
  beforeEach(() => {
    mockClient = {};
  });
  it('returns 400 when symbol/orders are missing', async () => {
    const req = { json: async () => ({}) } as any;
    const res: any = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('INVALID_INPUT');
  });

  it('rejects LONG/SHORT payloads in one_way mode', async () => {
    const req = { json: async () => ({
      symbol: 'BTCUSDT',
      dryRun: true,
      positionMode: 'one_way',
      payloads: [
        { type: 'MARKET', side: 'BUY', quantity: 0.001, positionSide: 'LONG' }
      ]
    }) } as any;
    const res: any = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('POSITION_MODE_MISMATCH');
    expect(Array.isArray(json.invalid)).toBe(true);
    expect(json.invalid[0]?.positionSide).toBe('LONG');
  });

  it('accepts BOTH payloads in one_way mode (dryRun)', async () => {
    const req = { json: async () => ({
      symbol: 'BTCUSDT',
      dryRun: true,
      positionMode: 'one_way',
      payloads: [
        { type: 'LIMIT', side: 'BUY', quantity: 0.001, price: 10000, positionSide: 'BOTH' }
      ]
    }) } as any;
    const res: any = await POST(req);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.dryRun).toBe(true);
    expect(Array.isArray(json.payloads)).toBe(true);
  });

  it('enforces per-order maxNotional safety when provided', async () => {
    const req = { json: async () => ({
      symbol: 'BTCUSDT',
      dryRun: true,
      orders: [
        { id: 'o1', type: 'MARKET', side: 'BUY', quantity: 1, notional: 10000 }
      ],
      safety: { maxNotional: 500 }
    }) } as any;
    const res: any = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('SAFETY_LIMIT');
  });

  it('maps exchange errors to code/hint when dryRun=false', async () => {
    mockClient = { createOrder: jest.fn().mockRejectedValue(new Error('notional too low')) };
    const req = { json: async () => ({
      symbol: 'BTCUSDT',
      dryRun: false,
      payloads: [
        { type: 'MARKET', side: 'BUY', quantity: 0.001, positionSide: 'BOTH' }
      ]
    }) } as any;
    const res: any = await POST(req);
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.dryRun).toBe(false);
    expect(Array.isArray(json.results)).toBe(true);
    expect(json.results[0].ok).toBe(false);
    expect(json.results[0].code).toBe('FILTER_NOTIONAL');
    expect(typeof json.results[0].hint).toBe('string');
  });
});
