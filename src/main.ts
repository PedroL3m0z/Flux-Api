import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './config/cors';
import { runtime } from './config/runtime';
import { API_KEY_HEADER } from './modules/auth/strategies/api-key.strategy';

// Telegram ids are int64 (BigInt), which JSON.stringify can't serialize.
// Emit them as strings in API responses.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
): string {
  return this.toString();
};

async function bootstrap() {
  // `runtime` (imported from ./config/runtime) already resolved DATABASE_URL and
  // the managed secrets at import time — before ConfigModule validated the env —
  // so the app boots with near-zero configuration without weakening security.
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const bootLogger = new Logger('Bootstrap');
  if (runtime.databaseUrlDerived) {
    bootLogger.warn(
      'DATABASE_URL not set — using a derived default (bundled Postgres). Set it explicitly for external databases.',
    );
  }
  if (runtime.generated.length > 0) {
    bootLogger.warn(
      `Generated missing secret(s) [${runtime.generated.join(', ')}] and stored them at ${runtime.secretsPath} (keep this file safe and persistent).`,
    );
  }
  if (runtime.generatedApiKey) {
    bootLogger.warn(
      `Generated API key (shown once — store it now): ${runtime.generatedApiKey}`,
    );
  }
  if (runtime.generatedSeedPassword) {
    const seedUser = config.get<string>('SEED_USERNAME', 'admin');
    bootLogger.warn(
      `Generated initial admin login (shown once — store it now): user "${seedUser}" / password ${runtime.generatedSeedPassword}`,
    );
  }

  // Parse cookies so the JWT can be read from an httpOnly cookie.
  app.use(cookieParser());

  // --- Security headers ---
  // Strict CSP on the API. Relaxed CSP on the Scalar docs UI (CDN bundle +
  // inline bootstrap) and the /dashboard SPA (Vite-emitted assets). Other
  // helmet protections stay on everywhere.
  const helmetStrict = helmet();
  const helmetRelaxedCsp = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith('/docs') || req.path.startsWith('/dashboard')
      ? helmetRelaxedCsp(req, res, next)
      : helmetStrict(req, res, next),
  );

  // --- CORS ---
  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');
  const nodeEnv = config.get<string>('NODE_ENV');
  app.enableCors({
    origin: resolveCorsOrigin(nodeEnv, corsOrigin),
    credentials: true,
  });

  // --- Validation ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // --- OpenAPI document ---
  const apiDescription = [
    'HTTP gateway that runs Telegram accounts as **instances** and exposes them',
    'over a clean REST API, an SSE realtime stream, and outbound **webhooks**.',
    '',
    '### Authentication',
    'Two layers protect the API:',
    '- **JWT (bearer / httpOnly cookie)** — identifies the dashboard user. Obtain it via `POST /auth/login`.',
    `- **API key (\`${API_KEY_HEADER}\` header)** — a static gateway key required on most routes (auth and health are exempt).`,
    '',
    'int64 Telegram ids are serialized as **strings**; dates are ISO-8601.',
    '',
    '### Events',
    'Instances emit normalized events: `session.status`, `message.new`, `message.edited`,',
    '`message.deleted`, `message.read` (seen receipts) and `message.reaction`.',
    '',
    '### Webhooks',
    'Subscribe a webhook to a subset of event types and link it to one or more instances.',
    'Each delivery is POSTed with an HMAC-SHA256 signature in `X-Flux-Signature: sha256=<hex>`',
    '(verify it with the secret returned once at create/rotate), retried with backoff,',
    'and recorded in a queryable delivery log.',
  ].join('\n');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flux API')
    .setDescription(apiDescription)
    .setVersion('1.0')
    .setContact('Pedro Lemos', 'https://github.com/PedroL3m0z', '')
    .setLicense('Apache-2.0', 'https://www.apache.org/licenses/LICENSE-2.0')
    .setExternalDoc('Source code', 'https://github.com/PedroL3m0z/Flux-Api')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'bearer',
    )
    .addApiKey(
      { type: 'apiKey', name: API_KEY_HEADER, in: 'header' },
      'api-key',
    )
    .addTag('auth', 'Login, current user, registration and API-key checks')
    .addTag('users', 'Dashboard user accounts')
    .addTag(
      'telegram',
      'Instances, QR/2FA login, chats, messages, media and realtime streams',
    )
    .addTag(
      'webhooks',
      'Outbound HTTP callbacks: subscriptions, instance links, signing and delivery log',
    )
    .addTag('health', 'Service health checks')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // --- Scalar API Reference UI at /docs (primary docs) ---
  app.use(
    '/docs',
    apiReference({
      content: document,
      theme: 'purple',
    }),
  );

  const port = config.get<number>('PORT', 3000);
  await app.listen(port);
}
void bootstrap();
