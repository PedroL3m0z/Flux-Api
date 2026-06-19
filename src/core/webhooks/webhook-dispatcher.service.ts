import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type { Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../prisma/generated/client';
import {
  TelegramEventBus,
  type DomainEvent,
} from '../telegram/services/telegram-events.service';
import { WebhooksService } from './webhooks.service';

/**
 * Subscribes to the domain event bus and turns each event into pending
 * `WebhookDelivery` rows (one per matching webhook). The worker drains them.
 */
@Injectable()
export class WebhookDispatcherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private sub?: Subscription;

  constructor(
    private readonly bus: TelegramEventBus,
    private readonly webhooks: WebhooksService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    this.sub = this.bus.events$().subscribe((event) => {
      void this.onEvent(event);
    });
  }

  onModuleDestroy(): void {
    this.sub?.unsubscribe();
  }

  private async onEvent(event: DomainEvent): Promise<void> {
    try {
      const matches = await this.webhooks.matchingWebhooks(
        event.instanceId,
        event.type,
      );
      if (matches.length === 0) {
        return;
      }
      const body = {
        event: event.type,
        instanceId: event.instanceId,
        at: event.at,
        data: event.payload,
      };
      await this.prisma.webhookDelivery.createMany({
        data: matches.map((webhook) => ({
          webhookId: webhook.id,
          instanceId: event.instanceId,
          event: event.type,
          payload: body as unknown as Prisma.InputJsonValue,
          status: 'pending' as const,
          nextAttemptAt: new Date(),
        })),
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Dispatch failed for ${event.type}: ${reason}`);
    }
  }
}
