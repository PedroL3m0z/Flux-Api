import { accessTokenCookieOptions, expiresInToMs } from './auth.cookie';

describe('expiresInToMs', () => {
  it.each([
    ['3600s', 3_600_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['7d', 604_800_000],
    ['500', 500_000], // bare number defaults to seconds
  ])('parses %s', (input, expected) => {
    expect(expiresInToMs(input)).toBe(expected);
  });

  it('falls back on garbage input', () => {
    expect(expiresInToMs('nonsense', 1234)).toBe(1234);
  });
});

describe('accessTokenCookieOptions', () => {
  it('is httpOnly and not secure outside production', () => {
    expect(accessTokenCookieOptions(1000, false)).toMatchObject({
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 1000,
    });
  });

  it('is secure in production', () => {
    expect(accessTokenCookieOptions(1000, true).secure).toBe(true);
  });
});
