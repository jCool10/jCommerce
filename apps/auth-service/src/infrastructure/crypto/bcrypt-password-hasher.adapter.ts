import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import type { PasswordHasher } from '../../application/ports/password-hasher.port.js';

@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  private readonly cost: number;

  constructor(config: ConfigService) {
    this.cost = Number(config.get<string>('BCRYPT_COST') ?? '12');
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.cost);
  }

  compare(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
