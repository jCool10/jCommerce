import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Command, CommandRunner } from 'nest-commander';
import {
  USER_REPOSITORY,
  type UserRepository,
} from '../../domain/ports/user.repository.js';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../application/ports/password-hasher.port.js';

@Command({
  name: 'seed-admin',
  description: 'Bootstrap an admin user from ADMIN_EMAIL + ADMIN_PASSWORD env vars',
})
export class SeedAdminCommand extends CommandRunner {
  private readonly logger = new Logger(SeedAdminCommand.name);

  constructor(
    private readonly config: ConfigService,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {
    super();
  }

  async run(): Promise<void> {
    const email = (this.config.get<string>('ADMIN_EMAIL') ?? '').trim().toLowerCase();
    const password = this.config.get<string>('ADMIN_PASSWORD') ?? '';
    if (!email || !password) {
      this.logger.error('ADMIN_EMAIL and ADMIN_PASSWORD must be set');
      process.exitCode = 1;
      return;
    }
    if (password.length < 12) {
      this.logger.error('ADMIN_PASSWORD must be at least 12 characters');
      process.exitCode = 1;
      return;
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      this.logger.log(`admin already exists (${email}) — skip`);
      return;
    }

    const passwordHash = await this.hasher.hash(password);
    const created = await this.users.create({
      email,
      name: 'Admin',
      role: 'admin',
      provider: 'credentials',
      passwordHash,
    });
    this.logger.log(`admin user seeded: ${created.id} (${created.email})`);
  }
}
