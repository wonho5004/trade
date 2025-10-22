import type { ScaleInBudgetMode } from '@/types/trading/auto-trading';
import type { LeverageBracket, MarginCapResult } from '@/types/trading/margin';

const EPSILON = 1e-8;

const isPositiveNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const sanitizePositiveNumber = (value: unknown): number | null => (isPositiveNumber(value) ? value : null);

const normalizeLeverage = (value: unknown): number | null => sanitizePositiveNumber(value);

const normalizeNotional = (value: unknown): number | null => sanitizePositiveNumber(value);

const normalizePrecision = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

const applyPrecisionInternal = (value: number, precision: number, mode: 'floor' | 'ceil' | 'round') => {
  if (!Number.isFinite(value)) {
    return value;
  }
  const factor = 10 ** precision;
  if (!Number.isFinite(factor) || factor <= 0) {
    return value;
  }
  const scaled = value * factor;
  let adjusted: number;
  switch (mode) {
    case 'floor':
      adjusted = Math.floor(scaled + EPSILON);
      break;
    case 'ceil':
      adjusted = Math.ceil(scaled - EPSILON);
      break;
    case 'round':
    default:
      adjusted = Math.round(scaled);
      break;
  }
  return adjusted / factor;
};

export const applyPrecision = (
  value: number,
  precision: number | null | undefined,
  mode: 'floor' | 'ceil' | 'round' = 'round'
): number => {
  if (!Number.isFinite(value)) {
    return value;
  }
  const normalizedPrecision = normalizePrecision(precision ?? null);
  if (normalizedPrecision == null) {
    return value;
  }
  return applyPrecisionInternal(value, normalizedPrecision, mode);
};

export const getExchangeMaxNotionalForLeverage = (
  brackets: LeverageBracket[] | null | undefined,
  leverage: unknown
): number | null => {
  const normalizedLeverage = normalizeLeverage(leverage);
  if (!Array.isArray(brackets) || normalizedLeverage == null) {
    return null;
  }
  return brackets.reduce<number | null>((acc, bracket) => {
    const bracketLeverage = normalizeLeverage(bracket?.maxLeverage ?? null);
    const bracketNotional = normalizeNotional(bracket?.maxNotional ?? null);
    if (bracketLeverage == null || bracketNotional == null) {
      return acc;
    }
    if (bracketLeverage >= normalizedLeverage) {
      if (acc == null || bracketNotional > acc) {
        return bracketNotional;
      }
    }
    return acc;
  }, null);
};

type ResolveMarginCapInput = {
  leverage: unknown;
  strategyMaxNotional: unknown;
  leverageBrackets: LeverageBracket[] | null | undefined;
};

export const resolveMarginCap = ({
  leverage,
  leverageBrackets,
  strategyMaxNotional
}: ResolveMarginCapInput): MarginCapResult => {
  const exchangeMaxNotional = getExchangeMaxNotionalForLeverage(leverageBrackets, leverage);
  const normalizedStrategyMax = normalizeNotional(strategyMaxNotional);

  const candidates = [exchangeMaxNotional, normalizedStrategyMax].filter(
    (value): value is number => value != null
  );
  const effectiveMaxNotional = candidates.length ? Math.min(...candidates) : null;

  let limitedBy: MarginCapResult['limitedBy'] = 'none';
  if (effectiveMaxNotional != null) {
    if (
      exchangeMaxNotional != null &&
      Math.abs(effectiveMaxNotional - exchangeMaxNotional) <= EPSILON
    ) {
      limitedBy = 'exchange';
    } else if (
      normalizedStrategyMax != null &&
      Math.abs(effectiveMaxNotional - normalizedStrategyMax) <= EPSILON
    ) {
      limitedBy = 'strategy';
    }
  }

  return {
    exchangeMaxNotional,
    strategyMaxNotional: normalizedStrategyMax,
    effectiveMaxNotional,
    limitedBy
  };
};

type MinMarginInput = {
  leverage: unknown;
  notional: unknown;
};

