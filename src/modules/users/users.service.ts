import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import type { User } from '../../core/prisma/generated/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    email: string;
    username: string;
    password: string;
  }): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async findByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
      },
    });
  }

  async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** All users, newest first, without the password field. */
  async findAll() {
    return this.prisma.user.findMany({
      select: { id: true, email: true, username: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
