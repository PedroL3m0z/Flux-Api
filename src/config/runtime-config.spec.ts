import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bootstrapRuntimeConfig,
  deriveDatabaseUrl,
  MANAGED_SECRETS,
} from './runtime-config';

describe('runtime-config', () => {
  const TOUCHED = [
    ...MANAGED_SECRETS,
    'DATABASE_URL',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD',
    'POSTGRES_DB',
    'POSTGRES_HOST',
    'POSTGRES_HOST_PORT',
    'DATA_DIR',
  ];

  let saved: Record<string, string | undefined>;
  let tmp: string;
  let secretsPath: string;

  beforeEach(() => {
    saved = {};
    for (const key of TOUCHED) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    tmp = mkdtempSync(join(tmpdir(), 'flux-runtime-'));
    secretsPath = join(tmp, 'nested', 'secrets.json');
  });

  afterEach(() => {
    for (const key of TOUCHED) {
      if (saved[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved[key];
      }
    }
    rmSync(tmp, { recursive: true, force: true });
  });

  const run = () => bootstrapRuntimeConfig({ loadDotenv: false, secretsPath });

  it('derives DATABASE_URL from POSTGRES_* parts when unset', () => {
    process.env.POSTGRES_USER = 'u';
    process.env.POSTGRES_PASSWORD = 'p';
    process.env.POSTGRES_DB = 'd';
    process.env.POSTGRES_HOST = 'db.local';
    process.env.POSTGRES_HOST_PORT = '6000';

    const result = run();

    expect(result.databaseUrlDerived).toBe(true);
    expect(process.env.DATABASE_URL).toBe(
      'postgresql://u:p@db.local:6000/d?schema=public',
    );
  });

  it('keeps an explicitly provided DATABASE_URL', () => {
    process.env.DATABASE_URL = 'postgresql://x:y@host:5432/db?schema=public';
    const result = run();
    expect(result.databaseUrlDerived).toBe(false);
    expect(process.env.DATABASE_URL).toBe(
      'postgresql://x:y@host:5432/db?schema=public',
    );
  });

  it('generates and persists all managed secrets when absent', () => {
    const result = run();

    expect(result.generated).toEqual([...MANAGED_SECRETS]);
    expect(result.generatedApiKey).toMatch(/^flux_/);
    for (const name of MANAGED_SECRETS) {
      expect(process.env[name]).toBeTruthy();
    }
    expect(existsSync(secretsPath)).toBe(true);
    const onDisk = JSON.parse(readFileSync(secretsPath, 'utf8')) as Record<
      string,
      string
    >;
    expect(onDisk.JWT_SECRET).toBe(process.env.JWT_SECRET);
  });

  it('reloads the same secrets from the file on a later boot', () => {
    const first = run();
    const jwt = process.env.JWT_SECRET;
    const apiKey = process.env.API_KEY;

    for (const name of MANAGED_SECRETS) {
      delete process.env[name];
    }

    const second = run();
    expect(second.generated).toEqual([]);
    expect(process.env.JWT_SECRET).toBe(jwt);
    expect(process.env.API_KEY).toBe(apiKey);
    expect(first.generatedApiKey).toBe(apiKey);
  });

  it('respects secrets provided via the environment', () => {
    process.env.JWT_SECRET = 'an-explicit-strong-secret-value';
    const result = run();
    expect(result.generated).not.toContain('JWT_SECRET');
    expect(process.env.JWT_SECRET).toBe('an-explicit-strong-secret-value');
  });

  it('treats known weak placeholders as unset', () => {
    process.env.API_KEY = 'change-me-api-key';
    process.env.JWT_SECRET = 'change-me-in-production';
    const result = run();
    expect(result.generated).toContain('API_KEY');
    expect(result.generated).toContain('JWT_SECRET');
    expect(process.env.API_KEY).not.toBe('change-me-api-key');
  });

  it('deriveDatabaseUrl falls back to bundled defaults', () => {
    expect(deriveDatabaseUrl()).toBe(
      'postgresql://flux:flux@localhost:5432/flux?schema=public',
    );
  });
});
