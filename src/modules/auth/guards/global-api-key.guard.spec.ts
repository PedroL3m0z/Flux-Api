import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { GlobalApiKeyGuard } from './global-api-key.guard';

const context = (req: {
  headers?: Record<string, unknown>;
  query?: Record<string, unknown>;
}): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

const make = (metadata: boolean) => {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(metadata),
  } as unknown as Reflector;
  const config = {
    get: jest.fn().mockReturnValue('secret-key'),
  } as unknown as ConfigService;
  return new GlobalApiKeyGuard(reflector, config);
};

describe('GlobalApiKeyGuard', () => {
  it('allows public / exempt routes without a key', () => {
    expect(make(true).canActivate(context({}))).toBe(true);
  });

  it('allows a valid key from the header', () => {
    const guard = make(false);
    expect(
      guard.canActivate(context({ headers: { 'x-api-key': 'secret-key' } })),
    ).toBe(true);
  });

  it('allows a valid key from the query param (SSE/img)', () => {
    const guard = make(false);
    expect(
      guard.canActivate(context({ query: { apiKey: 'secret-key' } })),
    ).toBe(true);
  });

  it('rejects a missing or wrong key', () => {
    const guard = make(false);
    expect(() => guard.canActivate(context({ headers: {} }))).toThrow();
    expect(() =>
      guard.canActivate(context({ headers: { 'x-api-key': 'nope' } })),
    ).toThrow();
  });
});
