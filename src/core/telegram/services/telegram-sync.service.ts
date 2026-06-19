import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';
import { ChatsService } from './chats.service';
import { ContactsService } from './contacts.service';
import { MessagesService } from './messages.service';
import { TelegramEventBus } from './telegram-events.service';
import type {
  DialogSnapshot,
  EngineClient,
  NormalizedEvent,
  NormalizedMessage,
} from '../engines/engine.types';
import type { MessageView, StreamMessage } from '../views';

/**
 * Ingests Telegram data (dialogs, contacts, messages) into Postgres and exposes
 * a realtime stream of newly ingested messages.
 *
 * - Backfill: a snapshot of dialogs when an instance becomes authorized.
 * - Realtime: subscribes to incoming messages and upserts + streams them.
 *
 * Writes are idempotent upserts on the per-instance natural keys, and a chat is
 * always upserted before its messages, so backfill and realtime can overlap
 * without violating referential integrity.
 */
@Injectable()
export class TelegramSyncService {
  private readonly logger = new Logger(TelegramSyncService.name);
  private readonly unsubscribers = new Map<string, () => void>();
  private readonly incoming = new Subject<StreamMessage>();

  constructor(
    private readonly chats: ChatsService,
    private readonly contacts: ContactsService,
    private readonly messages: MessagesService,
    private readonly events: TelegramEventBus,
  ) {}

  /** Realtime stream of messages ingested for an instance. */
  messages$(instanceId: string): Observable<MessageView> {
    return this.incoming.asObservable().pipe(
      filter((event) => event.instanceId === instanceId),
      map((event) => event.message),
    );
  }

  /** Called once an instance's client is authorized/connected. Non-throwing. */
  async onAuthorized(instanceId: string, client: EngineClient): Promise<void> {
    try {
      this.registerRealtime(instanceId, client);
      await this.backfill(instanceId, client);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Sync failed for ${instanceId}: ${message}`);
    }
  }

  /**
   * Persists a single message and streams it (realtime + sent messages).
   * Returns the persisted view, or undefined if persistence failed.
   */
  async ingest(
    instanceId: string,
    message: NormalizedMessage,
  ): Promise<MessageView | undefined> {
    const view = await this.persist(instanceId, message);
    if (view) {
      this.incoming.next({ instanceId, message: view });
    }
    return view;
  }

  /** Persists a message (chat + message upsert) without streaming it. */
  private async persist(
    instanceId: string,
    message: NormalizedMessage,
  ): Promise<MessageView | undefined> {
    try {
      const chatId = await this.chats.upsert(instanceId, message.chat);
      return await this.persistMessage(instanceId, chatId, message);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Persist failed for ${instanceId}: ${reason}`);
      return undefined;
    }
  }

  /**
   * Persists a batch of historical messages for a known chat without emitting
   * them on the realtime stream. Used for on-demand history backfill.
   * Returns how many were persisted.
   */
  async ingestHistory(
    instanceId: string,
    chatId: string,
    messages: NormalizedMessage[],
  ): Promise<number> {
    let count = 0;
    for (const message of messages) {
      try {
        await this.persistMessage(instanceId, chatId, message);
        count++;
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'unknown error';
        this.logger.warn(`History ingest skipped for ${instanceId}: ${reason}`);
      }
    }
    return count;
  }

  /** Stops the realtime subscription for an instance (on disconnect/remove). */
  stop(instanceId: string): void {
    const unsub = this.unsubscribers.get(instanceId);
    if (unsub) {
      unsub();
      this.unsubscribers.delete(instanceId);
    }
  }

  private async backfill(
    instanceId: string,
    client: EngineClient,
  ): Promise<void> {
    if (!client.listDialogs) {
      return;
    }
    const dialogs = await client.listDialogs(50);
    for (const dialog of dialogs) {
      await this.ingestDialog(instanceId, dialog);
    }
    this.logger.log(`Backfilled ${dialogs.length} dialog(s) for ${instanceId}`);
  }

  private registerRealtime(instanceId: string, client: EngineClient): void {
    if (!client.onEvent) {
      return;
    }
    this.stop(instanceId);
    const unsub = client.onEvent((event) => {
      void this.handleEvent(instanceId, event);
    });
    this.unsubscribers.set(instanceId, unsub);
  }

  /** Routes a realtime engine event: persists messages, fans all out to the bus. */
  private async handleEvent(
    instanceId: string,
    event: NormalizedEvent,
  ): Promise<void> {
    try {
      switch (event.type) {
        case 'message.new': {
          const view = await this.ingest(instanceId, event.message);
          if (view) {
            this.events.publish({
              instanceId,
              type: 'message.new',
              payload: { message: view },
            });
          }
          break;
        }
        case 'message.edited': {
          const view = await this.persist(instanceId, event.message);
          if (view) {
            this.events.publish({
              instanceId,
              type: 'message.edited',
              payload: { message: view },
            });
          }
          break;
        }
        case 'message.deleted':
          this.events.publish({
            instanceId,
            type: 'message.deleted',
            payload: {
              chat: event.chat,
              tgMessageIds: event.tgMessageIds,
            },
          });
          break;
        case 'message.read':
          this.events.publish({
            instanceId,
            type: 'message.read',
            payload: {
              chat: event.chat,
              maxId: event.maxId,
              direction: event.direction,
            },
          });
          break;
        case 'message.reaction':
          this.events.publish({
            instanceId,
            type: 'message.reaction',
            payload: {
              chat: event.chat,
              tgMessageId: event.tgMessageId,
              reactions: event.reactions,
            },
          });
          break;
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Event handling failed for ${instanceId}: ${reason}`);
    }
  }

  private async ingestDialog(
    instanceId: string,
    dialog: DialogSnapshot,
  ): Promise<void> {
    if (dialog.contact) {
      await this.contacts.upsert(instanceId, dialog.contact);
    }
    const chatId = await this.chats.upsert(instanceId, dialog.chat);
    if (dialog.lastMessage) {
      await this.persistMessage(instanceId, chatId, dialog.lastMessage);
    }
  }

  private async persistMessage(
    instanceId: string,
    chatId: string,
    message: NormalizedMessage,
  ): Promise<MessageView> {
    let senderId: string | null = null;
    if (message.sender) {
      senderId = await this.contacts.upsert(instanceId, message.sender);
    }
    const id = await this.messages.upsert(
      instanceId,
      chatId,
      senderId,
      message,
    );
    const date = new Date(message.date * 1000);
    await this.chats.touch(chatId, date);
    const contact = message.sender;
    const sender =
      senderId && contact
        ? {
            id: senderId,
            name:
              [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
              contact.username ||
              undefined,
            username: contact.username,
            hasPhoto: contact.hasPhoto ?? false,
          }
        : undefined;
    return {
      id,
      chatId,
      tgMessageId: message.tgMessageId,
      text: message.text,
      outgoing: message.outgoing,
      date: date.toISOString(),
      senderId: senderId ?? undefined,
      sender,
      media: message.media
        ? {
            type: message.media.type,
            mimeType: message.media.mimeType,
            fileName: message.media.fileName,
            width: message.media.width,
            height: message.media.height,
            duration: message.media.duration,
          }
        : undefined,
    };
  }
}
