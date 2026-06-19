import { randomBytes } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import * as dotenv from 'dotenv';

/**
 * Secrets the app can run without the operator declaring them: they are read
 * from the environment when present, otherwise loaded from / generated into a
 * persisted secrets file. Keeping them out of the required env set is what lets
 * the project boot with (almost) zero configuration.
 */
export const MANAGED_SECRETS = [
  'JWT_SECRET',
  'API_KEY',
  'TELEGRAM_SESSION_SECRET',
] as const;

export type ManagedSecret = (typeof MANAGED_SECRETS)[number];

/**
 * Weak placeholders shipped by older `.env` templates. Treated as "unset" so a
 * strong secret is generated instead of these ever reaching production.
 */
const WEAK_PLACEHOLDERS = new Set([
  'change-me-in-production',
  'change-me-api-key',
  'dev-secret-change-me',
]);

export interface BootstrapOptions {
  /** Load a local `.env` first (default true). Disabled in tests. */
  loadDotenv?: boolean;
  /** Override the secrets file location (default `${DATA_DIR}/secrets.json`). */
  secretsPath?: string;
}

export interface RuntimeConfigResult {
  /** Secrets that were freshly generated on this boot. */
  generated: ManagedSecret[];
  /** The freshly generated API key, returned once so it can be surfaced. */
  generatedApiKey?: string;
  /** True when DATABASE_URL was derived from defaults rather than provided. */
  databaseUrlDerived: boolean;
  /** Absolute path of the secrets file that backs the generated values. */
  secretsPath: string;
}

/** A non-empty value that is not a known weak placeholder. */
function isUsable(value: string | undefined): value is string {
  const trimmed = value?.trim();
  return !!trimmed && !WEAK_PLACEHOLDERS.has(trimmed);
}

function generateSecret(name: ManagedSecret): string {
  // A readable, prefixed key for the gateway; raw hex for the rest.
  return name === 'API_KEY'
    ? `flux_${randomBytes(24).toString('base64url')}`
    : randomBytes(32).toString('hex');
}

/**
 * Builds a PostgreSQL URL from POSTGRES_* parts, falling back to the values the
 * bundled docker-compose uses, so a fresh checkout connects without any config.
 */
export function deriveDatabaseUrl(): string {
  const user = process.env.POSTGRES_USER ?? 'flux';
  const password = process.env.POSTGRES_PASSWORD ?? 'flux';
  const db = process.env.POSTGRES_DB ?? 'flux';
  const host = process.env.POSTGRES_HOST ?? 'localhost';
  const port = process.env.POSTGRES_HOST_PORT ?? '5432';
  return `postgresql://${user}:${password}@${host}:${port}/${db}?schema=public`;
}

function resolveSecretsPath(): string {
  const dir = process.env.DATA_DIR ?? join(process.cwd(), 'data');
  return join(dir, 'secrets.json');
}

function loadSecretsFile(path: string): Partial<Record<ManagedSecret, string>> {
  if (!existsSync(path)) {
    return {};
  }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Record<
      string,
      unknown
    >;
    const out: Partial<Record<ManagedSecret, string>> = {};
    for (const key of MANAGED_SECRETS) {
      if (typeof parsed[key] === 'string') {
        out[key] = parsed[key];
      }
    }
    return out;
  } catch {
    // A corrupt file should not crash boot; fall back to regenerating.
    return {};
  }
}

function persistSecretsFile(
  path: string,
  secrets: Partial<Record<ManagedSecret, string>>,
): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
  try {
    chmodSync(path, 0o600);
  } catch {
    // Best-effort: platforms without POSIX permissions (e.g. Windows) ignore it.
  }
}

/**
 * Resolves runtime configuration before the Nest app boots so Flux can run with
 * (almost) no environment variables:
 *
 * - `DATABASE_URL` is derived from POSTGRES_* / defaults when unset.
 * - `JWT_SECRET`, `API_KEY` and `TELEGRAM_SESSION_SECRET` are taken from the
 *   environment when set; otherwise read from / generated into a 0600 secrets
 *   file under `DATA_DIR`. Generated values use a CSPRNG and are persisted so
 *   they stay stable across restarts (rotating them would invalidate tokens).
 *
 * Explicit environment variables always win; this only fills the gaps.
 */
export function bootstrapRuntimeConfig(
  options: BootstrapOptions = {},
): RuntimeConfigResult {
  const { loadDotenv = true } = options;
  if (loadDotenv) {
    // Loaded first so values declared in `.env` win over generated defaults.
    // dotenv never overrides variables already present in the environment.
    dotenv.config();
  }

  const databaseUrlDerived = !isUsable(process.env.DATABASE_URL);
  if (databaseUrlDerived) {
    process.env.DATABASE_URL = deriveDatabaseUrl();
  }

  const secretsPath = options.secretsPath ?? resolveSecretsPath();
  const fileSecrets = loadSecretsFile(secretsPath);
  const generated: ManagedSecret[] = [];
  let generatedApiKey: string | undefined;
  let changed = false;

  for (const name of MANAGED_SECRETS) {
    if (isUsable(process.env[name])) {
      continue; // Operator-provided value wins; nothing to persist.
    }
    const fromFile = fileSecrets[name];
    if (isUsable(fromFile)) {
      process.env[name] = fromFile;
      continue;
    }
    const value = generateSecret(name);
    process.env[name] = value;
    fileSecrets[name] = value;
    generated.push(name);
    changed = true;
    if (name === 'API_KEY') {
      generatedApiKey = value;
    }
  }

  if (changed) {
    persistSecretsFile(secretsPath, fileSecrets);
  }

  return { generated, generatedApiKey, databaseUrlDerived, secretsPath };
}
