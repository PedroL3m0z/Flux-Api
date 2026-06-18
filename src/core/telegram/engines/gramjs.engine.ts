import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { NewMessage, type NewMessageEvent } from 'telegram/events';
import { StringSession } from 'telegram/sessions';
import {
  type DialogSnapshot,
  type EngineCapabilities,
  type EngineClient,
  type EngineConfig,
  type EngineKey,
  type InstanceEngine,
  type NormalizedChat,
  type NormalizedContact,
  type NormalizedMessage,
  type PeerRef,
  type QrCallbacks,
  type TelegramMe,
} from './engine.types';

function toMe(user: Api.TypeUser): TelegramMe {
  const me: TelegramMe = { id: String(user.id) };
  if (user instanceof Api.User) {
    me.username = user.username ?? undefined;
    me.firstName = user.firstName ?? undefined;
  }
  return me;
}

function nameOf(user: Api.User): string | undefined {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
}

function chatFromEntity(entity: Api.TypeUser | Api.TypeChat): NormalizedChat {
  if (entity instanceof Api.User) {
    return {
      tgPeerId: entity.id.toString(),
      type: 'user',
      accessHash: entity.accessHash?.toString(),
      title: nameOf(entity),
      username: entity.username ?? undefined,
    };
  }
  if (entity instanceof Api.Channel) {
    return {
      tgPeerId: entity.id.toString(),
      type: 'channel',
      accessHash: entity.accessHash?.toString(),
      title: entity.title,
      username: entity.username ?? undefined,
    };
  }
  // Api.Chat / Api.ChatForbidden / Api.ChannelForbidden (basic groups)
  const title = 'title' in entity ? entity.title : undefined;
  return { tgPeerId: entity.id.toString(), type: 'group', title };
}

function contactFromUser(user: Api.User): NormalizedContact {
  return {
    tgUserId: user.id.toString(),
    accessHash: user.accessHash?.toString(),
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    username: user.username ?? undefined,
    phone: user.phone ?? undefined,
  };
}

function chatFromPeer(peer: Api.TypePeer): NormalizedChat {
  if (peer instanceof Api.PeerUser) {
    return { tgPeerId: peer.userId.toString(), type: 'user' };
  }
  if (peer instanceof Api.PeerChannel) {
    return { tgPeerId: peer.channelId.toString(), type: 'channel' };
  }
  return { tgPeerId: peer.chatId.toString(), type: 'group' };
}

function messageToNormalized(
  msg: Api.Message,
  chat: NormalizedChat,
): NormalizedMessage {
  let sender: NormalizedContact | undefined;
  if (msg.fromId instanceof Api.PeerUser) {
    sender = { tgUserId: msg.fromId.userId.toString() };
  } else if (chat.type === 'user' && !msg.out) {
    sender = { tgUserId: chat.tgPeerId };
  }
  return {
    tgMessageId: msg.id.toString(),
    chat,
    sender,
    outgoing: Boolean(msg.out),
    text: msg.message || undefined,
    date: msg.date,
    replyToTgId:
      msg.replyTo instanceof Api.MessageReplyHeader
        ? msg.replyTo.replyToMsgId?.toString()
        : undefined,
  };
}

function inputPeer(peer: PeerRef): Api.TypeInputPeer {
  const id = bigInt(peer.tgPeerId);
  const hash = bigInt(peer.accessHash ?? '0');
  if (peer.type === 'user') {
    return new Api.InputPeerUser({ userId: id, accessHash: hash });
  }
  if (peer.type === 'channel') {
    return new Api.InputPeerChannel({ channelId: id, accessHash: hash });
  }
  return new Api.InputPeerChat({ chatId: id });
}

/** EngineClient backed by a GramJS TelegramClient (MTProto user account). */
class GramJsClient implements EngineClient {
  private readonly logger = new Logger(GramJsClient.name);

  constructor(
    private readonly client: TelegramClient,
    private readonly apiId: number,
    private readonly apiHash: string,
  ) {}

  isAuthorized(): Promise<boolean> {
    return this.client.isUserAuthorized();
  }

  disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  async getMe(): Promise<TelegramMe | null> {
    if (!(await this.client.isUserAuthorized())) {
      return null;
    }
    const me = await this.client.getMe();
    return me ? toMe(me) : null;
  }

  saveSession(): string {
    return this.client.session.save() as unknown as string;
  }

  async qrLogin(callbacks: QrCallbacks): Promise<TelegramMe> {
    const user = await this.client.signInUserWithQrCode(
      { apiId: this.apiId, apiHash: this.apiHash },
      {
        qrCode: (code: { token: Buffer; expires: number }) => {
          callbacks.onQr(
            `tg://login?token=${code.token.toString('base64url')}`,
            code.expires,
          );
          return Promise.resolve();
        },
        password: () => callbacks.onPasswordRequired(),
        onError: (err: Error) => {
          this.logger.error(`QR login error: ${err.message}`);
          return Promise.resolve(true); // stop the attempt; the manager reports it
        },
      },
    );
    return toMe(user);
  }

  async listDialogs(limit = 50): Promise<DialogSnapshot[]> {
    const dialogs = await this.client.getDialogs({ limit });
    const out: DialogSnapshot[] = [];
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (!entity) {
        continue;
      }
      const chat = chatFromEntity(entity);
      out.push({
        chat,
        contact:
          entity instanceof Api.User ? contactFromUser(entity) : undefined,
        lastMessage:
          dialog.message instanceof Api.Message
            ? messageToNormalized(dialog.message, chat)
            : undefined,
      });
    }
    return out;
  }

  async getHistory(
    peer: PeerRef,
    opts?: { limit?: number; beforeId?: string },
  ): Promise<NormalizedMessage[]> {
    const chat: NormalizedChat = {
      tgPeerId: peer.tgPeerId,
      type: peer.type,
      accessHash: peer.accessHash,
    };
    const messages = await this.client.getMessages(inputPeer(peer), {
      limit: opts?.limit ?? 50,
      offsetId: opts?.beforeId ? Number(opts.beforeId) : undefined,
    });
    return messages.map((m) => messageToNormalized(m, chat));
  }

  async sendMessage(peer: PeerRef, text: string): Promise<NormalizedMessage> {
    const chat: NormalizedChat = {
      tgPeerId: peer.tgPeerId,
      type: peer.type,
      accessHash: peer.accessHash,
    };
    const message = await this.client.sendMessage(inputPeer(peer), {
      message: text,
    });
    return messageToNormalized(message, chat);
  }

  onMessage(handler: (message: NormalizedMessage) => void): () => void {
    const event = new NewMessage({});
    const callback = (update: NewMessageEvent) => {
      const msg = update.message;
      handler(messageToNormalized(msg, chatFromPeer(msg.peerId)));
    };
    this.client.addEventHandler(callback, event);
    return () => this.client.removeEventHandler(callback, event);
  }
}

@Injectable()
export class GramJsEngine implements InstanceEngine {
  readonly key: EngineKey = 'gramjs';
  readonly capabilities: EngineCapabilities = {
    qrLogin: true,
    botToken: false,
    messaging: true,
  };

  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    return true; // implemented; credentials are supplied per instance
  }

  requiredConfig(): string[] {
    return ['apiId', 'apiHash'];
  }

  async connect(session: string, config: EngineConfig): Promise<EngineClient> {
    const apiId = this.resolveApiId(config.apiId);
    const apiHash = config.apiHash ?? this.envApiHash;
    if (apiId === undefined || !apiHash) {
      throw new Error('GramJS requires api_id and api_hash');
    }
    const client = new TelegramClient(
      new StringSession(session),
      apiId,
      apiHash,
      { connectionRetries: 5 },
    );
    await client.connect();
    return new GramJsClient(client, apiId, apiHash);
  }

  private resolveApiId(value: string | undefined): number | undefined {
    if (value !== undefined && value !== '') {
      const parsed = Number(value);
      return Number.isInteger(parsed) ? parsed : undefined;
    }
    return this.config.get<number>('TELEGRAM_API_ID');
  }

  private get envApiHash(): string | undefined {
    return this.config.get<string>('TELEGRAM_API_HASH');
  }
}
