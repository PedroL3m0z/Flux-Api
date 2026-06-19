import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EVENT_TYPES } from '../../../core/telegram/services/telegram-events.service';

/** Delivery lifecycle status (mirrors the Prisma `WebhookStatus` enum). */
export const WEBHOOK_DELIVERY_STATUS = [
  'pending',
  'success',
  'failed',
  'dead',
] as const;

/** A webhook as returned by the API. The signing secret is never included. */
export class WebhookEntity {
  @ApiProperty({ example: 'ckw1a2b3c0001', description: 'Webhook id' })
  id!: string;

  @ApiProperty({ example: 'My integration', description: 'Human label' })
  name!: string;

  @ApiProperty({
    example: 'https://example.com/hooks/flux',
    description: 'Destination URL that receives the POST callbacks',
  })
  url!: string;

  @ApiProperty({
    example: true,
    description: 'When false the webhook is muted and fires nothing',
  })
  active!: boolean;

  @ApiProperty({
    enum: EVENT_TYPES,
    isArray: true,
    description: 'Event types this webhook is subscribed to',
    example: ['message.new', 'message.read'],
  })
  events!: string[];

  @ApiProperty({
    type: [String],
    description: 'Ids of the instances linked to this webhook (M2M)',
    example: ['ckinst0001'],
  })
  instanceIds!: string[];

  @ApiProperty({ format: 'date-time', example: '2026-06-19T12:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time', example: '2026-06-19T12:00:00.000Z' })
  updatedAt!: string;
}

/**
 * Webhook returned right after creation or secret rotation. Includes the signing
 * `secret` — shown exactly once; store it to verify the `X-Flux-Signature` HMAC.
 */
export class WebhookWithSecretEntity extends WebhookEntity {
  @ApiProperty({
    example: 'whsec_3f9a…',
    description:
      'HMAC-SHA256 signing secret. Returned only on create / regenerate-secret — never again.',
  })
  secret!: string;
}

/** One delivery attempt record (queue + audit log entry). */
export class WebhookDeliveryEntity {
  @ApiProperty({ example: 'ckdlv0001' })
  id!: string;

  @ApiProperty({ example: 'ckw1a2b3c0001' })
  webhookId!: string;

  @ApiPropertyOptional({
    example: 'ckinst0001',
    description: 'Instance that produced the event, when applicable',
  })
  instanceId?: string;

  @ApiProperty({
    enum: EVENT_TYPES,
    example: 'message.new',
    description: 'Event type carried by this delivery',
  })
  event!: string;

  @ApiProperty({
    enum: WEBHOOK_DELIVERY_STATUS,
    example: 'success',
    description:
      'pending → not yet sent; success → 2xx received; failed → will retry; dead → gave up after max attempts',
  })
  status!: (typeof WEBHOOK_DELIVERY_STATUS)[number];

  @ApiProperty({ example: 1, description: 'Number of POST attempts made' })
  attempts!: number;

  @ApiPropertyOptional({
    example: 200,
    description: 'HTTP status of the last attempt',
  })
  statusCode?: number;

  @ApiPropertyOptional({
    example: 'connect ECONNREFUSED',
    description: 'Error message from the last failed attempt',
  })
  lastError?: string;

  @ApiProperty({ format: 'date-time', example: '2026-06-19T12:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-06-19T12:00:01.000Z',
    description: 'When a 2xx was received',
  })
  deliveredAt?: string;
}
