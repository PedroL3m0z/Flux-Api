import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { ChatsService } from '../../core/telegram/services/chats.service';
import {
  MessagesService,
  type MessagePage,
} from '../../core/telegram/services/messages.service';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { TelegramSyncService } from '../../core/telegram/services/telegram-sync.service';
import type { ChatView, MessageView } from '../../core/telegram/views';

/** API orchestration for chats and messages over a connected instance. */
@Injectable()
export class MessagingService {
  constructor(
    private readonly manager: TelegramManager,
    private readonly chats: ChatsService,
    private readonly messages: MessagesService,
    private readonly sync: TelegramSyncService,
  ) {}

  listChats(instanceId: string): Promise<ChatView[]> {
    return this.chats.listByInstance(instanceId);
  }

  listMessages(
    instanceId: string,
    chatId: string,
    opts: { cursor?: string; limit?: number },
  ): Promise<MessagePage> {
    return this.messages.listByChat(instanceId, chatId, opts);
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
    const sent = await client.sendMessage(peer, text);
    const view = await this.sync.ingest(instanceId, sent);
    if (!view) {
      throw new ServiceUnavailableException(
        'Failed to persist the sent message',
      );
    }
    return view;
  }
}
