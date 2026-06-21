import type {
  AuthTokens,
  LoginInput,
  RegisterInput,
  UserPublic,
} from '@jcool/contracts';
import { apiFetch, type ApiRequestOptions } from '../api-client';

export interface AuthResult {
  user: UserPublic;
  tokens: AuthTokens;
}

export const authApi = {
  async login(input: LoginInput, options: ApiRequestOptions = {}): Promise<AuthResult> {
    return apiFetch<AuthResult>('/auth/login', { ...options, method: 'POST', body: input });
  },

  async register(input: RegisterInput, options: ApiRequestOptions = {}): Promise<AuthResult> {
    return apiFetch<AuthResult>('/auth/register', { ...options, method: 'POST', body: input });
  },

  async me(options: ApiRequestOptions = {}): Promise<UserPublic> {
    return apiFetch<UserPublic>('/auth/me', options);
  },

  async refresh(refreshToken: string, options: ApiRequestOptions = {}): Promise<{ tokens: AuthTokens }> {
    return apiFetch<{ tokens: AuthTokens }>('/auth/refresh', {
      ...options,
      method: 'POST',
      body: { refreshToken },
    });
  },
};
