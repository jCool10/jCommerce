import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CatalogError } from '../../domain/catalog-error.js';

export const toHttpException = (error: CatalogError): HttpException => {
  switch (error.kind) {
    case 'PRODUCT_NOT_FOUND':
      return new NotFoundException({
        code: error.kind,
        message: `Product ${error.productId} not found`,
      });
    case 'PRODUCT_MISSING_SKUS':
      return new BadRequestException({
        code: error.kind,
        message: 'Product must have at least one SKU',
      });
    case 'SKU_NOT_FOUND':
      return new NotFoundException({
        code: error.kind,
        message: `SKU ${error.skuId} not found`,
      });
    case 'SKU_MISSING_DEFAULT_CURRENCY_PRICE':
      return new BadRequestException({
        code: error.kind,
        message: `SKU missing price for currency ${error.currency}`,
      });
    case 'SKU_DUPLICATE_PRICE_CURRENCY':
      return new BadRequestException({
        code: error.kind,
        message: `Duplicate price entry for currency ${error.currency}`,
      });
    case 'INVALID_PRICE':
      return new BadRequestException({
        code: error.kind,
        message: `Invalid price (${error.reason})`,
      });
    case 'INVALID_QUANTITY':
      return new BadRequestException({
        code: error.kind,
        message: 'Quantity must be a positive integer',
      });
    case 'INSUFFICIENT_STOCK':
      return new ConflictException({
        code: error.kind,
        message: `Insufficient stock for sku ${error.skuId}`,
        details: {
          skuId: error.skuId,
          requested: error.requested,
          available: error.available,
        },
      });
    case 'OVER_RELEASE':
      return new ConflictException({
        code: error.kind,
        message: 'Cannot release more than reserved',
      });
    case 'CATEGORY_NOT_FOUND':
      return new BadRequestException({
        code: error.kind,
        message: `Category ${error.categoryId} not found`,
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
