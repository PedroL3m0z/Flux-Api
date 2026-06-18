import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { NormalizedChat, PeerRef } from '../engines/engine.types';
import type { ChatView } from '../views';

@Injectable()
export class ChatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Chats of an instance, most recently active first. */
  async listByInstance(instanceId: string): Promise<ChatView[]> {
    const rows = await this.prisma.chat.findMany({
      where: { instanceId },
      orderBy: [
        { lastMessageAt: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
    return rows.map((row) => ({
      id: row.id,
      tgPeerId: row.tgPeerId.toString(),
      type: row.type,
      title: row.title ?? undefined,
      username: row.username ?? undefined,
      hasPhoto: row.hasPhoto,
      lastMessageAt: row.lastMessageAt?.toISOString(),
    }));
  }

  /** Peer reference (for sending / history), scoped to the instance. */
  async getPeerRef(
    instanceId: string,
    chatId: string,
  ): Promise<PeerRef | null> {
    const row = await this.prisma.chat.findFirst({
      where: { id: chatId, instanceId },
      select: { tgPeerId: true, type: true, accessHash: true },
    });
    if (!row) {
      return null;
    }
    return {
      tgPeerId: row.tgPeerId.toString(),
      type: row.type,
      accessHash: row.accessHash?.toString(),
    };
  }

  /** Upserts a chat (dialog) by its per-instance natural key. */
  async upsert(instanceId: string, chat: NormalizedChat): Promise<string> {
    const tgPeerId = BigInt(chat.tgPeerId);
    const accessHash = chat.accessHash ? BigInt(chat.accessHash) : undefined;
    const row = await this.prisma.chat.upsert({
      where: { instanceId_tgPeerId: { instanceId, tgPeerId } },
      create: {
        instanceId,
        tgPeerId,
        type: chat.type,
        accessHash: accessHash ?? null,
        title: chat.title,
        username: chat.username,
        hasPhoto: chat.hasPhoto ?? false,
      },
      update: {
        type: chat.type,
        accessHash,
        title: chat.title,
        username: chat.username,
        hasPhoto: chat.hasPhoto,
      },
      select: { id: true },
    });
    return row.id;
  }

  /**
   * Bumps the last-activity timestamp used to order the chat list. Only moves
   * forward, so backfilling old history never drags a chat down the list.
   */
  async touch(chatId: string, lastMessageAt: Date): Promise<void> {
    await this.prisma.chat.updateMany({
      where: {
        id: chatId,
        OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: lastMessageAt } }],
      },
      data: { lastMessageAt },
    });
  }
}
