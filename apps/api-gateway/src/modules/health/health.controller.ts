import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthAggregator } from './health-aggregator.js';

/**
 * `GET /health` doubles as the Cloud Run / K8s readiness probe. Returns 503
 * when any downstream is `down` so the orchestrator takes the gateway out of
 * rotation while operators still get the per-service status map in the body.
 * Registered outside `/api/v1` on purpose — it is gateway-local, not part of
 * the public API surface.
 */
@Controller()
export class HealthController {
  constructor(private readonly aggregator: HealthAggregator) {}

  @Get('health')
  async health(@Res() res: Response): Promise<void> {
    const snapshot = await this.aggregator.check();
    const status = snapshot.status === 'up' ? 200 : 503;
    res.status(status).json({ gateway: 'up', ...snapshot });
  }
}
