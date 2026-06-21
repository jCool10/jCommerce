import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { isErr } from '../../domain/common/result.js';
import { StartCheckoutUseCase } from '../../application/use-cases/saga/start-checkout.use-case.js';
import { GetOrderUseCase } from '../../application/use-cases/orders/get-order.use-case.js';
import { ListUserOrdersUseCase } from '../../application/use-cases/orders/list-user-orders.use-case.js';
import { ListAllOrdersUseCase } from '../../application/use-cases/orders/list-all-orders.use-case.js';
import { UpdateOrderStatusUseCase } from '../../application/use-cases/orders/update-order-status.use-case.js';
import { JwtAuthGuard, type AuthenticatedRequest } from './jwt-auth.guard.js';
import { AdminRoleGuard, ZodValidationPipe } from '@jcool/nest-kit';
import { toHttpException } from './order-error.mapper.js';
import { toOrderView, type OrderView } from './order-view.mapper.js';
import {
  CheckoutBodySchema,
  ListOrdersQuerySchema,
  UpdateOrderStatusBodySchema,
  type CheckoutBody,
  type ListOrdersQuery,
  type UpdateOrderStatusBody,
} from './dto/checkout.dto.js';
import { resolveSessionKey } from './session-key.js';

@Controller({ version: '1' })
export class OrdersController {
  constructor(
    private readonly start: StartCheckoutUseCase,
    private readonly getOne: GetOrderUseCase,
    private readonly listMine: ListUserOrdersUseCase,
    private readonly listAll: ListAllOrdersUseCase,
    private readonly updateStatus: UpdateOrderStatusUseCase,
  ) {}

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(CheckoutBodySchema))
  async checkout(
    @Req() req: AuthenticatedRequest,
    @Body() body: CheckoutBody,
  ): Promise<{ orderId: string; clientSecret: string }> {
    const sessionKey = resolveSessionKey(req);
    const result = await this.start.execute({
      sessionKey,
      userId: req.authUser.sub,
      shippingAddress: body.shippingAddress,
    });
    if (isErr(result)) throw toHttpException(result.error);
    return result.value;
  }

  @Get('orders')
  @UseGuards(JwtAuthGuard)
  async list(
    @Req() req: AuthenticatedRequest,
    @Query(new ZodValidationPipe(ListOrdersQuerySchema)) q: ListOrdersQuery,
  ): Promise<{ items: OrderView[]; nextCursor: string | null }> {
    const page =
      req.authUser.role === 'admin'
        ? await this.listAll.execute({ cursor: q.cursor ?? null, limit: q.limit })
        : await this.listMine.execute({
            userId: req.authUser.sub,
            cursor: q.cursor ?? null,
            limit: q.limit,
          });
    if (isErr(page)) throw toHttpException(page.error);
    return {
      items: page.value.items.map(toOrderView),
      nextCursor: page.value.nextCursor,
    };
  }

  @Get('orders/:id')
  @UseGuards(JwtAuthGuard)
  async getOneRoute(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<OrderView> {
    const result = await this.getOne.execute({
      orderId: id,
      requesterId: req.authUser.sub,
      requesterRole: req.authUser.role,
    });
    if (isErr(result)) throw toHttpException(result.error);
    return toOrderView(result.value);
  }

  @Patch('orders/:id/status')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async patchStatus(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(UpdateOrderStatusBodySchema)) body: UpdateOrderStatusBody,
  ): Promise<OrderView> {
    const result = await this.updateStatus.execute({ orderId: id, to: body.status });
    if (isErr(result)) throw toHttpException(result.error);
    return toOrderView(result.value);
  }
}
