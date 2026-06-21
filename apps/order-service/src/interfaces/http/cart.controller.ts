import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Request } from 'express';
import { isErr } from '../../domain/common/result.js';
import { AddToCartUseCase } from '../../application/use-cases/cart/add-to-cart.use-case.js';
import { RemoveFromCartUseCase } from '../../application/use-cases/cart/remove-from-cart.use-case.js';
import { UpdateCartQuantityUseCase } from '../../application/use-cases/cart/update-cart-quantity.use-case.js';
import { ClearCartUseCase } from '../../application/use-cases/cart/clear-cart.use-case.js';
import { GetCartUseCase, type CartView } from '../../application/use-cases/cart/get-cart.use-case.js';
import { MergeGuestCartUseCase } from '../../application/use-cases/cart/merge-guest-cart.use-case.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { ZodValidationPipe } from '@jcool/nest-kit';
import { toHttpException } from './order-error.mapper.js';
import {
  AddToCartBodySchema,
  MergeCartBodySchema,
  UpdateCartItemBodySchema,
  type AddToCartBody,
  type MergeCartBody,
  type UpdateCartItemBody,
} from './dto/cart.dto.js';
import { resolveSessionKey } from './session-key.js';

@Controller({ path: 'cart', version: '1' })
export class CartController {
  constructor(
    private readonly getCart: GetCartUseCase,
    private readonly addToCart: AddToCartUseCase,
    private readonly updateQty: UpdateCartQuantityUseCase,
    private readonly remove: RemoveFromCartUseCase,
    private readonly clear: ClearCartUseCase,
    private readonly merge: MergeGuestCartUseCase,
  ) {}

  @Get()
  async show(@Req() req: Request): Promise<CartView> {
    const result = await this.getCart.execute({ sessionKey: resolveSessionKey(req) });
    if (isErr(result)) throw toHttpException(result.error);
    return result.value;
  }

  // each mutation returns the cart it just persisted and enriches it locally,
  // so we avoid a refetch and the read-after-write race two concurrent writers
  // on the same session would otherwise hit
  @Post('items')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(AddToCartBodySchema))
  async add(@Req() req: Request, @Body() body: AddToCartBody): Promise<CartView> {
    const sessionKey = resolveSessionKey(req);
    const result = await this.addToCart.execute({ sessionKey, ...body });
    if (isErr(result)) throw toHttpException(result.error);
    return this.viewOf(result.value);
  }

  @Put('items/:skuId')
  async update(
    @Req() req: Request,
    @Param('skuId', new ParseUUIDPipe({ version: '4' })) skuId: string,
    @Body(new ZodValidationPipe(UpdateCartItemBodySchema)) body: UpdateCartItemBody,
  ): Promise<CartView> {
    const sessionKey = resolveSessionKey(req);
    const result = await this.updateQty.execute({ sessionKey, skuId, quantity: body.quantity });
    if (isErr(result)) throw toHttpException(result.error);
    return this.viewOf(result.value);
  }

  @Delete('items/:skuId')
  async drop(
    @Req() req: Request,
    @Param('skuId', new ParseUUIDPipe({ version: '4' })) skuId: string,
  ): Promise<CartView> {
    const sessionKey = resolveSessionKey(req);
    const result = await this.remove.execute({ sessionKey, skuId });
    if (isErr(result)) throw toHttpException(result.error);
    return this.viewOf(result.value);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async drain(@Req() req: Request): Promise<void> {
    const sessionKey = resolveSessionKey(req);
    const result = await this.clear.execute({ sessionKey });
    if (isErr(result)) throw toHttpException(result.error);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async mergeGuest(
    @Req() req: Request,
    @Body(new ZodValidationPipe(MergeCartBodySchema)) body: MergeCartBody,
  ): Promise<CartView & { conflictDropped: boolean }> {
    const userSessionKey = resolveSessionKey(req);
    const result = await this.merge.execute({
      guestSessionKey: `guest:${body.guestSessionKey}`,
      userSessionKey,
    });
    if (isErr(result)) throw toHttpException(result.error);
    const view = await this.viewOf(result.value.cart);
    return { ...view, conflictDropped: result.value.conflictDropped };
  }

  private async viewOf(cart: import('../../domain/cart.entity.js').Cart): Promise<CartView> {
    const result = await this.getCart.enrich(cart);
    if (isErr(result)) throw toHttpException(result.error);
    return result.value;
  }
}
