import { Module } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';

@Module({
  providers: [JwtVerifierService, JwtAuthGuard],
  exports: [JwtVerifierService, JwtAuthGuard],
})
export class AuthModule {}
