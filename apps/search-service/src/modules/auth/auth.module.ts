import { Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AdminRoleGuard } from '@jcool/nest-kit';

@Module({
  providers: [JwtVerifierService, JwtAuthGuard, AdminRoleGuard],
  exports: [JwtVerifierService, JwtAuthGuard, AdminRoleGuard],
})
export class AuthModule {}
