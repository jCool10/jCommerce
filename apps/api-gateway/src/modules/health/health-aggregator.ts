import { Injectable } from '@nestjs/common';
import type { ServiceUrls } from '../proxy/service-registry.js';

export type HealthCheckFn = (url: string, timeoutMs: number) => Promise<boolean>;

type ServiceName = keyof ServiceUrls;
type Status = 'up' | 'down';

export interface HealthSnapshot {
  status: 'up' | 'degraded';
  services: Record<ServiceName, Status>;
}

/**
 * Fan-out /health probe across the 4 backing services. Returns `up` only when
 * every downstream is up; one failing downstream → `degraded` so an orchestrator
 * can keep routing while a partial outage is visible to operators.
 */
@Injectable()
export class HealthAggregator {
  constructor(
    private readonly urls: ServiceUrls,
    private readonly probe: HealthCheckFn,
    private readonly timeoutMs: number,
  ) {}

  async check(): Promise<HealthSnapshot> {
    const names: ServiceName[] = ['auth', 'catalog', 'order', 'search'];
    const results = await Promise.all(
      names.map(async (name): Promise<[ServiceName, Status]> => {
        try {
          const ok = await this.probe(`${this.urls[name]}/health`, this.timeoutMs);
          return [name, ok ? 'up' : 'down'];
        } catch {
          return [name, 'down'];
        }
      }),
    );
    const services = Object.fromEntries(results) as Record<ServiceName, Status>;
    const allUp = Object.values(services).every((s) => s === 'up');
    return { status: allUp ? 'up' : 'degraded', services };
  }
}
