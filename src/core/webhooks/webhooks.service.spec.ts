import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from './webhooks.service';

const row = {
  id: 'w1',
  ownerId: 'u1',
  name: 'hook',
  url: 'https://x.test',
  active: true,
  events: ['message.new'],
  secret: 'whsec_abc',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  instances: [{ instanceId: 'i1' }],
};

const make = () => {
  const prisma = {
    webhook: {
      create: jest.fn().mockResolvedValue(row),
      findMany: jest.fn().mockResolvedValue([row]),
      findUnique: jest.fn().mockResolvedValue(row),
      update: jest.fn().mockResolvedValue(row),
      delete: jest.fn().mockResolvedValue(row),
    },
    webhookInstance: { upsert: jest.fn(), deleteMany: jest.fn() },
    webhookDelivery: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    instance: { findUnique: jest.fn().mockResolvedValue({ id: 'i1' }) },
  };
  const service = new WebhooksService(prisma as unknown as PrismaService);
  return { service, prisma };
};

describe('WebhooksService', () => {
  it('create generates a secret and returns it once', async () => {
    const { service, prisma } = make();
    const result = await service.create('u1', {
      name: 'hook',
      url: 'https://x.test',
      events: ['message.new'],
    });
    const calls = prisma.webhook.create.mock.calls as Array<
      [{ data: { secret: string } }]
    >;
    const call = calls[0][0];
    expect(call.data.secret).toMatch(/^whsec_/);
    // The freshly generated secret is returned to the caller (once).
    expect(result.secret).toBe(call.data.secret);
    expect(result.instanceIds).toEqual(['i1']);
  });

  it('list view never exposes the secret', async () => {
    const { service } = make();
    const [view] = await service.list('u1');
    expect(view).not.toHaveProperty('secret');
  });

  it('matchingWebhooks filters by active + event + instance', async () => {
    const { service, prisma } = make();
    await service.matchingWebhooks('i1', 'message.read');
    expect(prisma.webhook.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        events: { has: 'message.read' },
        instances: { some: { instanceId: 'i1' } },
      },
      select: { id: true },
    });
  });

  it('forbids accessing another owner webhook', async () => {
    const { service, prisma } = make();
    prisma.webhook.findUnique.mockResolvedValue({
      ...row,
      ownerId: 'other',
    });
    await expect(service.get('u1', 'w1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('404s when resending an unknown delivery', async () => {
    const { service, prisma } = make();
    prisma.webhookDelivery.findUnique.mockResolvedValue(null);
    await expect(service.resendDelivery('u1', 'd1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
