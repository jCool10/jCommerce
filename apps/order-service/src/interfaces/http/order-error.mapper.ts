import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { OrderError } from '../../domain/order-error.js';

export const toHttpException = (error: OrderError): HttpException => {
  switch (error.kind) {
    case 'INVALID_TRANSITION':
      return new ConflictException({
        code: error.kind,
        message: `Cannot transition order from ${error.from} to ${error.to}`,
      });
    case 'PAYMENT_INTENT_MISSING':
      return new ConflictException({
        code: error.kind,
        message: 'Order is missing a payment intent',
      });
    case 'PAYMENT_INTENT_ALREADY_SET':
      return new ConflictException({
        code: error.kind,
        message: 'Order already has a payment intent attached',
      });
    case 'CART_EMPTY':
      return new BadRequestException({ code: error.kind, message: 'Cart is empty' });
    case 'CART_NOT_FOUND':
      return new NotFoundException({
        code: error.kind,
        message: `Cart ${error.sessionKey} not found`,
      });
    case 'CART_CURRENCY_LOCKED':
      return new ConflictException({
        code: error.kind,
        message: `Cart is locked to ${error.locked}; cannot mix with ${error.attempted}`,
      });
    case 'CART_ITEM_NOT_FOUND':
      return new NotFoundException({
        code: error.kind,
        message: `Item ${error.skuId} not in cart`,
      });
    case 'INVALID_QUANTITY':
      return new BadRequestException({
        code: error.kind,
        message: 'Invalid quantity',
        details: { reason: error.reason },
      });
    case 'SKU_NOT_FOUND':
      return new NotFoundException({
        code: error.kind,
        message: `SKU ${error.skuId} not found`,
      });
    case 'SKU_PRICE_MISSING':
      return new BadRequestException({
        code: error.kind,
        message: `SKU ${error.skuId} has no price in ${error.currency}`,
      });
    case 'INSUFFICIENT_STOCK':
      return new ConflictException({
        code: error.kind,
        message: `Insufficient stock for SKU ${error.skuId}`,
        details: {
          skuId: error.skuId,
          requested: error.requested,
          available: error.available,
        },
      });
    case 'CATALOG_UNAVAILABLE':
      return new ServiceUnavailableException({
        code: error.kind,
        message: 'Catalog service unavailable',
        details: { reason: error.reason },
      });
    case 'PAYMENT_GATEWAY_FAILED':
      return new BadRequestException({
        code: error.kind,
        message: 'Payment failed',
        details: { reason: error.reason },
      });
    case 'PAYMENT_INTENT_MISMATCH':
      return new ConflictException({
        code: error.kind,
        message: 'Payment intent mismatch',
        details: { expected: error.expected, got: error.got },
      });
    case 'ORDER_NOT_FOUND':
      return new NotFoundException({
        code: error.kind,
        message: `Order ${error.orderId} not found`,
      });
    case 'UNAUTHORIZED':
      return new UnauthorizedException({ code: error.kind, message: 'Unauthorized' });
    case 'FORBIDDEN':
      return new ForbiddenException({ code: error.kind, message: 'Forbidden' });
    default: {
      const _exhaustive: never = error;
      void _exhaustive;
      return new InternalServerErrorException({ code: 'UNKNOWN', message: 'Unknown error' });
    }
  }
};
