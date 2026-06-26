import type { WebhookStatus } from '../prisma/generated/client';

export type { WebhookStatus };

/** API-facing webhook (never exposes the signing secret). */
export interface WebhookView {
  id: string;
  name: string;
  url: string;
  active: boolean;
  /** When true, delivery may target a private/loopback address (opt-in). */
  allowInternal: boolean;
  events: string[];
  instanceIds: string[];
  createdAt: string;
  updatedAt: string;
}

/** Webhook view returned right after create / secret regeneration (with secret). */
export interface WebhookWithSecret extends WebhookView {
  secret: string;
}

export interface WebhookDeliveryView {
  id: string;
  webhookId: string;
  instanceId?: string;
  event: string;
  status: WebhookStatus;
  attempts: number;
  statusCode?: number;
  lastError?: string;
  /** Truncated response body from the target — diagnostic aid. */
  responseBody?: string;
  /** When the worker will (re)attempt this delivery. */
  nextAttemptAt: string;
  createdAt: string;
  deliveredAt?: string;
}

/** Retry backoff per attempt (seconds); index = attempts already made. */
export const RETRY_BACKOFF_SECONDS = [10, 60, 300, 1800, 7200];

/** Max delivery attempts before a delivery is marked `dead`. */
export const MAX_ATTEMPTS = RETRY_BACKOFF_SECONDS.length + 1;
