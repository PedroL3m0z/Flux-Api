import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ChatsService } from '../../core/telegram/services/chats.service';
import { MessagesService } from '../../core/telegram/services/messages.service';
import { TelegramManager } from '../../core/telegram/telegram.manager';
import { TelegramSyncService } from '../../core/telegram/services/telegram-sync.service';
import { MessagingService } from './messaging.service';

const make = () => {
  const client = { sendMessage: jest.fn() };
  const manager = { getClient: jest.fn().mockReturnValue(client) };
  const chats = { getPeerRef: jest.fn(), listByInstance: jest.fn() };
  const messages = { listByChat: jest.fn() };
  const sync = { ingest: jest.fn(), messages$: jest.fn() };
  const service = new MessagingService(
    manager as unknown as TelegramManager,
    chats as unknown as ChatsService,
    messages as unknown as MessagesService,
    sync as unknown as TelegramSyncService,
  );
  return { service, manager, chats, sync, client };
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
