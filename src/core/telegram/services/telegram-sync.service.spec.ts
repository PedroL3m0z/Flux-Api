import { ChatsService } from './chats.service';
import { ContactsService } from './contacts.service';
import { MessagesService } from './messages.service';
import { TelegramEventBus } from './telegram-events.service';
import type {
  EngineClient,
  NormalizedEvent,
  NormalizedMessage,
} from '../engines/engine.types';
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
  const events = { publish: jest.fn() };
  const sync = new TelegramSyncService(
    chats as unknown as ChatsService,
    contacts as unknown as ContactsService,
    messages as unknown as MessagesService,
    events as unknown as TelegramEventBus,
  );

  let captured: ((e: NormalizedEvent) => void) | undefined;
  const unsub = jest.fn();
  const client = {
    listDialogs: jest.fn().mockResolvedValue([]),
    onEvent: jest.fn((h: (e: NormalizedEvent) => void) => {
      captured = h;
      return unsub;
    }),
  } as unknown as EngineClient;

  return {
    sync,
    chats,
    contacts,
    messages,
    events,
    unsub,
    client,
    emit: (m: NormalizedMessage) =>
      captured?.({ type: 'message.new', message: m }),
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

  it('ingests realtime incoming messages and publishes the event', async () => {
    const { sync, chats, messages, events, client, emit } = make();

    await sync.onAuthorized('i1', client);
    emit(message);
    await flush();

    expect(chats.upsert).toHaveBeenCalledWith('i1', message.chat);
    expect(messages.upsert).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ instanceId: 'i1', type: 'message.new' }),
    );
  });

  it('stops the realtime subscription', async () => {
    const { sync, unsub, client } = make();
    await sync.onAuthorized('i1', client);

    sync.stop('i1');

    expect(unsub).toHaveBeenCalled();
  });
});
