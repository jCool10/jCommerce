import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import {
  LoginInputSchema,
  RegisterInputSchema,
  type AuthTokens,
  type LoginInput,
  type RegisterInput,
  type UserPublic,
} from '@jcool/contracts';
import { z } from 'zod';
import { isErr } from '../../domain/common/result.js';
import type { User } from '../../domain/user.entity.js';
import type { SignedTokenPair } from '../../application/ports/token-signer.port.js';
import { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case.js';
import { LoginUseCase } from '../../application/use-cases/login.use-case.js';
import { RefreshTokensUseCase } from '../../application/use-cases/refresh-tokens.use-case.js';
import { LogoutUseCase } from '../../application/use-cases/logout.use-case.js';
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard.js';
import { toHttpException } from './auth-error.mapper.js';
import { ZodValidationPipe } from '@jcool/nest-kit';

const RefreshInputSchema = z.object({ refreshToken: z.string().min(10) });
const LogoutInputSchema = z.object({ refreshToken: z.string().min(10) });

const toPublic = (u: User): UserPublic => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});

const toTokens = (pair: SignedTokenPair): AuthTokens => ({
  accessToken: pair.accessToken,
  refreshToken: pair.refreshToken,
  expiresIn: pair.accessExpiresInSeconds,
});

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly registerUser: RegisterUserUseCase,
    private readonly login: LoginUseCase,
    private readonly refreshTokens: RefreshTokensUseCase,
    private readonly logoutUseCase: LogoutUseCase,
    private readonly getCurrentUser: GetCurrentUserUseCase,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UsePipes(new ZodValidationPipe(RegisterInputSchema))
  async register(
    @Body() input: RegisterInput,
  ): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const res = await this.registerUser.execute(input);
    if (isErr(res)) throw toHttpException(res.error);
    return { user: toPublic(res.value.user), tokens: toTokens(res.value.tokens) };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(LoginInputSchema))
  async loginRoute(
    @Body() input: LoginInput,
  ): Promise<{ user: UserPublic; tokens: AuthTokens }> {
    const res = await this.login.execute(input);
    if (isErr(res)) throw toHttpException(res.error);
    return { user: toPublic(res.value.user), tokens: toTokens(res.value.tokens) };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(RefreshInputSchema))
  async refresh(
    @Body() input: { refreshToken: string },
  ): Promise<{ tokens: AuthTokens }> {
    const res = await this.refreshTokens.execute(input);
    if (isErr(res)) throw toHttpException(res.error);
    return { tokens: toTokens(res.value.tokens) };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UsePipes(new ZodValidationPipe(LogoutInputSchema))
  async logout(@Body() input: { refreshToken: string }): Promise<void> {
    await this.logoutUseCase.execute(input);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: AuthenticatedRequest): Promise<UserPublic> {
    const res = await this.getCurrentUser.execute({ userId: req.authUser.sub });
    if (isErr(res)) throw toHttpException(res.error);
    return toPublic(res.value);
  }
}
