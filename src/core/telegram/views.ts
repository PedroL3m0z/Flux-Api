import type { PeerType } from './engines/engine.types';

/** API-facing chat shape (int64 ids as strings, dates as ISO). */
export interface ChatView {
  id: string;
  tgPeerId: string;
  type: PeerType;
  title?: string;
  username?: string;
  lastMessageAt?: string;
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
}

/** A persisted message pushed over the realtime stream. */
export interface StreamMessage {
  instanceId: string;
  message: MessageView;
}
