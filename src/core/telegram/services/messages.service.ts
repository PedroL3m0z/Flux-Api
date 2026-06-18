import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { NormalizedMessage } from '../engines/engine.types';
import type { MessageView } from '../views';

export interface MessagePage {
  items: MessageView[];
  nextCursor: string | null;
}

@Injectable()
export class MessagesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upserts a message by its per-instance (chat, tgMessageId) natural key. */
  async upsert(
    instanceId: string,
    chatId: string,
    senderId: string | null,
    msg: NormalizedMessage,
  ): Promise<string> {
    const tgMessageId = BigInt(msg.tgMessageId);
    const date = new Date(msg.date * 1000);
    const row = await this.prisma.message.upsert({
      where: {
        instanceId_chatId_tgMessageId: { instanceId, chatId, tgMessageId },
      },
      create: {
        instanceId,
        chatId,
        tgMessageId,
        senderId,
        outgoing: msg.outgoing,
        text: msg.text,
        date,
        replyToTgId: msg.replyToTgId ? BigInt(msg.replyToTgId) : null,
      },
      update: { text: msg.text },
      select: { id: true },
    });
    return row.id;
  }

  /** Messages of a chat, newest first, cursor-paginated by message id. */
  async listByChat(
    instanceId: string,
    chatId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<MessagePage> {
    const take = Math.min(opts.limit ?? 30, 100);
    const rows = await this.prisma.message.findMany({
      where: { instanceId, chatId },
      orderBy: { date: 'desc' },
      take: take + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > take;
    const items = rows.slice(0, take).map((row) => ({
      id: row.id,
      chatId: row.chatId,
      tgMessageId: row.tgMessageId.toString(),
      text: row.text ?? undefined,
      outgoing: row.outgoing,
      date: row.date.toISOString(),
      senderId: row.senderId ?? undefined,
    }));
    return {
      items,
      nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    };
  }
}
