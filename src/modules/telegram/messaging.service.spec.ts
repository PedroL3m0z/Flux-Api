import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ChatsService } from '../../core/telegram/services/chats.service';
import { ContactsService } from '../../core/telegram/services/contacts.service';
import { MessagesService } from '../../core/telegram/services/messages.service';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { TelegramSyncService } from '../../core/telegram/services/telegram-sync.service';
import { MessagingService } from './messaging.service';

const make = () => {
  const client = {
    sendMessage: jest.fn(),
    getHistory: jest.fn(),
    downloadAvatar: jest.fn(),
    downloadMessageMedia: jest.fn(),
  };
  const manager = { getClient: jest.fn().mockReturnValue(client) };
  const chats = { getPeerRef: jest.fn(), listByInstance: jest.fn() };
  const contacts = { getPeerRef: jest.fn() };
  const messages = { listByChat: jest.fn() };
  const sync = {
    ingest: jest.fn(),
    messages$: jest.fn(),
    ingestHistory: jest.fn(),
  };
  const service = new MessagingService(
    manager as unknown as TelegramManager,
    chats as unknown as ChatsService,
    contacts as unknown as ContactsService,
    messages as unknown as MessagesService,
    sync as unknown as TelegramSyncService,
  );
  return { service, manager, chats, contacts, messages, sync, client };
};

describe('MessagingService', () => {
  it('sends a message and returns the persisted view', async () => {
    const { service, chats, sync, client } = make();
    chats.getPeerRef.mockResolvedValue({ tgPeerId: '1', type: 'user' });
    const sent = { tgMessageId: '9', chat: {}, outgoing: true, date: 1 };
    client.sendMessage.mockResolvedValue(sent);
    const view = {
      id: 'm1',
      chatId: 'c1',
      tgMessageId: '9',
      outgoing: true,
      date: 'd',
    };
    sync.ingest.mockResolvedValue(view);

    await expect(service.send('i1', 'c1', 'hi')).resolves.toBe(view);
    expect(client.sendMessage).toHaveBeenCalledWith(
      { tgPeerId: '1', type: 'user' },
      'hi',
    );
    expect(sync.ingest).toHaveBeenCalledWith('i1', sent);
  });

  it('pulls recent history on the first page, then serves the DB', async () => {
    const { service, chats, messages, sync, client } = make();
    chats.getPeerRef.mockResolvedValue({ tgPeerId: '1', type: 'user' });
    client.getHistory.mockResolvedValue([{ tgMessageId: '5' }]);
    sync.ingestHistory.mockResolvedValue(1);
    const page = { items: [{ id: 'm1', tgMessageId: '5' }], nextCursor: 'm1' };
    messages.listByChat.mockResolvedValue(page);

    await expect(service.listMessages('i1', 'c1', {})).resolves.toBe(page);
    expect(client.getHistory).toHaveBeenCalledWith(
      { tgPeerId: '1', type: 'user' },
      { limit: 50, beforeId: undefined },
    );
    expect(sync.ingestHistory).toHaveBeenCalledWith('i1', 'c1', [
      { tgMessageId: '5' },
    ]);
  });

  it('fetches older history when the stored page is exhausted', async () => {
    const { service, chats, messages, sync, client } = make();
    chats.getPeerRef.mockResolvedValue({ tgPeerId: '1', type: 'user' });
    client.getHistory.mockResolvedValue([{ tgMessageId: '2' }]);
    sync.ingestHistory.mockResolvedValue(1);
    const exhausted = {
      items: [{ id: 'm9', tgMessageId: '9' }],
      nextCursor: null,
    };
    const refilled = {
      items: [{ id: 'm2', tgMessageId: '2' }],
      nextCursor: 'm2',
    };
    messages.listByChat
      .mockResolvedValueOnce(exhausted)
      .mockResolvedValueOnce(refilled);

    await expect(
      service.listMessages('i1', 'c1', { cursor: 'm9' }),
    ).resolves.toBe(refilled);
    expect(client.getHistory).toHaveBeenCalledWith(
      { tgPeerId: '1', type: 'user' },
      { limit: 50, beforeId: '9' },
    );
  });

  it('serves the DB when the instance is offline (no history pull)', async () => {
    const { service, manager, messages } = make();
    manager.getClient.mockReturnValue(undefined);
    const page = { items: [], nextCursor: null };
    messages.listByChat.mockResolvedValue(page);
    await expect(service.listMessages('i1', 'c1', {})).resolves.toBe(page);
  });

  it('503s when the instance is not connected', async () => {
    const { service, manager } = make();
    manager.getClient.mockReturnValue(undefined);
    await expect(service.send('i1', 'c1', 'hi')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('404s when the chat is unknown', async () => {
    const { service, chats } = make();
    chats.getPeerRef.mockResolvedValue(null);
    await expect(service.send('i1', 'c1', 'hi')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
