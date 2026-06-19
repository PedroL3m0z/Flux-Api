import type { MediaType, PeerType } from './engines/engine.types';

/** API-facing chat shape (int64 ids as strings, dates as ISO). */
export interface ChatView {
  id: string;
  tgPeerId: string;
  type: PeerType;
  title?: string;
  username?: string;
  hasPhoto: boolean;
  lastMessageAt?: string;
}

/** Attachment metadata exposed to the client (bytes fetched separately). */
export interface MediaView {
  type: MediaType;
  mimeType?: string;
  fileName?: string;
  width?: number;
  height?: number;
  duration?: number;
}

/** Sender identity attached to a message (for group chats). */
export interface MessageSenderView {
  id: string;
  name?: string;
  username?: string;
  hasPhoto: boolean;
}

/** API-facing message shape. */
export interface MessageView {
  id: string;
  chatId: string;
  tgMessageId: string;
  text?: string;
  outgoing: boolean;
  date: string;
  senderId?: string;
  sender?: MessageSenderView;
  media?: MediaView;
}

/** A persisted message pushed over the realtime stream. */
export interface StreamMessage {
  instanceId: string;
  message: MessageView;
}
