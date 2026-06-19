import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { UsersService } from '../users/users.service';

/**
 * Seeds an initial user from SEED_EMAIL/SEED_USERNAME/SEED_PASSWORD on startup.
 * Idempotent: skips when the variables are absent or the user already exists.
 * Runs after migrations (the docker entrypoint runs `migrate deploy` first).
 */
@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.config.get<string>('SEED_EMAIL');
    const username = this.config.get<string>('SEED_USERNAME');
    const password = this.config.get<string>('SEED_PASSWORD');

    if (!email || !username || !password) {
      return;
    }

    try {
      const existing = await this.users.findByEmailOrUsername(email, username);
      if (existing) {
        if (existing.role !== 'admin') {
          await this.users.setRole(existing.id, 'admin');
          this.logger.log(`Promoted seed user "${username}" to admin`);
        } else {
          this.logger.log(`Seed user "${username}" already exists, skipping`);
        }
        return;
      }
      const created = await this.auth.register({ email, username, password });
      await this.users.setRole(created.id, 'admin');
      this.logger.log(`Seeded initial admin user "${username}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Failed to seed user: ${message}`);
    }
  }
}
