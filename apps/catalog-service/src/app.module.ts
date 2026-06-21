import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ObservabilityModule } from '@jcool/observability';

import { ProductsController } from './interfaces/http/products.controller.js';
import { InventoryController } from './interfaces/http/inventory.controller.js';
import { OutboxAdminController } from './interfaces/http/outbox-admin.controller.js';
import { JwtAuthGuard } from './interfaces/http/jwt-auth.guard.js';
import { AdminRoleGuard } from '@jcool/nest-kit';
import { SeedCatalogCommand } from './interfaces/cli/seed-catalog.command.js';

import { CreateProductUseCase } from './application/use-cases/create-product.use-case.js';
import { UpdateProductUseCase } from './application/use-cases/update-product.use-case.js';
import { DeleteProductUseCase } from './application/use-cases/delete-product.use-case.js';
import { UpsertSkuUseCase } from './application/use-cases/upsert-sku.use-case.js';
import { ListProductsUseCase } from './application/use-cases/list-products.use-case.js';
import { GetProductUseCase } from './application/use-cases/get-product.use-case.js';
import { ReserveInventoryUseCase } from './application/use-cases/reserve-inventory.use-case.js';
import { ReleaseInventoryUseCase } from './application/use-cases/release-inventory.use-case.js';
import { SeedCatalogUseCase } from './application/use-cases/seed-catalog.use-case.js';

import { PRODUCT_REPOSITORY, type ProductRepository } from './domain/ports/product.repository.js';
import {
  INVENTORY_REPOSITORY,
  type InventoryRepository,
} from './domain/ports/inventory.repository.js';
import {
  CATEGORY_REPOSITORY,
  type CategoryRepository,
} from './domain/ports/category.repository.js';
import { RESERVATION_REPOSITORY } from './domain/ports/reservation.repository.js';
import { OUTBOX_REPOSITORY } from './domain/ports/outbox.repository.js';

import { PrismaService } from './infrastructure/persistence/prisma.service.js';
import { RedisService } from './infrastructure/cache/redis.service.js';
import { PrismaProductRepository } from './infrastructure/persistence/prisma-product.repository.js';
import { CachedProductRepository } from './infrastructure/persistence/cached-product.repository.js';
import { PrismaInventoryRepository } from './infrastructure/persistence/prisma-inventory.repository.js';
import { PrismaCategoryRepository } from './infrastructure/persistence/prisma-category.repository.js';
import { PrismaReservationRepository } from './infrastructure/persistence/prisma-reservation.repository.js';
import { PrismaOutboxRepository } from './infrastructure/persistence/prisma-outbox.repository.js';
import { RabbitMqEventPublisher } from './infrastructure/messaging/rabbitmq-event-publisher.adapter.js';
import { OutboxPollerCron } from './infrastructure/messaging/outbox-poller.cron.js';
import { JwtVerifier } from './infrastructure/auth/jwt-verifier.adapter.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    ScheduleModule.forRoot(),
    ObservabilityModule.forRoot({ service: 'catalog-service' }),
  ],
  controllers: [ProductsController, InventoryController, OutboxAdminController],
  providers: [
    PrismaService,
    RedisService,
    PrismaProductRepository,
    JwtVerifier,
    JwtAuthGuard,
    AdminRoleGuard,
    RabbitMqEventPublisher,
    OutboxPollerCron,
    SeedCatalogCommand,

    {
      provide: PRODUCT_REPOSITORY,
      inject: [PrismaProductRepository, RedisService, ConfigService],
      useFactory: (inner: ProductRepository, redis: RedisService, config: ConfigService) =>
        new CachedProductRepository(inner, redis, config),
    },
    { provide: INVENTORY_REPOSITORY, useClass: PrismaInventoryRepository },
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: RESERVATION_REPOSITORY, useClass: PrismaReservationRepository },
    { provide: OUTBOX_REPOSITORY, useClass: PrismaOutboxRepository },

    {
      provide: CreateProductUseCase,
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY, INVENTORY_REPOSITORY],
      useFactory: (
        products: ProductRepository,
        categories: CategoryRepository,
        inventory: InventoryRepository,
      ) => new CreateProductUseCase(products, categories, inventory),
    },
    {
      provide: UpdateProductUseCase,
      inject: [PRODUCT_REPOSITORY, CATEGORY_REPOSITORY],
      useFactory: (products: ProductRepository, categories: CategoryRepository) =>
        new UpdateProductUseCase(products, categories),
    },
    {
      provide: DeleteProductUseCase,
      inject: [PRODUCT_REPOSITORY],
      useFactory: (products: ProductRepository) => new DeleteProductUseCase(products),
    },
    {
      provide: UpsertSkuUseCase,
      inject: [PRODUCT_REPOSITORY, INVENTORY_REPOSITORY],
      useFactory: (products: ProductRepository, inventory: InventoryRepository) =>
        new UpsertSkuUseCase(products, inventory),
    },
    {
      provide: ListProductsUseCase,
      inject: [PRODUCT_REPOSITORY, INVENTORY_REPOSITORY],
      useFactory: (products: ProductRepository, inventory: InventoryRepository) =>
        new ListProductsUseCase(products, inventory),
    },
    {
      provide: GetProductUseCase,
      inject: [PRODUCT_REPOSITORY, INVENTORY_REPOSITORY],
      useFactory: (products: ProductRepository, inventory: InventoryRepository) =>
        new GetProductUseCase(products, inventory),
    },
    {
      provide: ReserveInventoryUseCase,
      inject: [INVENTORY_REPOSITORY],
      useFactory: (inventory: InventoryRepository) => new ReserveInventoryUseCase(inventory),
    },
    {
      provide: ReleaseInventoryUseCase,
      inject: [INVENTORY_REPOSITORY],
      useFactory: (inventory: InventoryRepository) => new ReleaseInventoryUseCase(inventory),
    },
    {
      provide: SeedCatalogUseCase,
      inject: [CATEGORY_REPOSITORY, INVENTORY_REPOSITORY, CreateProductUseCase],
      useFactory: (
        categories: CategoryRepository,
        inventory: InventoryRepository,
        create: CreateProductUseCase,
      ) => new SeedCatalogUseCase(categories, inventory, create),
    },
  ],
})
export class AppModule {}
