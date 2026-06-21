import { Logger } from '@nestjs/common';
import { Command, CommandRunner, Option } from 'nest-commander';
import { SeedCatalogUseCase } from '../../application/use-cases/seed-catalog.use-case.js';

interface SeedCatalogOptions {
  count?: number;
}

@Command({
  name: 'seed-catalog',
  description: 'Seed 150-200 demo products (Faker.js, deterministic seed=42)',
})
export class SeedCatalogCommand extends CommandRunner {
  private readonly logger = new Logger(SeedCatalogCommand.name);

  constructor(private readonly seed: SeedCatalogUseCase) {
    super();
  }

  async run(_args: string[], options: SeedCatalogOptions = {}): Promise<void> {
    const productCount = options.count ?? Number(process.env.SEED_PRODUCT_COUNT ?? 180);
    this.logger.log(`Seeding ${productCount} products…`);
    const report = await this.seed.execute({ productCount });
    this.logger.log(
      `Seed complete: ${report.categoriesCreated} categories, ${report.productsCreated} products, ${report.skusCreated} skus (${report.failures} failures)`,
    );
  }

  @Option({ flags: '-c, --count <count>', description: 'Number of products to seed' })
  parseCount(value: string): number {
    return parseInt(value, 10);
  }
}
