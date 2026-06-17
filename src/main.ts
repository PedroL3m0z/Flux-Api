import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { resolveCorsOrigin } from './config/cors';
import { API_KEY_HEADER } from './modules/auth/strategies/api-key.strategy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

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
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Flux API')
    .setDescription('Flux API — HTTP gateway for Telegram')
    .setVersion('1.0')
    .addBearerAuth()
    .addApiKey(
      { type: 'apiKey', name: API_KEY_HEADER, in: 'header' },
      'api-key',
    )
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
