import { Injectable } from '@nestjs/common';
import type { User as PrismaUser, UserRole as PrismaUserRole } from '../../generated/prisma/index.js';
import type { AuthProvider } from '../../domain/auth-provider.js';
import type { NewUser, User } from '../../domain/user.entity.js';
import type { UserRepository } from '../../domain/ports/user.repository.js';
import { PrismaService } from './prisma.service.js';

const toDomain = (row: PrismaUser): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  passwordHash: row.passwordHash,
  role: row.role as PrismaUserRole,
  // DB enum still contains 'google' for legacy rows; domain no longer supports it.
  // Any non-credentials row has passwordHash: null and is rejected by LoginUseCase.
  provider: 'credentials' as AuthProvider,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

@Injectable()
export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    return row ? toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async create(input: NewUser): Promise<User> {
    const row = await this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        role: input.role,
        provider: input.provider,
      },
    });
    return toDomain(row);
  }

  async updateName(id: string, name: string): Promise<User> {
    const row = await this.prisma.user.update({ where: { id }, data: { name } });
    return toDomain(row);
  }
}
