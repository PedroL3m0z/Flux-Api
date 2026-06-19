import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { ChatsService } from '../../core/telegram/services/chats.service';
import { ContactsService } from '../../core/telegram/services/contacts.service';
import {
  MessagesService,
  type MessagePage,
} from '../../core/telegram/services/messages.service';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { TelegramSyncService } from '../../core/telegram/services/telegram-sync.service';
import type {
  MediaBlob,
  UploadedMedia,
} from '../../core/telegram/engines/engine.types';
import type { ChatView, MessageView } from '../../core/telegram/views';

/** API orchestration for chats and messages over a connected instance. */
@Injectable()
export class MessagingService {
  constructor(
    private readonly manager: TelegramManager,
    private readonly chats: ChatsService,
    private readonly contacts: ContactsService,
    private readonly messages: MessagesService,
    private readonly sync: TelegramSyncService,
  ) {}

  listChats(instanceId: string): Promise<ChatView[]> {
    return this.chats.listByInstance(instanceId);
  }

  async listMessages(
    instanceId: string,
    chatId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<MessagePage> {
    // First open: pull recent history from Telegram so a chat shows the whole
    // conversation, not just the single last message captured at backfill.
    if (!opts.cursor) {
      await this.pullHistory(instanceId, chatId);
    }

    let page = await this.messages.listByChat(instanceId, chatId, opts);

    // Reached the end of what's stored: fetch older messages from Telegram once
    // and re-read, so "load more" walks back through real history.
    if (!page.nextCursor && page.items.length > 0) {
      const oldest = page.items[page.items.length - 1].tgMessageId;
      const fetched = await this.pullHistory(instanceId, chatId, oldest);
      if (fetched > 0) {
        page = await this.messages.listByChat(instanceId, chatId, opts);
      }
    }

    return page;
  }

  /** Downloads a chat/group/contact-chat avatar; null when unavailable. */
  async chatPhoto(
    instanceId: string,
    chatId: string,
  ): Promise<MediaBlob | null> {
    const client = this.manager.getClient(instanceId);
    if (!client?.downloadAvatar) {
      return null;
    }
    const peer = await this.chats.getPeerRef(instanceId, chatId);
    if (!peer) {
      return null;
    }
    return client.downloadAvatar(peer).catch(() => null);
  }

  /** Downloads a contact's avatar (e.g. a group-message sender). */
  async contactPhoto(
    instanceId: string,
    contactId: string,
  ): Promise<MediaBlob | null> {
    const client = this.manager.getClient(instanceId);
    if (!client?.downloadAvatar) {
      return null;
    }
    const peer = await this.contacts.getPeerRef(instanceId, contactId);
    if (!peer) {
      return null;
    }
    return client.downloadAvatar(peer).catch(() => null);
  }

  /** Downloads a message's attachment bytes; null when unavailable. */
  async messageMedia(
    instanceId: string,
    chatId: string,
    tgMessageId: string,
  ): Promise<MediaBlob | null> {
    const client = this.manager.getClient(instanceId);
    if (!client?.downloadMessageMedia) {
      return null;
    }
    const peer = await this.chats.getPeerRef(instanceId, chatId);
    if (!peer) {
      return null;
    }
    return client.downloadMessageMedia(peer, tgMessageId).catch(() => null);
  }

  /**
   * Fetches history from the live client and persists it. Best-effort: if the
   * instance is offline or has no messaging capability, returns 0 so the DB is
   * still served.
   */
  private async pullHistory(
    instanceId: string,
    chatId: string,
    beforeId?: string,
  ): Promise<number> {
    const client = this.manager.getClient(instanceId);
    if (!client?.getHistory) {
      return 0;
    }
    const peer = await this.chats.getPeerRef(instanceId, chatId);
    if (!peer) {
      return 0;
    }
    try {
      const history = await client.getHistory(peer, { limit: 50, beforeId });
      return await this.sync.ingestHistory(instanceId, chatId, history);
    } catch (error) {
      void this.manager.reportClientError(instanceId, error);
      return 0;
    }
  }

  stream(instanceId: string): Observable<MessageView> {
    return this.sync.messages$(instanceId);
  }

  async send(
    instanceId: string,
    chatId: string,
    text: string,
  ): Promise<MessageView> {
    const client = this.manager.getClient(instanceId);
    if (!client?.sendMessage) {
      throw new ServiceUnavailableException('Instance is not connected');
    }
    const peer = await this.chats.getPeerRef(instanceId, chatId);
    if (!peer) {
      throw new NotFoundException('Chat not found');
    }
    try {
      const sent = await client.sendMessage(peer, text);
      const view = await this.sync.ingest(instanceId, sent);
      if (!view) {
        throw new ServiceUnavailableException(
          'Failed to persist the sent message',
        );
      }
      return view;
    } catch (error) {
      void this.manager.reportClientError(instanceId, error);
      throw error;
    }
  }

  async sendMedia(
    instanceId: string,
    chatId: string,
    file: UploadedMedia,
    caption?: string,
  ): Promise<MessageView> {
    const client = this.manager.getClient(instanceId);
    if (!client?.sendMedia) {
      throw new ServiceUnavailableException('Instance is not connected');
    }
    const peer = await this.chats.getPeerRef(instanceId, chatId);
    if (!peer) {
      throw new NotFoundException('Chat not found');
    }
    try {
      const sent = await client.sendMedia(peer, file, caption);
      const view = await this.sync.ingest(instanceId, sent);
      if (!view) {
        throw new ServiceUnavailableException(
          'Failed to persist the sent message',
        );
      }
      return view;
    } catch (error) {
      void this.manager.reportClientError(instanceId, error);
      throw error;
    }
  }
}
