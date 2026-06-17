import 'reflect-metadata';
import { plainToInstance, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Schema for the environment variables the app reads at runtime.
 * Variables that only feed docker-compose (POSTGRES_*, *_HOST_PORT) are
 * intentionally omitted — they are not required for the app to boot.
 */
export class EnvironmentVariables {
  @IsOptional()
  @IsEnum(Environment)
  NODE_ENV?: Environment;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  // "true" to mark the auth cookie Secure (set this when serving behind HTTPS).
  @IsOptional()
  @IsIn(['true', 'false'])
  COOKIE_SECURE?: string;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  @IsOptional()
  @IsString()
  REDIS_HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  REDIS_PORT?: number;

  @IsOptional()
  @IsString()
  REDIS_PASSWORD?: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters' })
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsString()
  @MinLength(8, { message: 'API_KEY must be at least 8 characters' })
  API_KEY!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  THROTTLE_TTL?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  THROTTLE_LIMIT?: number;
}

/**
 * ConfigModule `validate` hook. Fails fast at startup with a readable message
 * when required variables are missing or malformed.
 */
export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('\n');
    throw new Error(`Invalid environment variables:\n${details}`);
  }

  return validated;
}
