import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { API_KEY_HEADER } from './modules/auth/strategies/api-key.strategy';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  // --- Security headers ---
  app.use(helmet());

  // --- CORS ---
  const corsOrigin = config.get<string>('CORS_ORIGIN', '*');
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
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
    .addApiKey({ type: 'apiKey', name: API_KEY_HEADER, in: 'header' }, 'api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);

  // Classic Swagger UI at /swagger + raw OpenAPI JSON at /openapi.json (tooling).
  SwaggerModule.setup('swagger', app, document, {
    jsonDocumentUrl: 'openapi.json',
  });

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
