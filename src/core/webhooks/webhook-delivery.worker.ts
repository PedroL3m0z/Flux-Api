import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { signPayload } from './webhook-signature';
import { MAX_ATTEMPTS, RETRY_BACKOFF_SECONDS } from './webhook.types';

const POLL_MS = 5000;
const BATCH = 20;
const TIMEOUT_MS = 10000;

interface DueDelivery {
  id: string;
  event: string;
  instanceId: string | null;
  attempts: number;
  payload: unknown;
  webhook: { url: string; secret: string; active: boolean };
}

/**
 * Drains pending/failed webhook deliveries from the Postgres outbox: signs the
 * payload (HMAC), POSTs it, and on failure schedules a backoff retry until the
 * attempt budget is exhausted (then `dead`).
 */
@Injectable()
export class WebhookDeliveryWorker
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WebhookDeliveryWorker.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.tick(), POLL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  private async tick(): Promise<void> {
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      const due = (await this.prisma.webhookDelivery.findMany({
        where: {
          status: { in: ['pending', 'failed'] },
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: BATCH,
        include: {
          webhook: { select: { url: true, secret: true, active: true } },
        },
      })) as DueDelivery[];
      for (const delivery of due) {
        await this.deliver(delivery);
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Webhook worker tick failed: ${reason}`);
    } finally {
      this.running = false;
    }
  }

  private async deliver(delivery: DueDelivery): Promise<void> {
    if (!delivery.webhook.active) {
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { status: 'dead', lastError: 'webhook inactive' },
      });
      return;
    }

    const body = JSON.stringify(delivery.payload);
    let statusCode: number | undefined;
    try {
      const res = await fetch(delivery.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Flux-Webhooks/1.0',
          'X-Flux-Event': delivery.event,
          'X-Flux-Delivery': delivery.id,
          ...(delivery.instanceId
            ? { 'X-Flux-Instance': delivery.instanceId }
            : {}),
          'X-Flux-Signature': signPayload(delivery.webhook.secret, body),
        },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      statusCode = res.status;
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'success',
          statusCode,
          attempts: delivery.attempts + 1,
          deliveredAt: new Date(),
          lastError: null,
        },
      });
    } catch (error) {
      await this.fail(delivery, error, statusCode);
    }
  }

  private async fail(
    delivery: DueDelivery,
    error: unknown,
    statusCode?: number,
  ): Promise<void> {
    const attempts = delivery.attempts + 1;
    const message = error instanceof Error ? error.message : 'unknown error';
    const backoff = RETRY_BACKOFF_SECONDS[delivery.attempts];
    const dead = attempts >= MAX_ATTEMPTS || backoff === undefined;
    await this.prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: dead ? 'dead' : 'failed',
        attempts,
        statusCode: statusCode ?? null,
        lastError: message,
        nextAttemptAt: dead ? undefined : new Date(Date.now() + backoff * 1000),
      },
    });
  }
}
