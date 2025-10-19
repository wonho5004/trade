// @ts-nocheck
// Mock NextResponse to avoid pulling Next.js web runtime in tests
jest.mock('next/server', () => ({
  NextResponse: {
    json: (data: any, init?: any) => ({ ok: (init?.status ?? 200) < 400, status: init?.status ?? 200, json: async () => data })
  }
}));

import { GET } from './route';

describe('/api/markets route – robustness', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch as any;
    jest.resetAllMocks();
  });

  it('returns JSON with items when upstream returns HTML or invalid JSON', async () => {
    // Mock both upstream calls to return ok but invalid JSON
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error('invalid json'); } });

    const req = { url: 'http://localhost/api/markets?quote=USDT&sort=volume&limit=50' } as any;
    const res = await GET(req);
    expect(res?.ok).toBe(true);
    const body = await (res as any).json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThan(0);
    // items contain symbol/quote fields
    expect(body.items[0]).toHaveProperty('symbol');
    expect(body.items[0]).toHaveProperty('quote');
  });

  it('falls back to safe quote when invalid quote is supplied', async () => {
    // Simulate network failure for both upstream calls
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));

    const req = { url: 'http://localhost/api/markets?quote=KRW&sort=volume&limit=200' } as any;
    const res = await GET(req);
    expect(res?.ok).toBe(true);
    const body = await (res as any).json();
    // Defaults to USDT when quote is invalid
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((it: any) => it.quote === 'USDT')).toBe(true);
  });

  it('applies search and limit parameters on the response', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down'));
    const req = { url: 'http://localhost/api/markets?search=BTC&limit=2' } as any;
    const res = await GET(req);
    expect(res?.ok).toBe(true);
    const body = await (res as any).json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.items.some((it: any) => it.symbol.includes('BTC'))).toBe(true);
  });
});
