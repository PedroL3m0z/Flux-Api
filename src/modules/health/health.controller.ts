import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';
import { TelegramHealthIndicator } from './telegram.health';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly telegram: TelegramHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @Public()
  @SkipThrottle()
  @HealthCheck()
  @ApiOperation({
    summary: 'Liveness/readiness check',
    description:
      'Aggregates Postgres, Redis, Telegram and heap-memory indicators. 200 when all up, 503 otherwise.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        status: 'ok',
        info: { postgres: { status: 'up' }, redis: { status: 'up' } },
        error: {},
        details: { postgres: { status: 'up' }, redis: { status: 'up' } },
      },
    },
  })
  check() {
    return this.health.check([
      () => this.prisma.isHealthy('postgres'),
      () => this.redis.isHealthy('redis'),
      () => this.telegram.isHealthy('telegram'),
      () => this.memory.checkHeap('memory_heap', 256 * 1024 * 1024),
    ]);
  }
}
