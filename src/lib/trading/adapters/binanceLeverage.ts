import type { LeverageBracket, LeverageTierMap } from '@/types/trading/margin';

const extractNumber = (value: unknown): number | null => {
  if (value == null) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeTier = (candidate: unknown): LeverageBracket | null => {
  if (!isPlainObject(candidate)) {
    return null;
  }
  const raw = candidate as Record<string, unknown>;
  const infoCandidate = raw.info;
  const info = isPlainObject(infoCandidate) ? (infoCandidate as Record<string, unknown>) : {};
  const maxLeverage =
    extractNumber(raw['maxLeverage']) ??
    extractNumber(raw['initialLeverage']) ??
    extractNumber(info['initialLeverage']) ??
    extractNumber(info['maxLeverage']);
  const maxNotional =
    extractNumber(raw['maxNotional']) ??
    extractNumber(raw['notionalCap']) ??
    extractNumber(raw['qtyCap']) ??
    extractNumber(info['notionalCap']) ??
    extractNumber(info['qtyCap']) ??
    extractNumber(info['maxNotional']);
  if (maxLeverage == null || maxNotional == null) {
    return null;
  }
  return {
    maxLeverage,
    maxNotional
  };
};

export const normalizeBinanceLeverageTiers = (raw: unknown): LeverageTierMap => {
  if (!isPlainObject(raw)) {
    return {};
  }
  const normalized: LeverageTierMap = {};
  Object.entries(raw).forEach(([symbol, buckets]) => {
    if (!Array.isArray(buckets)) {
      return;
    }
    const tiers = buckets
      .map((tier) => normalizeTier(tier))
      .filter((tier): tier is LeverageBracket => tier != null)
      .sort((a, b) => (b.maxLeverage ?? 0) - (a.maxLeverage ?? 0));
    if (tiers.length) {
      normalized[symbol.toUpperCase()] = tiers;
    }
  });
  return normalized;
};
