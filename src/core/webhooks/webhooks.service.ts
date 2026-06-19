import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../prisma/generated/client';
import type { EventType } from '../telegram/services/telegram-events.service';
import type {
  WebhookDeliveryView,
  WebhookView,
  WebhookWithSecret,
} from './webhook.types';

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  active: boolean;
  events: string[];
  secret: string;
  createdAt: Date;
  updatedAt: Date;
  instances: { instanceId: string }[];
}

interface CreateInput {
  name: string;
  url: string;
  events: string[];
  instanceIds?: string[];
}

interface UpdateInput {
  name?: string;
  url?: string;
  active?: boolean;
  events?: string[];
}

const withInstances = {
  instances: { select: { instanceId: true } },
} satisfies Prisma.WebhookInclude;

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  private newSecret(): string {
    return `whsec_${randomBytes(24).toString('hex')}`;
  }

  private toView(row: WebhookRow): WebhookView {
    return {
      id: row.id,
      name: row.name,
      url: row.url,
      active: row.active,
      events: row.events,
      instanceIds: row.instances.map((i) => i.instanceId),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async create(
    ownerId: string,
    input: CreateInput,
  ): Promise<WebhookWithSecret> {
    const secret = this.newSecret();
    const row = await this.prisma.webhook.create({
      data: {
        ownerId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret,
        instances: input.instanceIds?.length
          ? {
              create: input.instanceIds.map((instanceId) => ({ instanceId })),
            }
          : undefined,
      },
      include: withInstances,
    });
    return { ...this.toView(row), secret };
  }

  async list(ownerId: string): Promise<WebhookView[]> {
    const rows = await this.prisma.webhook.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: withInstances,
    });
    return rows.map((row) => this.toView(row));
  }

  /** Fetches an owned webhook row or throws 404. */
  private async owned(ownerId: string, id: string): Promise<WebhookRow> {
    const row = await this.prisma.webhook.findUnique({
      where: { id },
      include: withInstances,
    });
    if (!row) {
      throw new NotFoundException('Webhook not found');
    }
    if (row.ownerId !== ownerId) {
      throw new ForbiddenException('Not your webhook');
    }
    return row;
  }

  async get(ownerId: string, id: string): Promise<WebhookView> {
    return this.toView(await this.owned(ownerId, id));
  }

  async update(
    ownerId: string,
    id: string,
    patch: UpdateInput,
  ): Promise<WebhookView> {
    await this.owned(ownerId, id);
    const row = await this.prisma.webhook.update({
      where: { id },
      data: {
        name: patch.name,
        url: patch.url,
        active: patch.active,
        events: patch.events,
      },
      include: withInstances,
    });
    return this.toView(row);
  }

  async remove(ownerId: string, id: string): Promise<void> {
    await this.owned(ownerId, id);
    await this.prisma.webhook.delete({ where: { id } });
  }

  async regenerateSecret(
    ownerId: string,
    id: string,
  ): Promise<WebhookWithSecret> {
    await this.owned(ownerId, id);
    const secret = this.newSecret();
    const row = await this.prisma.webhook.update({
      where: { id },
      data: { secret },
      include: withInstances,
    });
    return { ...this.toView(row), secret };
  }

  async linkInstance(
    ownerId: string,
    id: string,
    instanceId: string,
  ): Promise<WebhookView> {
    await this.owned(ownerId, id);
    const instance = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: { id: true },
    });
    if (!instance) {
      throw new NotFoundException('Instance not found');
    }
    await this.prisma.webhookInstance.upsert({
      where: { webhookId_instanceId: { webhookId: id, instanceId } },
      create: { webhookId: id, instanceId },
      update: {},
    });
    return this.get(ownerId, id);
  }

  async unlinkInstance(
    ownerId: string,
    id: string,
    instanceId: string,
  ): Promise<WebhookView> {
    await this.owned(ownerId, id);
    await this.prisma.webhookInstance.deleteMany({
      where: { webhookId: id, instanceId },
    });
    return this.get(ownerId, id);
  }

  // --- Deliveries ---

  private toDeliveryView(row: {
    id: string;
    webhookId: string;
    instanceId: string | null;
    event: string;
    status: WebhookDeliveryView['status'];
    attempts: number;
    statusCode: number | null;
    lastError: string | null;
    createdAt: Date;
    deliveredAt: Date | null;
  }): WebhookDeliveryView {
    return {
      id: row.id,
      webhookId: row.webhookId,
      instanceId: row.instanceId ?? undefined,
      event: row.event,
      status: row.status,
      attempts: row.attempts,
      statusCode: row.statusCode ?? undefined,
      lastError: row.lastError ?? undefined,
      createdAt: row.createdAt.toISOString(),
      deliveredAt: row.deliveredAt?.toISOString(),
    };
  }

  async listDeliveries(
    ownerId: string,
    id: string,
    limit = 50,
  ): Promise<WebhookDeliveryView[]> {
    await this.owned(ownerId, id);
    const rows = await this.prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 200),
    });
    return rows.map((row) => this.toDeliveryView(row));
  }

  /** Re-queues a delivery (owner-scoped) for an immediate retry. */
  async resendDelivery(
    ownerId: string,
    deliveryId: string,
  ): Promise<WebhookDeliveryView> {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: { select: { ownerId: true } } },
    });
    if (!delivery) {
      throw new NotFoundException('Delivery not found');
    }
    if (delivery.webhook.ownerId !== ownerId) {
      throw new ForbiddenException('Not your delivery');
    }
    const row = await this.prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: 'pending', nextAttemptAt: new Date(), lastError: null },
    });
    return this.toDeliveryView(row);
  }

  // --- Dispatcher helpers (not owner-scoped; internal) ---

  /** Active webhooks for an instance that subscribe to the given event type. */
  async matchingWebhooks(
    instanceId: string,
    type: EventType,
  ): Promise<{ id: string }[]> {
    return this.prisma.webhook.findMany({
      where: {
        active: true,
        events: { has: type },
        instances: { some: { instanceId } },
      },
      select: { id: true },
    });
  }
}
