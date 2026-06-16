import { HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let prisma: { isHealthy: jest.Mock };
  let redis: { isHealthy: jest.Mock };
  let memory: { checkHeap: jest.Mock };
  let captured: Array<() => unknown>;

  beforeEach(() => {
    captured = [];
    health = {
      check: jest.fn((indicators: Array<() => unknown>) => {
        captured = indicators;
        return Promise.resolve({ status: 'ok' });
      }),
    };
    prisma = { isHealthy: jest.fn() };
    redis = { isHealthy: jest.fn() };
    memory = { checkHeap: jest.fn() };
    controller = new HealthController(
      health as unknown as HealthCheckService,
      prisma as unknown as PrismaHealthIndicator,
      redis as unknown as RedisHealthIndicator,
      memory as unknown as MemoryHealthIndicator,
    );
  });

  it('runs the postgres, redis and memory indicators', async () => {
    const result = await controller.check();

    expect(health.check).toHaveBeenCalledTimes(1);
    expect(captured).toHaveLength(3);

    captured.forEach((fn) => fn());
    expect(prisma.isHealthy).toHaveBeenCalledWith('postgres');
    expect(redis.isHealthy).toHaveBeenCalledWith('redis');
    expect(memory.checkHeap).toHaveBeenCalledWith(
      'memory_heap',
      256 * 1024 * 1024,
    );
    expect(result).toEqual({ status: 'ok' });
  });
});
