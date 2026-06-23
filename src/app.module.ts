// Side-effect import: generates/derives DATABASE_URL and managed secrets into
// process.env BEFORE ConfigModule.forRoot (below) validates the environment.
// Must stay first so the env is populated when `forRoot` runs eagerly.
import './config/runtime';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.validation';
import { AuthzModule } from './common/authz/authz.module';
import { PrismaModule } from './core/prisma/prisma.module';
import { RedisModule } from './core/redis/redis.module';
import { TelegramModule } from './core/telegram/telegram.module';
import { WebhooksModule } from './core/webhooks/webhooks.module';
import { TelegramModule as TelegramHttpModule } from './modules/telegram/telegram.module';
import { WebhooksModule as WebhooksHttpModule } from './modules/webhooks/webhooks.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { GlobalApiKeyGuard } from './modules/auth/guards/global-api-key.guard';
import { HealthModule } from './modules/health/health.module';
import { SeedModule } from './modules/seed/seed.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthzModule,
    TelegramModule,
    WebhooksModule,
    HealthModule,
    UsersModule,
    AuthModule,
    TelegramHttpModule,
    WebhooksHttpModule,
    DashboardModule,
    SeedModule,
  ],
  providers: [
    // Global rate limiting
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global JWT auth (routes opt out with @Public())
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global API-key requirement (routes opt out with @Public()/@NoApiKey())
    { provide: APP_GUARD, useClass: GlobalApiKeyGuard },
  ],
})
export class AppModule {}
