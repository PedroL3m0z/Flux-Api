import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bigInt from 'big-integer';
import { Api, TelegramClient } from 'telegram';
import { NewMessage, type NewMessageEvent, Raw } from 'telegram/events';
import {
  EditedMessage,
  type EditedMessageEvent,
} from 'telegram/events/EditedMessage';
import {
  DeletedMessage,
  type DeletedMessageEvent,
} from 'telegram/events/DeletedMessage';
import { StringSession } from 'telegram/sessions';
import { CustomFile } from 'telegram/client/uploads';
import {
  type DialogSnapshot,
  type EngineCapabilities,
  type EngineClient,
  type EngineConfig,
  type EngineKey,
  type InstanceEngine,
  type MediaBlob,
  type MediaType,
  type NormalizedChat,
  type NormalizedContact,
  type NormalizedEvent,
  type NormalizedMedia,
  type NormalizedMessage,
  type NormalizedReaction,
  type PeerRef,
  type PhoneCallbacks,
  type QrCallbacks,
  type TelegramMe,
  type UploadedMedia,
} from './engine.types';

function toMe(user: Api.TypeUser): TelegramMe {
  const me: TelegramMe = { id: String(user.id) };
  if (user instanceof Api.User) {
    me.username = user.username ?? undefined;
    me.firstName = user.firstName ?? undefined;
    me.phone = user.phone ?? undefined;
  }
  return me;
}

function nameOf(user: Api.User): string | undefined {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined;
}

function hasProfilePhoto(entity: Api.TypeUser | Api.TypeChat): boolean {
  const photo = 'photo' in entity ? entity.photo : undefined;
  return Boolean(
    photo &&
    !(photo instanceof Api.UserProfilePhotoEmpty) &&
    !(photo instanceof Api.ChatPhotoEmpty),
  );
}

function chatFromEntity(entity: Api.TypeUser | Api.TypeChat): NormalizedChat {
  const hasPhoto = hasProfilePhoto(entity);
  if (entity instanceof Api.User) {
    return {
      tgPeerId: entity.id.toString(),
      type: 'user',
      accessHash: entity.accessHash?.toString(),
      title: nameOf(entity),
      username: entity.username ?? undefined,
      hasPhoto,
    };
  }
  if (entity instanceof Api.Channel) {
    return {
      tgPeerId: entity.id.toString(),
      type: 'channel',
      accessHash: entity.accessHash?.toString(),
      title: entity.title,
      username: entity.username ?? undefined,
      hasPhoto,
    };
  }
  // Api.Chat / Api.ChatForbidden / Api.ChannelForbidden (basic groups)
  const title = 'title' in entity ? entity.title : undefined;
  return { tgPeerId: entity.id.toString(), type: 'group', title, hasPhoto };
}

/** Classifies a message's attachment into normalized media metadata. */
function mediaFromMessage(msg: Api.Message): NormalizedMedia | undefined {
  const media = msg.media;
  if (!media) {
    return undefined;
  }
  if (media instanceof Api.MessageMediaPhoto) {
    return { type: 'photo', mimeType: 'image/jpeg' };
  }
  if (media instanceof Api.MessageMediaDocument) {
    const doc = media.document;
    if (!(doc instanceof Api.Document)) {
      return { type: 'document' };
    }
    const attrs = doc.attributes ?? [];
    const mimeType = doc.mimeType || undefined;
    const fileName = attrs.find(
      (a): a is Api.DocumentAttributeFilename =>
        a instanceof Api.DocumentAttributeFilename,
    )?.fileName;
    const video = attrs.find(
      (a): a is Api.DocumentAttributeVideo =>
        a instanceof Api.DocumentAttributeVideo,
    );
    let type: MediaType = 'document';
    if (attrs.some((a) => a instanceof Api.DocumentAttributeSticker)) {
      type = 'sticker';
    } else if (video || mimeType?.startsWith('video/')) {
      type = 'video';
    } else if (
      attrs.some((a) => a instanceof Api.DocumentAttributeAudio) ||
      mimeType?.startsWith('audio/')
    ) {
      type = 'audio';
    } else if (mimeType?.startsWith('image/')) {
      type = 'photo';
    }
    return {
      type,
      mimeType,
      fileName,
      size: doc.size ? Number(doc.size.toString()) : undefined,
      width: video?.w,
      height: video?.h,
      duration: video?.duration,
    };
  }
  return { type: 'other' };
}

