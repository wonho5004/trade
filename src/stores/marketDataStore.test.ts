import { act } from '@testing-library/react';

import { useMarketDataStore } from './marketDataStore';

const sampleTicker = {
  symbol: 'BTCUSDT',
  lastPrice: 68000,
  priceChangePercent: 2.5,
  highPrice: 70000,
  lowPrice: 66000,
  volume: 12345,
  eventTime: Date.now()
};

describe('useMarketDataStore', () => {
  afterEach(() => {
    act(() => {
      useMarketDataStore.getState().reset();
    });
  });

  it('sets state to connecting when beginConnection is called', () => {
    act(() => {
      useMarketDataStore.getState().beginConnection('BTCUSDT');
    });

    const state = useMarketDataStore.getState();
    expect(state.status).toBe('connecting');
    expect(state.symbol).toBe('BTCUSDT');
  });

  it('updates ticker data and status on setTicker', () => {
    act(() => {
      useMarketDataStore.getState().setTicker(sampleTicker);
    });

    const state = useMarketDataStore.getState();
    expect(state.status).toBe('connected');
    expect(state.lastPrice).toBe(sampleTicker.lastPrice);
    expect(state.priceChangePercent).toBe(sampleTicker.priceChangePercent);
    expect(state.highPrice).toBe(sampleTicker.highPrice);
  });

  it('marks the store as error and stores message', () => {
    act(() => {
      useMarketDataStore.getState().setError('연결 실패');
    });

    const state = useMarketDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.error).toBe('연결 실패');
  });
});
