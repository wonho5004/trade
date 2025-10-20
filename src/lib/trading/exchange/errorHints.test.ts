import { mapExchangeError } from '@/lib/trading/exchange/errorHints';

describe('exchange error hints mapping', () => {
  it('maps notional filters', () => {
    const info = mapExchangeError(new Error('Filter failure: NOTIONAL'));
    expect(info?.code).toBe('FILTER_NOTIONAL');
  });
  it('maps insufficient margin', () => {
    const info = mapExchangeError(new Error('Insufficient margin'));
    expect(info?.code).toBe('INSUFFICIENT_MARGIN');
  });
  it('maps reduce only rejected', () => {
    const info = mapExchangeError(new Error('ReduceOnly order rejected'));
    expect(info?.code).toBe('REDUCE_ONLY_REJECTED');
  });
  it('maps position mode mismatch', () => {
    const info = mapExchangeError(new Error('Position mode hedge disabled'));
    expect(info?.code).toBe('POSITION_MODE_MISMATCH');
  });
  it('returns null for unknown errors', () => {
    const info = mapExchangeError(new Error('random error'));
    expect(info).toBeNull();
  });
});

