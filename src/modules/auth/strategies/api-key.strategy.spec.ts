import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyStrategy } from './api-key.strategy';

describe('ApiKeyStrategy', () => {
  const makeStrategy = (expected?: string) => {
    const config = {
      get: jest.fn().mockReturnValue(expected),
    } as unknown as ConfigService;
    return new ApiKeyStrategy(config);
  };

  it('returns true when the key matches the configured value', () => {
    const strategy = makeStrategy('secret-key');
    expect(strategy.validate('secret-key')).toBe(true);
  });

  it('throws UnauthorizedException on a wrong key', () => {
    const strategy = makeStrategy('secret-key');
    expect(() => strategy.validate('wrong-key')).toThrow(UnauthorizedException);
  });

  it('throws when no API_KEY is configured (never auths with empty)', () => {
    const strategy = makeStrategy(undefined);
    expect(() => strategy.validate('')).toThrow(UnauthorizedException);
  });
});
