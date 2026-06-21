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
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import type { Product as ProductDto } from '@jcool/contracts';
import { isErr } from '../../domain/common/result.js';
import { CreateProductUseCase } from '../../application/use-cases/create-product.use-case.js';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.use-case.js';
import { DeleteProductUseCase } from '../../application/use-cases/delete-product.use-case.js';
import { UpsertSkuUseCase } from '../../application/use-cases/upsert-sku.use-case.js';
import { ListProductsUseCase } from '../../application/use-cases/list-products.use-case.js';
import { GetProductUseCase } from '../../application/use-cases/get-product.use-case.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { AdminRoleGuard, ZodValidationPipe } from '@jcool/nest-kit';
import { toHttpException } from './catalog-error.mapper.js';
import { toProductDto } from './product-view.mapper.js';
import {
  CreateProductBodySchema,
  GetProductQuerySchema,
  ListProductsQuerySchema,
  UpdateProductBodySchema,
  UpsertSkuBodySchema,
  type CreateProductBody,
  type GetProductQuery,
  type ListProductsQuery,
  type UpdateProductBody,
  type UpsertSkuBody,
} from './dto/admin-product.dto.js';

@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(
    private readonly createProduct: CreateProductUseCase,
    private readonly updateProduct: UpdateProductUseCase,
    private readonly deleteProduct: DeleteProductUseCase,
    private readonly upsertSku: UpsertSkuUseCase,
    private readonly listProducts: ListProductsUseCase,
    private readonly getProduct: GetProductUseCase,
  ) {}

  @Get()
  @UsePipes(new ZodValidationPipe(ListProductsQuerySchema))
  async list(
    @Query() query: ListProductsQuery,
  ): Promise<{ items: ProductDto[]; nextCursor: string | null }> {
    const result = await this.listProducts.execute(query);
    if (isErr(result)) throw toHttpException(result.error);
    return {
      items: result.value.items.map(toProductDto),
      nextCursor: result.value.nextCursor,
    };
  }

  @Get(':id')
  async getOne(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Query(new ZodValidationPipe(GetProductQuerySchema)) query: GetProductQuery,
  ): Promise<ProductDto> {
    const result = await this.getProduct.execute({
      productId: id,
      currency: query.currency,
      includeInactive: query.include_inactive,
    });
    if (isErr(result)) throw toHttpException(result.error);
    return toProductDto(result.value);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  @UsePipes(new ZodValidationPipe(CreateProductBodySchema))
  async create(@Body() body: CreateProductBody): Promise<ProductDto> {
    const result = await this.createProduct.execute(body);
    if (isErr(result)) throw toHttpException(result.error);
    return toProductDto(result.value);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(UpdateProductBodySchema)) body: UpdateProductBody,
  ): Promise<ProductDto> {
    const result = await this.updateProduct.execute({ productId: id, ...body });
    if (isErr(result)) throw toHttpException(result.error);
    return toProductDto(result.value);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<void> {
    const result = await this.deleteProduct.execute({ productId: id });
    if (isErr(result)) throw toHttpException(result.error);
  }

  @Post(':id/skus')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async createSku(
    @Param('id', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body(new ZodValidationPipe(UpsertSkuBodySchema)) body: UpsertSkuBody,
  ): Promise<{ skuId: string }> {
    const result = await this.upsertSku.execute({ productId, ...body });
    if (isErr(result)) throw toHttpException(result.error);
    return { skuId: result.value.id };
  }

  @Put(':id/skus')
  @UseGuards(JwtAuthGuard, AdminRoleGuard)
  async upsertSkuRoute(
    @Param('id', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body(new ZodValidationPipe(UpsertSkuBodySchema)) body: UpsertSkuBody,
  ): Promise<{ skuId: string }> {
    const result = await this.upsertSku.execute({ productId, ...body });
    if (isErr(result)) throw toHttpException(result.error);
    return { skuId: result.value.id };
  }
}
