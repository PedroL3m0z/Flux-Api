import { Subject } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import {
  TelegramEventBus,
  type DomainEvent,
} from '../telegram/services/telegram-events.service';
import { WebhooksService } from './webhooks.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

const make = () => {
  const subject = new Subject<DomainEvent>();
  const bus = { events$: () => subject.asObservable() } as TelegramEventBus;
  const webhooks = {
    matchingWebhooks: jest.fn(),
  } as unknown as WebhooksService;
  const prisma = {
    webhookDelivery: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const dispatcher = new WebhookDispatcherService(
    bus,
    webhooks,
    prisma as unknown as PrismaService,
  );
  dispatcher.onModuleInit();
  return { subject, webhooks, prisma, dispatcher };
};

const event: DomainEvent = {
  instanceId: 'i1',
  type: 'message.new',
  at: '2026-01-01T00:00:00.000Z',
  payload: { message: { id: 'm1' } },
};

describe('WebhookDispatcherService', () => {
  it('creates a delivery per matching webhook', async () => {
    const { subject, webhooks, prisma, dispatcher } = make();
    (webhooks.matchingWebhooks as jest.Mock).mockResolvedValue([
      { id: 'w1' },
      { id: 'w2' },
    ]);

    subject.next(event);
    await flush();

    const calls = prisma.webhookDelivery.createMany.mock.calls as Array<
      [{ data: Array<Record<string, unknown>> }]
    >;
    const arg = calls[0][0];
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0]).toMatchObject({
      webhookId: 'w1',
      instanceId: 'i1',
      event: 'message.new',
      status: 'pending',
    });
    dispatcher.onModuleDestroy();
  });

  it('does nothing when no webhook matches', async () => {
    const { subject, webhooks, prisma, dispatcher } = make();
    (webhooks.matchingWebhooks as jest.Mock).mockResolvedValue([]);

    subject.next(event);
    await flush();

    expect(prisma.webhookDelivery.createMany).not.toHaveBeenCalled();
    dispatcher.onModuleDestroy();
  });
});