export const calculateMinMargin = ({ leverage, notional }: MinMarginInput): number | null => {
  const normalizedLeverage = normalizeLeverage(leverage);
  const normalizedNotional = normalizeNotional(notional);
  if (normalizedLeverage == null || normalizedNotional == null) {
    return null;
  }
  if (normalizedLeverage <= 0) {
    return null;
  }
  return normalizedNotional / normalizedLeverage;
};

type QuantityByNotionalInput = {
  price: unknown;
  notional: unknown;
  minQuantity?: unknown;
  quantityPrecision?: number | null;
};

export const toQuantityByNotional = ({
  price,
  notional,
  minQuantity,
  quantityPrecision
}: QuantityByNotionalInput): { quantity: number | null; notional: number | null } => {
  const normalizedNotional = normalizeNotional(notional);
  const normalizedPrice = sanitizePositiveNumber(price);
  if (normalizedNotional == null || normalizedPrice == null) {
    return { quantity: null, notional: normalizedNotional };
  }

  const normalizedPrecision = normalizePrecision(quantityPrecision ?? null);
  const minQtyValue = sanitizePositiveNumber(minQuantity);

  const align = (value: number, mode: 'floor' | 'ceil' | 'round') =>
    normalizedPrecision != null ? applyPrecisionInternal(value, normalizedPrecision, mode) : value;

  let quantity = normalizedNotional / normalizedPrice;
  if (!isPositiveNumber(quantity)) {
    return { quantity: null, notional: null };
  }

  quantity = align(quantity, 'floor');

  if (minQtyValue != null) {
    const alignedMinQty = normalizedPrecision != null ? align(minQtyValue, 'ceil') : minQtyValue;
    if (quantity < alignedMinQty - EPSILON) {
      quantity = alignedMinQty;
    }
  }

  if (!isPositiveNumber(quantity)) {
    return { quantity: null, notional: null };
  }

  if (normalizedPrecision != null) {
    quantity = align(quantity, 'floor');
  }

  if (!isPositiveNumber(quantity)) {
    return { quantity: null, notional: null };
  }

  const recalculatedNotional = quantity * normalizedPrice;
  return {
    quantity,
    notional: Number.isFinite(recalculatedNotional) ? recalculatedNotional : null
  };
};

const normalizeCount = (value: unknown): number => {
  const numeric = sanitizePositiveNumber(value);
  if (numeric == null || numeric <= 0) {
    return 1;
  }
  return Math.max(1, Math.floor(numeric));
};

export const SCALE_IN_BUDGET_PERCENT_CAP = 1000;

type ScaleInBudgetLimitedBy = 'balance' | 'margin' | 'min_notional' | 'none';

type ScaleInBudgetInput = {
  mode: ScaleInBudgetMode;
  percentage: unknown;
  minNotional: unknown;
  leverage: unknown;
  estimatedBalance: unknown;
  allocationCount: unknown;
  baseMargin?: unknown;
  baseNotional?: unknown;
  price?: unknown;
  quantityPrecision?: number | null;
  minQuantity?: unknown;
  capPercentage?: unknown;
};

