import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ENGINE_KEYS } from '../../../core/telegram/engines/engine.types';

const INSTANCE_STATUS = [
  'new',
  'connecting',
  'awaiting_qr',
  'password_required',
  'authorized',
  'disconnected',
  'error',
] as const;

const PEER_TYPES = ['user', 'group', 'channel'] as const;

const MEDIA_TYPES = [
  'none',
  'photo',
  'video',
  'document',
  'audio',
  'sticker',
  'other',
] as const;

/** Public view of a Telegram instance (no secrets). */
export class InstanceEntity {
  @ApiProperty({ example: 'ckinst0001' })
  id!: string;

  @ApiProperty({ example: 'Main account' })
  label!: string;

  @ApiProperty({ enum: ENGINE_KEYS, example: 'gramjs' })
  engine!: string;

  @ApiProperty({
    enum: INSTANCE_STATUS,
    example: 'authorized',
    description: 'Lifecycle status of the instance',
  })
  status!: (typeof INSTANCE_STATUS)[number];

  @ApiPropertyOptional({ example: 'Jane' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'jane_doe' })
  username?: string;

  @ApiPropertyOptional({ example: '+15551234567' })
  phone?: string;

  @ApiPropertyOptional({
    example: '1234567',
    description: 'Non-secret GramJS api_id (api_hash is never exposed)',
  })
  apiId?: string;

  @ApiProperty({ format: 'date-time', example: '2026-06-19T12:00:00.000Z' })
  createdAt!: string;

  @ApiPropertyOptional({
    enum: ['admin', 'owner', 'operator', 'viewer'],
    example: 'owner',
    description: "Caller's effective role on this instance",
  })
  myRole?: 'admin' | 'owner' | 'operator' | 'viewer';
}

/** Instance with live connection state, returned by the info endpoint. */
export class InstanceInfoEntity extends InstanceEntity {
  @ApiProperty({
    example: true,
    description: 'Whether a live client is currently connected',
  })
  connected!: boolean;

  @ApiPropertyOptional({
    example: 3600,
    nullable: true,
    description: 'Seconds connected, or null when offline',
  })
  uptimeSeconds?: number | null;
}

/** Aggregate stats for the dashboard overview. */
export class StatsEntity {
  @ApiProperty({ example: 86400 })
  uptimeSeconds!: number;

  @ApiProperty({
    example: { total: 3, authorized: 2, connected: 2 },
    description: 'Instance counts: total, authorized and live-connected',
  })
  instances!: { total: number; authorized: number; connected: number };
}

/** Non-secret view of the global Telegram credentials. */
export class TelegramSettingsEntity {
  @ApiPropertyOptional({ example: '1234567', description: 'GramJS api_id' })
  apiId?: string;

  @ApiProperty({
    example: true,
    description: 'Whether an api_hash is stored (the value is never returned)',
  })
  hasApiHash!: boolean;
}

/** API-facing chat shape (int64 ids as strings, dates as ISO). */
export class ChatEntity {
  @ApiProperty({ example: 'ckchat0001' })
  id!: string;

  @ApiProperty({ example: '777000', description: 'Telegram peer id' })
  tgPeerId!: string;

  @ApiProperty({ enum: PEER_TYPES, example: 'user' })
  type!: (typeof PEER_TYPES)[number];

  @ApiPropertyOptional({ example: 'Jane Doe' })
  title?: string;

  @ApiPropertyOptional({ example: 'jane_doe' })
  username?: string;

  @ApiProperty({ example: true })
  hasPhoto!: boolean;

  @ApiPropertyOptional({ format: 'date-time' })
  lastMessageAt?: string;
}

/** Attachment metadata (raw bytes fetched from the media endpoint). */
export class MediaEntity {
  @ApiProperty({ enum: MEDIA_TYPES, example: 'photo' })
  type!: (typeof MEDIA_TYPES)[number];

  @ApiPropertyOptional({ example: 'image/jpeg' })
  mimeType?: string;

  @ApiPropertyOptional({ example: 'photo.jpg' })
  fileName?: string;

  @ApiPropertyOptional({ example: 1280 })
  width?: number;

  @ApiPropertyOptional({ example: 720 })
  height?: number;

  @ApiPropertyOptional({ example: 12, description: 'Duration in seconds' })
  duration?: number;
}

/** Sender identity attached to a message (for group chats). */
export class MessageSenderEntity {
  @ApiProperty({ example: '777000' })
  id!: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  name?: string;

  @ApiPropertyOptional({ example: 'jane_doe' })
  username?: string;

  @ApiProperty({ example: true })
  hasPhoto!: boolean;
}

/** API-facing message shape. */
export class MessageEntity {
  @ApiProperty({ example: 'ckmsg0001' })
  id!: string;

  @ApiProperty({ example: 'ckchat0001' })
  chatId!: string;

  @ApiProperty({ example: '42', description: 'Telegram message id' })
  tgMessageId!: string;

  @ApiPropertyOptional({ example: 'Hello from Flux' })
  text?: string;

  @ApiProperty({ example: false, description: 'True when we sent it' })
  outgoing!: boolean;

  @ApiProperty({ format: 'date-time', example: '2026-06-19T12:00:00.000Z' })
  date!: string;

  @ApiPropertyOptional({ example: '777000' })
  senderId?: string;

  @ApiPropertyOptional({ type: MessageSenderEntity })
  sender?: MessageSenderEntity;

  @ApiPropertyOptional({ type: MediaEntity })
  media?: MediaEntity;
}
