import type { NewUser, User } from '../user.entity.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(user: NewUser): Promise<User>;
  updateName(id: string, name: string): Promise<User>;
}

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');
