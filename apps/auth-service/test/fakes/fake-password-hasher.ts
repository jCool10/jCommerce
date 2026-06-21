import type { PasswordHasher } from '../../src/application/ports/password-hasher.port.js';

/** Deterministic, fast, fake hasher for unit tests — DO NOT use in production. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed::${plain}`;
  }

  async compare(plain: string, hash: string): Promise<boolean> {
    return hash === `hashed::${plain}`;
  }
}
