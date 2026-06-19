import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  type EffectiveRole,
  type InstanceRole,
  type Permission,
  permissionsFor,
} from '../../../common/authz/permissions';

/** The requesting principal, as attached to the request by the auth guards. */
export interface AccessPrincipal {
  id: string;
  role: 'admin' | 'member';
}

/** Resolved access of a principal to a single instance. */
export interface InstanceAccess {
  role: EffectiveRole;
  permissions: Set<Permission>;
}

/** A member of an instance, with the user identity joined in. */
export interface InstanceMemberView {
  userId: string;
  username: string;
  email: string;
  role: InstanceRole;
  createdAt: string;
}

/**
 * Resolves and mutates per-instance access. Global `admin` users get full access
 * to every instance; everyone else has the `viewer` baseline, elevated to
 * `operator`/`owner` by an explicit membership row.
 */
@Injectable()
export class InstanceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Effective access of a principal to an instance (never throws). */
  async resolve(
    principal: AccessPrincipal,
    instanceId: string,
  ): Promise<InstanceAccess> {
    if (principal.role === 'admin') {
      return { role: 'admin', permissions: permissionsFor('admin') };
    }
    const membership = await this.prisma.instanceMember.findUnique({
      where: { instanceId_userId: { instanceId, userId: principal.id } },
      select: { role: true },
    });
    const role: EffectiveRole = membership?.role ?? 'viewer';
    return { role, permissions: permissionsFor(role) };
  }

  /** Effective role of a principal across many instances (one query). */
  async rolesFor(
    principal: AccessPrincipal,
    instanceIds: string[],
  ): Promise<Map<string, EffectiveRole>> {
    const result = new Map<string, EffectiveRole>();
    if (principal.role === 'admin') {
      for (const id of instanceIds) {
        result.set(id, 'admin');
      }
      return result;
    }
    const memberships = await this.prisma.instanceMember.findMany({
      where: { userId: principal.id, instanceId: { in: instanceIds } },
      select: { instanceId: true, role: true },
    });
    const byId = new Map(memberships.map((m) => [m.instanceId, m.role]));
    for (const id of instanceIds) {
      result.set(id, byId.get(id) ?? 'viewer');
    }
    return result;
  }

  /** Whether the principal holds a permission on the instance. */
  async can(
    principal: AccessPrincipal,
    instanceId: string,
    permission: Permission,
  ): Promise<boolean> {
    const access = await this.resolve(principal, instanceId);
    return access.permissions.has(permission);
  }

  async listMembers(instanceId: string): Promise<InstanceMemberView[]> {
    const rows = await this.prisma.instanceMember.findMany({
      where: { instanceId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { username: true, email: true } } },
    });
    return rows.map((row) => ({
      userId: row.userId,
      username: row.user.username,
      email: row.user.email,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async addMember(
    instanceId: string,
    userId: string,
    role: InstanceRole,
  ): Promise<InstanceMemberView> {
    await this.ensureInstanceExists(instanceId);
    await this.ensureUserExists(userId);
    await this.prisma.instanceMember.upsert({
      where: { instanceId_userId: { instanceId, userId } },
      create: { instanceId, userId, role },
      update: { role },
    });
    return this.requireMember(instanceId, userId);
  }

  async setMemberRole(
    instanceId: string,
    userId: string,
    role: InstanceRole,
  ): Promise<InstanceMemberView> {
    await this.requireMember(instanceId, userId);
    if (role !== 'owner') {
      await this.ensureNotLastOwner(instanceId, userId);
    }
    await this.prisma.instanceMember.update({
      where: { instanceId_userId: { instanceId, userId } },
      data: { role },
    });
    return this.requireMember(instanceId, userId);
  }

  async removeMember(instanceId: string, userId: string): Promise<void> {
    await this.requireMember(instanceId, userId);
    await this.ensureNotLastOwner(instanceId, userId);
    await this.prisma.instanceMember.delete({
      where: { instanceId_userId: { instanceId, userId } },
    });
  }

  /** Records the creator of a new instance as its owner. */
  async grantOwner(instanceId: string, userId: string): Promise<void> {
    await this.prisma.instanceMember.upsert({
      where: { instanceId_userId: { instanceId, userId } },
      create: { instanceId, userId, role: 'owner' },
      update: { role: 'owner' },
    });
  }

  private async requireMember(
    instanceId: string,
    userId: string,
  ): Promise<InstanceMemberView> {
    const row = await this.prisma.instanceMember.findUnique({
      where: { instanceId_userId: { instanceId, userId } },
      include: { user: { select: { username: true, email: true } } },
    });
    if (!row) {
      throw new NotFoundException('Member not found');
    }
    return {
      userId: row.userId,
      username: row.user.username,
      email: row.user.email,
      role: row.role,
      createdAt: row.createdAt.toISOString(),
    };
  }

  /** Refuses to demote/remove the only remaining owner of an instance. */
  private async ensureNotLastOwner(
    instanceId: string,
    userId: string,
  ): Promise<void> {
    const target = await this.prisma.instanceMember.findUnique({
      where: { instanceId_userId: { instanceId, userId } },
      select: { role: true },
    });
    if (target?.role !== 'owner') {
      return;
    }
    const owners = await this.prisma.instanceMember.count({
      where: { instanceId, role: 'owner' },
    });
    if (owners <= 1) {
      throw new BadRequestException(
        'Cannot remove or demote the last owner of an instance',
      );
    }
  }

  private async ensureInstanceExists(instanceId: string): Promise<void> {
    const exists = await this.prisma.instance.findUnique({
      where: { id: instanceId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('Instance not found');
    }
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const exists = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }
}