export const calculateScaleInBudget = ({
  mode,
  percentage,
  minNotional,
  leverage,
  estimatedBalance,
  allocationCount,
  baseMargin,
  baseNotional,
  price,
  quantityPrecision,
  minQuantity,
  capPercentage
}: ScaleInBudgetInput) => {
  const normalizedLeverage = normalizeLeverage(leverage) ?? 1;
  const normalizedPercentage = sanitizePositiveNumber(percentage);
  const normalizedCap = sanitizePositiveNumber(capPercentage) ?? SCALE_IN_BUDGET_PERCENT_CAP;
  const cappedPercentage =
    normalizedPercentage != null ? Math.min(normalizedPercentage, normalizedCap) : null;
  const count = normalizeCount(allocationCount);

  let margin: number | null = null;
  let notional: number | null = null;
  let limitedBy: ScaleInBudgetLimitedBy = 'none';

  if (mode === 'balance_percentage') {
    const balance = sanitizePositiveNumber(estimatedBalance);
    if (balance != null && cappedPercentage != null) {
      const totalMargin = (balance * cappedPercentage) / 100;
      margin = totalMargin / count;
      limitedBy = 'balance';
    }
  } else if (mode === 'per_symbol_percentage') {
    const base = sanitizePositiveNumber(baseMargin);
    if (base != null && cappedPercentage != null) {
      margin = (base * cappedPercentage) / 100;
      limitedBy = 'margin';
    }
  } else if (mode === 'min_notional') {
    const fallbackNotional = normalizeNotional(minNotional);
    const baseNotionalValue = normalizeNotional(baseNotional);
    notional = fallbackNotional ?? baseNotionalValue ?? null;
    if (
      baseNotionalValue != null &&
      notional != null &&
      baseNotionalValue - notional > EPSILON
    ) {
      notional = baseNotionalValue;
    }
    limitedBy = 'min_notional';
  }

  if (margin != null && normalizedLeverage > 0) {
    notional = margin * normalizedLeverage;
  } else if (notional != null && normalizedLeverage > 0 && margin == null) {
    margin = notional / normalizedLeverage;
  }

  const quantityResult = toQuantityByNotional({
    price,
    notional,
    minQuantity,
    quantityPrecision
  });

  const finalNotional = quantityResult.notional ?? notional;
  const finalMargin =
    finalNotional != null && normalizedLeverage > 0 ? finalNotional / normalizedLeverage : null;

  if (finalNotional == null && finalMargin == null) {
    limitedBy = 'none';
  }

  return {
    mode,
    limitedBy,
    margin: finalMargin,
    notional: finalNotional,
    quantity: quantityResult.quantity
  };
};

type MinPositionInput = {
  leverage: unknown;
  minNotional: unknown;
  price?: unknown;
  quantityPrecision?: number | null;
  minQuantity?: unknown;
};

export const calculateMinPosition = ({
  leverage,
  minNotional,
  price,
  quantityPrecision,
  minQuantity
}: MinPositionInput) => {
  const normalizedMinNotional = normalizeNotional(minNotional);
  const margin = calculateMinMargin({ leverage, notional: normalizedMinNotional });

  let quantity: number | null = null;
  let notionalValue = normalizedMinNotional;

  if (normalizedMinNotional != null) {
    const quantityResult = toQuantityByNotional({
      price,
      notional: normalizedMinNotional,
      quantityPrecision,
      minQuantity
    });
    quantity = quantityResult.quantity;
    if (quantityResult.notional != null) {
      notionalValue = quantityResult.notional;
    }
  }

  return {
    margin,
    notional: notionalValue,
    quantity
  };
};

type MaxPositionInput = {
  leverage: unknown;
  strategyMaxNotional: unknown;
  leverageBrackets: LeverageBracket[] | null | undefined;
  price?: unknown;
  quantityPrecision?: number | null;
  minQuantity?: unknown;
  minNotional?: unknown;
};

export const calculateMaxPosition = ({
  leverage,
  strategyMaxNotional,
  leverageBrackets,
  price,
  quantityPrecision,
  minQuantity,
  minNotional
}: MaxPositionInput) => {
  const cap = resolveMarginCap({ leverage, strategyMaxNotional, leverageBrackets });
  const normalizedMinNotional = normalizeNotional(minNotional);

  let targetNotional =
    cap.effectiveMaxNotional ?? cap.strategyMaxNotional ?? cap.exchangeMaxNotional ?? null;
  let limitedBy = cap.limitedBy;

  if (normalizedMinNotional != null) {
    if (targetNotional == null || targetNotional < normalizedMinNotional - EPSILON) {
      targetNotional = normalizedMinNotional;
      limitedBy = 'none';
    }
  }

  const quantityResult = toQuantityByNotional({
    price,
    notional: targetNotional,
    quantityPrecision,
    minQuantity
  });

  const notionalValue = quantityResult.notional ?? targetNotional;
  const margin = calculateMinMargin({ leverage, notional: notionalValue });

  return {
    ...cap,
    limitedBy,
    notional: notionalValue,
    quantity: quantityResult.quantity,
    margin
  };
};
