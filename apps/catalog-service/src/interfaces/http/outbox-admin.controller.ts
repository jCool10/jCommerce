import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import {
  OUTBOX_REPOSITORY,
  type OutboxRepository,
} from '../../domain/ports/outbox.repository.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AdminRoleGuard } from '@jcool/nest-kit';

const STUCK_OLDER_THAN_MS = 5 * 60 * 1000;

@Controller({ path: 'admin/outbox', version: '1' })
@UseGuards(JwtAuthGuard, AdminRoleGuard)
export class OutboxAdminController {
  constructor(@Inject(OUTBOX_REPOSITORY) private readonly outbox: OutboxRepository) {}

  @Get('stuck')
  async stuck(): Promise<{ stuckCount: number; olderThanMs: number }> {
    const stuckCount = await this.outbox.countStuck(STUCK_OLDER_THAN_MS);
    return { stuckCount, olderThanMs: STUCK_OLDER_THAN_MS };
  }
}
