import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminRoleGuard } from '@jcool/nest-kit';
import { ReindexService, type ReindexReport } from './reindex.service.js';

@Controller({ path: 'search', version: '1' })
export class ReindexController {
  constructor(private readonly reindex: ReindexService) {}

  @Post('reindex')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async run(): Promise<ReindexReport> {
    return this.reindex.run();
  }
}
