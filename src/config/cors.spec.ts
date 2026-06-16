import { resolveCorsOrigin } from './cors';

describe('resolveCorsOrigin', () => {
  it('returns true (reflect) for wildcard in development', () => {
    expect(resolveCorsOrigin('development', '*')).toBe(true);
  });

  it('returns true for wildcard when NODE_ENV is unset', () => {
    expect(resolveCorsOrigin(undefined, '*')).toBe(true);
  });

  it('throws for wildcard in production (insecure with credentials)', () => {
    expect(() => resolveCorsOrigin('production', '*')).toThrow(/CORS_ORIGIN/);
  });

  it('returns a single explicit origin as an array', () => {
    expect(resolveCorsOrigin('production', 'https://app.flux.dev')).toEqual([
      'https://app.flux.dev',
    ]);
  });

  it('splits and trims a comma-separated list', () => {
    expect(
      resolveCorsOrigin('production', 'https://a.dev, https://b.dev'),
    ).toEqual(['https://a.dev', 'https://b.dev']);
  });
});
