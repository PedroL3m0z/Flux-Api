import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { HashingService } from '../../common/hashing/hashing.service';
import type { Role, User } from '../../core/prisma/generated/client';

/** Safe fields returned to clients (never the password hash). */
const SAFE_SELECT = {
  id: true,
  email: true,
  username: true,
  role: true,
  createdAt: true,
} as const;

/** True for a Prisma unique-constraint violation (error code P2002). */
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hashing: HashingService,
  ) {}

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

  /** Total number of users (used to gate first-boot seeding). */
  async count(): Promise<number> {
    return this.prisma.user.count();
  }

  /** All users, newest first, without the password field. */
  async findAll() {
    return this.prisma.user.findMany({
      select: SAFE_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Sets a user's global dashboard role (admin/operator/viewer). */
  async setRole(id: string, role: Role) {
    try {
      return await this.prisma.user.update({
        where: { id },
        data: { role },
        select: SAFE_SELECT,
      });
    } catch {
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Admin edit of a user. Only provided fields change; the password (when
   * present) is hashed. Returns the safe user.
   */
  async update(
    id: string,
    data: {
      email?: string;
      username?: string;
      password?: string;
      role?: Role;
    },
  ) {
    const patch: {
      email?: string;
      username?: string;
      password?: string;
      role?: Role;
    } = {};
    if (data.email !== undefined) patch.email = data.email;
    if (data.username !== undefined) patch.username = data.username;
    if (data.role !== undefined) patch.role = data.role;
    if (data.password !== undefined) {
      patch.password = await this.hashing.hash(data.password);
    }

    try {
      return await this.prisma.user.update({
        where: { id },
        data: patch,
        select: SAFE_SELECT,
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new ConflictException('Email or username already in use');
      }
      throw new NotFoundException('User not found');
    }
  }

  /** Permanently deletes a user (cascades instances/webhooks). */
  async remove(id: string) {
    try {
      await this.prisma.user.delete({ where: { id } });
    } catch {
      throw new NotFoundException('User not found');
    }
  }
}
