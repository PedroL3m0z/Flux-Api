import { validateEnv } from './env.validation';

const baseEnv = {
  DATABASE_URL: 'postgresql://flux:flux@localhost:5432/flux',
  JWT_SECRET: 'a-sufficiently-long-secret',
  API_KEY: 'api-key-value',
};

describe('validateEnv', () => {
  it('passes with only the required variables', () => {
    expect(() => validateEnv({ ...baseEnv })).not.toThrow();
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...rest } = baseEnv;
    void DATABASE_URL;
    expect(() => validateEnv(rest)).toThrow(/DATABASE_URL/);
  });

  it('throws when JWT_SECRET is shorter than 16 characters', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('throws when API_KEY is shorter than 8 characters', () => {
    expect(() => validateEnv({ ...baseEnv, API_KEY: 'short' })).toThrow(
      /API_KEY/,
    );
  });

  it('rejects an invalid NODE_ENV', () => {
    expect(() => validateEnv({ ...baseEnv, NODE_ENV: 'staging' })).toThrow();
  });

  it('coerces numeric strings (PORT) to numbers', () => {
    const result = validateEnv({ ...baseEnv, PORT: '3000' });
    expect(result.PORT).toBe(3000);
  });

  it('ignores unrelated process env vars (e.g. PATH)', () => {
    expect(() => validateEnv({ ...baseEnv, PATH: '/usr/bin' })).not.toThrow();
  });
});
