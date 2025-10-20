// @ts-nocheck
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({ ok: (init?.status ?? 200) < 400, status: init?.status ?? 200, json: async () => data })
  }
}));

// Mock exchange client
let mockClient: any = {};
jest.mock('@/lib/trading/exchange', () => ({
  createBinanceFuturesClient: () => mockClient
}));

import { GET } from './route';

describe('/api/trading/binance/position-mode', () => {
  const bak = { key: process.env.BINANCE_FUTURES_API_KEY, sec: process.env.BINANCE_FUTURES_API_SECRET };
  afterEach(() => {
    process.env.BINANCE_FUTURES_API_KEY = bak.key;
    process.env.BINANCE_FUTURES_API_SECRET = bak.sec;
    mockClient = {};
  });

  it('returns ok=false when credentials missing', async () => {
    delete process.env.BINANCE_FUTURES_API_KEY;
    delete process.env.BINANCE_FUTURES_API_SECRET;
    const res: any = await GET();
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('NO_CREDENTIALS');
  });

  it('returns hedge when dualSidePosition true', async () => {
    process.env.BINANCE_FUTURES_API_KEY = 'x';
    process.env.BINANCE_FUTURES_API_SECRET = 'y';
    mockClient = { fapiPrivateGetPositionSideDual: jest.fn().mockResolvedValue({ dualSidePosition: true }) };
    const res: any = await GET();
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.positionMode).toBe('hedge');
  });

  it('returns one_way when dualSidePosition false|string', async () => {
    process.env.BINANCE_FUTURES_API_KEY = 'x';
    process.env.BINANCE_FUTURES_API_SECRET = 'y';
    mockClient = { fapiPrivateGetPositionSideDual: jest.fn().mockResolvedValue({ dualSidePosition: 'false' }) };
    const res: any = await GET();
    expect(res.ok).toBe(true);
    const json = await res.json();
    expect(json.positionMode).toBe('one_way');
  });
});

