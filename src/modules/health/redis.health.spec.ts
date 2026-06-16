import { HealthIndicatorService } from '@nestjs/terminus';
import { RedisService } from '../../core/redis/redis.service';
import { RedisHealthIndicator } from './redis.health';

describe('RedisHealthIndicator', () => {
  let indicator: RedisHealthIndicator;
  let redis: { ping: jest.Mock };
  let up: jest.Mock;
  let down: jest.Mock;

  beforeEach(() => {
    up = jest.fn().mockReturnValue({ redis: { status: 'up' } });
    down = jest.fn().mockReturnValue({ redis: { status: 'down' } });
    const healthIndicatorService = {
      check: jest.fn().mockReturnValue({ up, down }),
    } as unknown as HealthIndicatorService;
    redis = { ping: jest.fn() };
    indicator = new RedisHealthIndicator(
      healthIndicatorService,
      redis as unknown as RedisService,
    );
  });

  it('reports up when ping replies PONG', async () => {
    redis.ping.mockResolvedValue('PONG');

    await indicator.isHealthy('redis');

    expect(up).toHaveBeenCalled();
    expect(down).not.toHaveBeenCalled();
  });

  it('reports down on an unexpected ping reply', async () => {
    redis.ping.mockResolvedValue('NOPE');

    await indicator.isHealthy('redis');

    expect(down).toHaveBeenCalledWith({
      message: 'Unexpected ping reply: NOPE',
    });
  });

  it('reports down with the error message when ping throws', async () => {
    redis.ping.mockRejectedValue(new Error('redis down'));

    await indicator.isHealthy('redis');

    expect(down).toHaveBeenCalledWith({ message: 'redis down' });
  });
});
