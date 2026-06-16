import { HealthIndicatorService } from '@nestjs/terminus';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PrismaHealthIndicator } from './prisma.health';

describe('PrismaHealthIndicator', () => {
  let indicator: PrismaHealthIndicator;
  let prisma: { $queryRaw: jest.Mock };
  let up: jest.Mock;
  let down: jest.Mock;

  beforeEach(() => {
    up = jest.fn().mockReturnValue({ postgres: { status: 'up' } });
    down = jest.fn().mockReturnValue({ postgres: { status: 'down' } });
    const healthIndicatorService = {
      check: jest.fn().mockReturnValue({ up, down }),
    } as unknown as HealthIndicatorService;
    prisma = { $queryRaw: jest.fn() };
    indicator = new PrismaHealthIndicator(
      healthIndicatorService,
      prisma as unknown as PrismaService,
    );
  });

  it('reports up when SELECT 1 succeeds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const result = await indicator.isHealthy('postgres');

    expect(up).toHaveBeenCalled();
    expect(down).not.toHaveBeenCalled();
    expect(result).toEqual({ postgres: { status: 'up' } });
  });

  it('reports down with the error message when the query throws', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await indicator.isHealthy('postgres');

    expect(down).toHaveBeenCalledWith({ message: 'connection refused' });
  });

  it('reports down with a fallback message for non-Error throws', async () => {
    prisma.$queryRaw.mockRejectedValue('boom');

    await indicator.isHealthy('postgres');

    expect(down).toHaveBeenCalledWith({ message: 'unreachable' });
  });
});
