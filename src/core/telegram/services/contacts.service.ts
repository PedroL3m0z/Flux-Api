import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { NormalizedContact, PeerRef } from '../engines/engine.types';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Upserts a contact (Telegram user) by its per-instance natural key. */
  async upsert(
    instanceId: string,
    contact: NormalizedContact,
  ): Promise<string> {
    const tgUserId = BigInt(contact.tgUserId);
    const accessHash = contact.accessHash
      ? BigInt(contact.accessHash)
      : undefined;
    const row = await this.prisma.contact.upsert({
      where: { instanceId_tgUserId: { instanceId, tgUserId } },
      create: {
        instanceId,
        tgUserId,
        accessHash: accessHash ?? null,
        firstName: contact.firstName,
        lastName: contact.lastName,
        username: contact.username,
        phone: contact.phone,
        hasPhoto: contact.hasPhoto ?? false,
      },
      update: {
        accessHash,
        firstName: contact.firstName,
        lastName: contact.lastName,
        username: contact.username,
        phone: contact.phone,
        hasPhoto: contact.hasPhoto,
      },
      select: { id: true },
    });
    return row.id;
  }

  /** Peer reference for a stored contact (to download its avatar). */
  async getPeerRef(
    instanceId: string,
    contactId: string,
  ): Promise<PeerRef | null> {
    const row = await this.prisma.contact.findFirst({
      where: { id: contactId, instanceId },
      select: { tgUserId: true, accessHash: true },
    });
    if (!row) {
      return null;
    }
    return {
      tgPeerId: row.tgUserId.toString(),
      type: 'user',
      accessHash: row.accessHash?.toString(),
    };
  }
}
