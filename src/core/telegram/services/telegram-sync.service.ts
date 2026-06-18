import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, filter, map } from 'rxjs';
import { ChatsService } from './chats.service';
import { ContactsService } from './contacts.service';
import { MessagesService } from './messages.service';
import type {
  DialogSnapshot,
  EngineClient,
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
    try {
      const chatId = await this.chats.upsert(instanceId, message.chat);
      const view = await this.persistMessage(instanceId, chatId, message);
      this.incoming.next({ instanceId, message: view });
      return view;
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Ingest failed for ${instanceId}: ${reason}`);
      return undefined;
    }
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
    if (!client.onMessage) {
      return;
    }
    this.stop(instanceId);
    const unsub = client.onMessage((message) => {
      void this.ingest(instanceId, message);
    });
    this.unsubscribers.set(instanceId, unsub);
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
    return {
      id,
      chatId,
      tgMessageId: message.tgMessageId,
      text: message.text,
      outgoing: message.outgoing,
      date: date.toISOString(),
      senderId: senderId ?? undefined,
    };
  }
}
