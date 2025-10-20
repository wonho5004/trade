import type { AutoTradingSettings } from '@/types/trading/auto-trading';
import type { TickerInfo } from '@/types/assets';

/**
 * Computes include/exclude symbol suggestions based on saved auto-select rules.
 * - ranking.volume > 0 => include top N by volume
 * - ranking.volume < 0 => exclude bottom N by volume
 * - ranking.market_cap > 0 => include top N by quoteVolume (proxy for market cap)
 * - ranking.market_cap < 0 => exclude bottom N by quoteVolume
 * - ranking.top_gainers > 0 => include top N by priceChangePercent
 * - ranking.top_losers > 0 => include bottom N by priceChangePercent
 * - excludeTopGainers/Losers => exclude top N gainers/losers
 */
export function applyAutoSelectionRules(settings: AutoTradingSettings, markets: TickerInfo[]): { include: string[]; exclude: string[] } {
  const resInclude: string[] = [];
  const resExclude: string[] = [];
  const ranking = settings.symbolSelection.ranking || ({} as any);
  const sortedBy = (key: 'volume' | 'quoteVolume' | 'changeUp' | 'changeDown') => {
    const arr = [...markets];
    if (key === 'volume') arr.sort((a, b) => (b.volume || 0) - (a.volume || 0));
    else if (key === 'quoteVolume') arr.sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0));
    else if (key === 'changeUp') arr.sort((a, b) => (b.priceChangePercent || 0) - (a.priceChangePercent || 0));
    else if (key === 'changeDown') arr.sort((a, b) => (a.priceChangePercent || 0) - (b.priceChangePercent || 0));
    return arr;
  };
  const pushTop = (arr: TickerInfo[], n: number, out: string[]) => {
    arr.slice(0, Math.max(0, n)).forEach((it) => out.push(`${it.base}/${it.quote}`));
  };
  const pushBottom = (arr: TickerInfo[], n: number, out: string[]) => {
    arr.slice(Math.max(0, arr.length - n)).forEach((it) => out.push(`${it.base}/${it.quote}`));
  };

  // volume (include/exclude bottom via negative)
  if (typeof ranking.volume === 'number' && ranking.volume !== 0) {
    const order = sortedBy('volume');
    if (ranking.volume > 0) pushTop(order, ranking.volume, resInclude);
    else pushBottom(order, Math.abs(ranking.volume), resExclude);
  }
  // market cap proxy
  if (typeof ranking.market_cap === 'number' && ranking.market_cap !== 0) {
    const order = sortedBy('quoteVolume');
    if (ranking.market_cap > 0) pushTop(order, ranking.market_cap, resInclude);
    else pushBottom(order, Math.abs(ranking.market_cap), resExclude);
  }
  if (typeof ranking.top_gainers === 'number' && ranking.top_gainers > 0) {
    pushTop(sortedBy('changeUp'), ranking.top_gainers, resInclude);
  }
  if (typeof ranking.top_losers === 'number' && ranking.top_losers > 0) {
    pushTop(sortedBy('changeDown'), ranking.top_losers, resInclude);
  }
  // explicit excludes by change
  if (typeof settings.symbolSelection.excludeTopGainers === 'number' && settings.symbolSelection.excludeTopGainers > 0) {
    pushTop(sortedBy('changeUp'), settings.symbolSelection.excludeTopGainers, resExclude);
  }
  if (typeof settings.symbolSelection.excludeTopLosers === 'number' && settings.symbolSelection.excludeTopLosers > 0) {
    pushTop(sortedBy('changeDown'), settings.symbolSelection.excludeTopLosers, resExclude);
  }
  return { include: Array.from(new Set(resInclude)), exclude: Array.from(new Set(resExclude)) };
}