function contactFromUser(user: Api.User): NormalizedContact {
  return {
    tgUserId: user.id.toString(),
    accessHash: user.accessHash?.toString(),
    firstName: user.firstName ?? undefined,
    lastName: user.lastName ?? undefined,
    username: user.username ?? undefined,
    phone: user.phone ?? undefined,
    hasPhoto: hasProfilePhoto(user),
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
  // Prefer the resolved sender entity (carries name + photo) when GramJS has it
  // cached; otherwise fall back to the bare id from the message header.
  const entity = msg.sender;
  if (entity instanceof Api.User) {
    sender = contactFromUser(entity);
  } else if (msg.fromId instanceof Api.PeerUser) {
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
    media: mediaFromMessage(msg),
  };
}

function reactionsFromApi(
  reactions?: Api.TypeMessageReactions,
): NormalizedReaction[] {
  if (!(reactions instanceof Api.MessageReactions)) {
    return [];
  }
  return reactions.results.map((r) => {
    if (r.reaction instanceof Api.ReactionEmoji) {
      return { emoji: r.reaction.emoticon, count: r.count };
    }
    if (r.reaction instanceof Api.ReactionCustomEmoji) {
      return {
        customEmojiId: r.reaction.documentId.toString(),
        count: r.count,
      };
    }
    return { count: r.count };
  });
}

/** Maps a raw MTProto update to a normalized event, or undefined if irrelevant. */
function rawToEvent(update: Api.TypeUpdate): NormalizedEvent | undefined {
  if (update instanceof Api.UpdateReadHistoryOutbox) {
    return {
      type: 'message.read',
      chat: chatFromPeer(update.peer),
      maxId: String(update.maxId),
      direction: 'outbound',
    };
  }
  if (update instanceof Api.UpdateReadHistoryInbox) {
    return {
      type: 'message.read',
      chat: chatFromPeer(update.peer),
      maxId: String(update.maxId),
      direction: 'inbound',
    };
  }
  if (update instanceof Api.UpdateReadChannelOutbox) {
    return {
      type: 'message.read',
      chat: { tgPeerId: update.channelId.toString(), type: 'channel' },
      maxId: String(update.maxId),
      direction: 'outbound',
    };
  }
  if (update instanceof Api.UpdateReadChannelInbox) {
    return {
      type: 'message.read',
      chat: { tgPeerId: update.channelId.toString(), type: 'channel' },
      maxId: String(update.maxId),
      direction: 'inbound',
    };
  }
  if (update instanceof Api.UpdateMessageReactions) {
    return {
      type: 'message.reaction',
      chat: chatFromPeer(update.peer),
      tgMessageId: String(update.msgId),
      reactions: reactionsFromApi(update.reactions),
    };
  }
  return undefined;
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

  async phoneLogin(
    phone: string,
    callbacks: PhoneCallbacks,
  ): Promise<TelegramMe> {
    const user = await this.client.signInUser(
      { apiId: this.apiId, apiHash: this.apiHash },
      {
        phoneNumber: () => Promise.resolve(phone),
        phoneCode: async () => {
          callbacks.onCodeSent();
          return callbacks.onCodeRequired();
        },
        password: () => callbacks.onPasswordRequired(),
        onError: (err: Error) => {
          this.logger.error(`Phone login error: ${err.message}`);
          return Promise.resolve(true);
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

  async sendMedia(
    peer: PeerRef,
    file: UploadedMedia,
    caption?: string,
  ): Promise<NormalizedMessage> {
    const chat: NormalizedChat = {
      tgPeerId: peer.tgPeerId,
      type: peer.type,
      accessHash: peer.accessHash,
    };
    const upload = new CustomFile(
      file.fileName,
      file.data.length,
      '',
      file.data,
    );
    // Send images/videos as media; everything else as a document.
    const forceDocument = !(
      file.mimeType?.startsWith('image/') || file.mimeType?.startsWith('video/')
    );
    const message = await this.client.sendFile(inputPeer(peer), {
      file: upload,
      caption,
      forceDocument,
    });
    return messageToNormalized(message, chat);
  }

  async downloadAvatar(peer: PeerRef): Promise<MediaBlob | null> {
    const buffer = await this.client.downloadProfilePhoto(inputPeer(peer));
    if (!buffer || !(buffer instanceof Buffer) || buffer.length === 0) {
      return null;
    }
    return { data: buffer, mimeType: 'image/jpeg' };
  }

  async downloadMessageMedia(
    peer: PeerRef,
    tgMessageId: string,
  ): Promise<MediaBlob | null> {
    const messages = await this.client.getMessages(inputPeer(peer), {
      ids: [Number(tgMessageId)],
    });
    const msg = messages[0];
    if (!(msg instanceof Api.Message) || !msg.media) {
      return null;
    }
    const data = await this.client.downloadMedia(msg);
    if (!data || !(data instanceof Buffer) || data.length === 0) {
      return null;
    }
    const meta = mediaFromMessage(msg);
    return {
      data,
      mimeType: meta?.mimeType ?? 'application/octet-stream',
      fileName: meta?.fileName,
    };
  }

  onEvent(handler: (event: NormalizedEvent) => void): () => void {
    const unsubs: Array<() => void> = [];

    const newMsg = new NewMessage({});
    const onNew = (u: NewMessageEvent) =>
      handler({
        type: 'message.new',
        message: messageToNormalized(u.message, chatFromPeer(u.message.peerId)),
      });
    this.client.addEventHandler(onNew, newMsg);
    unsubs.push(() => this.client.removeEventHandler(onNew, newMsg));

    const editedMsg = new EditedMessage({});
    const onEdit = (u: EditedMessageEvent) =>
      handler({
        type: 'message.edited',
        message: messageToNormalized(u.message, chatFromPeer(u.message.peerId)),
      });
    this.client.addEventHandler(onEdit, editedMsg);
    unsubs.push(() => this.client.removeEventHandler(onEdit, editedMsg));

    const deletedMsg = new DeletedMessage({});
    const onDelete = (u: DeletedMessageEvent) =>
      handler({
        type: 'message.deleted',
        tgMessageIds: u.deletedIds.map(String),
      });
    this.client.addEventHandler(onDelete, deletedMsg);
    unsubs.push(() => this.client.removeEventHandler(onDelete, deletedMsg));

    // Read receipts and reactions only surface as raw MTProto updates.
    const raw = new Raw({});
    const onRaw = (update: Api.TypeUpdate) => {
      const event = rawToEvent(update);
      if (event) {
        handler(event);
      }
    };
    this.client.addEventHandler(onRaw, raw);
    unsubs.push(() => this.client.removeEventHandler(onRaw, raw));

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }
}

@Injectable()
export class GramJsEngine implements InstanceEngine {
  readonly key: EngineKey = 'gramjs';
  readonly capabilities: EngineCapabilities = {
    qrLogin: true,
    phoneLogin: true,
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
