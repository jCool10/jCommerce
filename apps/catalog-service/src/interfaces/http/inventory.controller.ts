import { Body, Controller, HttpCode, HttpStatus, Post, UsePipes } from '@nestjs/common';
import { isErr } from '../../domain/common/result.js';
import { ReserveInventoryUseCase } from '../../application/use-cases/reserve-inventory.use-case.js';
import { ReleaseInventoryUseCase } from '../../application/use-cases/release-inventory.use-case.js';
import { ZodValidationPipe } from '@jcool/nest-kit';
import { toHttpException } from './catalog-error.mapper.js';
import {
  ReleaseInventoryBodySchema,
  ReserveInventoryBodySchema,
  type ReleaseInventoryBody,
  type ReserveInventoryBody,
} from './dto/inventory.dto.js';

/**
 * Internal-only endpoints called by order-service during the checkout saga.
 *
 * SECURITY (MVP): Authorization relies on network isolation — the API gateway
 * (Phase 10) does NOT route `/api/v1/inventory/*` to the public, and in Cloud
 * Run (Phase 15) the catalog service is internal-ingress only. There is no
 * application-layer guard here yet.
 *
 * TODO (post-MVP): replace the network-trust assumption with an
 * `InternalServiceGuard` that verifies a shared `X-Internal-Token` header
 * against `INTERNAL_API_TOKEN` env. Order-service will need to send the
 * token. Defer until order-service ships (Phase 7) so the contract is
 * round-tripped end-to-end.
 */
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(
    private readonly reserve: ReserveInventoryUseCase,
    private readonly release: ReleaseInventoryUseCase,
  ) {}

  @Post('reserve')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ReserveInventoryBodySchema))
  async reserveRoute(@Body() body: ReserveInventoryBody): Promise<{ reservedSkuIds: string[] }> {
    const result = await this.reserve.execute(body);
    if (isErr(result)) throw toHttpException(result.error);
    return { reservedSkuIds: result.value.reservedSkuIds };
  }

  @Post('release')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ZodValidationPipe(ReleaseInventoryBodySchema))
  async releaseRoute(@Body() body: ReleaseInventoryBody): Promise<{ released: true }> {
    const result = await this.release.execute(body);
    if (isErr(result)) throw toHttpException(result.error);
    return { released: true };
  }
}
