import { Logger } from '@nestjs/common';
import { Command, CommandRunner } from 'nest-commander';
import { ReindexService } from './reindex.service.js';

@Command({
  name: 'reindex',
  description: 'Bulk-pull products from catalog-service and rebuild the search index (alias swap).',
})
export class ReindexCommand extends CommandRunner {
  private readonly logger = new Logger(ReindexCommand.name);

  constructor(private readonly reindex: ReindexService) {
    super();
  }

  async run(): Promise<void> {
    this.logger.log('Starting reindex…');
    const report = await this.reindex.run();
    this.logger.log(
      `Reindex finished: indexed=${report.indexed} skipped=${report.skipped} newIndex=${report.newIndex} (${report.durationMs}ms)`,
    );
  }
}
