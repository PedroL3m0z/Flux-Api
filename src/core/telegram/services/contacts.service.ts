import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { NormalizedContact } from '../engines/engine.types';

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
      },
      update: {
        accessHash,
        firstName: contact.firstName,
        lastName: contact.lastName,
        username: contact.username,
        phone: contact.phone,
      },
      select: { id: true },
    });
    return row.id;
  }
}
