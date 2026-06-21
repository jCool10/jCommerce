import {
  BadRequestException,
  ConflictException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthError } from '../../domain/auth-error.js';

export const toHttpException = (error: AuthError): HttpException => {
  switch (error.kind) {
    case 'EMAIL_ALREADY_REGISTERED':
      return new ConflictException({
        code: error.kind,
        message: 'Email is already registered',
      });
    case 'INVALID_CREDENTIALS':
      return new UnauthorizedException({
        code: error.kind,
        message: 'Invalid email or password',
      });
    case 'USER_NOT_FOUND':
      return new NotFoundException({ code: error.kind, message: 'User not found' });
    case 'REFRESH_TOKEN_INVALID':
      return new UnauthorizedException({
        code: error.kind,
        message: 'Refresh token is invalid',
      });
    case 'REFRESH_TOKEN_REVOKED':
      return new UnauthorizedException({
        code: error.kind,
        message: 'Refresh token has been revoked',
      });
    case 'WEAK_PASSWORD':
      return new BadRequestException({
        code: error.kind,
        message: 'Password does not meet requirements',
      });
    default: {
      const _exhaustive: never = error;
      void _exhaustive;
      return new InternalServerErrorException({ code: 'UNKNOWN', message: 'Unknown error' });
    }
  }
};
