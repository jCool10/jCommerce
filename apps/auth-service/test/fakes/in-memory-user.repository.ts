import { randomUUID } from 'node:crypto';
import type { NewUser, User } from '../../src/domain/user.entity.js';
import type { UserRepository } from '../../src/domain/ports/user.repository.js';

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, User>();

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email === normalized) return u;
    }
    return null;
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async create(input: NewUser): Promise<User> {
    const now = new Date();
    const user: User = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      name: input.name,
      role: input.role,
      provider: input.provider,
      passwordHash: input.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async updateName(id: string, name: string): Promise<User> {
    const existing = this.users.get(id);
    if (!existing) throw new Error(`User ${id} not found`);
    const updated: User = { ...existing, name, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  // test helper
  size(): number {
    return this.users.size;
  }
}
