import { ChatsService } from './chats.service';
import { ContactsService } from './contacts.service';
import { MessagesService } from './messages.service';
import type { EngineClient, NormalizedMessage } from '../engines/engine.types';
import { TelegramSyncService } from './telegram-sync.service';

const flush = () => new Promise((resolve) => setImmediate(resolve));

const message: NormalizedMessage = {
  tgMessageId: '10',
  chat: { tgPeerId: '1', type: 'user' },
  outgoing: false,
  date: 1_700_000_000,
};

const make = () => {
  const chats = {
    upsert: jest.fn().mockResolvedValue('chat1'),
    touch: jest.fn().mockResolvedValue(undefined),
  };
  const contacts = { upsert: jest.fn().mockResolvedValue('contact1') };
  const messages = { upsert: jest.fn().mockResolvedValue('msg1') };
  const sync = new TelegramSyncService(
    chats as unknown as ChatsService,
    contacts as unknown as ContactsService,
    messages as unknown as MessagesService,
  );

  let captured: ((m: NormalizedMessage) => void) | undefined;
  const unsub = jest.fn();
  const client = {
    listDialogs: jest.fn().mockResolvedValue([]),
    onMessage: jest.fn((h: (m: NormalizedMessage) => void) => {
      captured = h;
      return unsub;
    }),
  } as unknown as EngineClient;

  return {
    sync,
    chats,
    contacts,
    messages,
    unsub,
    client,
    emit: (m: NormalizedMessage) => captured?.(m),
  };
};

describe('TelegramSyncService', () => {
  it('backfills dialogs into chats, contacts and messages', async () => {
    const { sync, chats, contacts, messages, client } = make();
    (client.listDialogs as jest.Mock).mockResolvedValue([
      { chat: message.chat, contact: { tgUserId: '1' }, lastMessage: message },
    ]);

    await sync.onAuthorized('i1', client);

    expect(contacts.upsert).toHaveBeenCalledWith('i1', { tgUserId: '1' });
    expect(chats.upsert).toHaveBeenCalledWith('i1', message.chat);
    expect(messages.upsert).toHaveBeenCalledWith('i1', 'chat1', null, message);
    expect(chats.touch).toHaveBeenCalled();
  });

  it('ingests realtime incoming messages', async () => {
    const { sync, chats, messages, client, emit } = make();

    await sync.onAuthorized('i1', client);
    emit(message);
    await flush();

    expect(chats.upsert).toHaveBeenCalledWith('i1', message.chat);
    expect(messages.upsert).toHaveBeenCalled();
  });

  it('stops the realtime subscription', async () => {
    const { sync, unsub, client } = make();
    await sync.onAuthorized('i1', client);

    sync.stop('i1');

    expect(unsub).toHaveBeenCalled();
  });
});
