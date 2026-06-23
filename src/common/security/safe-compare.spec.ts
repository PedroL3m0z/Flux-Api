import { safeEqual } from './safe-compare';

describe('safeEqual', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('flux_secret', 'flux_secret')).toBe(true);
  });

  it('returns false for different strings of equal length', () => {
    expect(safeEqual('abcdef', 'abcxyz')).toBe(false);
  });

  it('returns false for different lengths', () => {
    expect(safeEqual('short', 'longer-value')).toBe(false);
  });

  it('returns false when either side is undefined', () => {
    expect(safeEqual(undefined, 'x')).toBe(false);
    expect(safeEqual('x', undefined)).toBe(false);
    expect(safeEqual(undefined, undefined)).toBe(false);
  });

  it('handles multibyte characters by byte length', () => {
    expect(safeEqual('café', 'café')).toBe(true);
    expect(safeEqual('café', 'cafe')).toBe(false);
  });
});
