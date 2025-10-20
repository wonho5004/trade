import { parseExprRef } from '@/lib/trading/expr';
import { resolvePriceFromRef } from '@/lib/trading/engine/priceResolver';

describe('expr parser', () => {
  it('parses cross with dir/when', () => {
    const ref = parseExprRef('expr:cross:a:b:dir=up:when=previous');
    expect(ref).toEqual({ type: 'expr', op: 'cross', a: 'a', b: 'b', dir: 'up', when: 'previous' });
  });
  it('parses offset', () => {
    const ref = parseExprRef('expr:offset:a:pct=2.5');
    expect((ref as any).op).toBe('offset');
    expect((ref as any).pct).toBe(2.5);
  });
});

describe('priceResolver', () => {
  it('resolves indicator id at last index', () => {
    const series = { x: [1, 2, 3] } as any;
    const v = resolvePriceFromRef('x', series);
    expect(v).toBe(3);
  });
  it('resolves avg/min/max/ratio', () => {
    const series = { a: [2, 4, 6], b: [1, 2, 3] } as any;
    expect(resolvePriceFromRef('expr:avg:a:b', series)).toBe(4.5);
    expect(resolvePriceFromRef('expr:min:a:b', series)).toBe(3);
    expect(resolvePriceFromRef('expr:max:a:b', series)).toBe(6);
    expect(resolvePriceFromRef('expr:ratio:a:b', series)).toBe(2);
  });
  it('resolves offset', () => {
    const series = { a: [100, 100, 100] } as any;
    expect(resolvePriceFromRef('expr:offset:a:pct=10', series)).toBeCloseTo(110, 8);
  });
  it('resolves cross recent/previous', () => {
    // a crosses above b at index 2, and again at index 5
    const series = { a: [1,2,3,4,3,5], b: [2,2,2,3,3,4] } as any;
    const recent = resolvePriceFromRef('expr:cross:a:b:dir=up:when=recent', series);
    const previous = resolvePriceFromRef('expr:cross:a:b:dir=up:when=previous', series);
    expect(recent).toBeCloseTo((5+4)/2, 8);
    expect(previous).toBeCloseTo((3+2)/2, 8);
  });

  it('resolves cross with linear interpolation when interp=linear', () => {
    // Construct a simple linear cross between previous and current
    // prev: a=1, b=3; curr: a=4, b=2  => crossing occurs between them
    const series = { a: [1, 4], b: [3, 2] } as any;
    // Linear interpolation t = (b1 - a1) / ((a0-a1)-(b0-b1)) = (3-1)/((4-1)-(2-3)) = 2 / (3 - (-1)) = 2/4 = 0.5
    // Cross value = a1 + t*(a0-a1) = 1 + 0.5*(3) = 2.5
    const v = resolvePriceFromRef('expr:cross:a:b:dir=both:when=recent:interp=linear', series);
    expect(v).toBeCloseTo(2.5, 8);
  });
});
