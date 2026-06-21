import { describe, it, expect } from 'vitest';
import { OrderConfirmationRendererService } from '../src/modules/templates/order-confirmation-renderer.service.js';
import type { OrderConfirmationJob } from '../src/modules/queue/email-job-enqueuer.port.js';

const job: OrderConfirmationJob = {
  orderId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userEmail: 'buyer@example.com',
  total: { amount: 4999, currency: 'USD' },
  confirmedAt: '2026-06-18T10:00:00.000Z',
  stripePaymentIntentId: 'pi_test_123',
};

describe('OrderConfirmationRendererService', () => {
  it('renders a subject with the order id (short form) and total', async () => {
    const renderer = new OrderConfirmationRendererService();
    await renderer.onModuleInit();

    const out = await renderer.renderOrderConfirmation(job);

    expect(out.subject).toMatch(/Order confirmed/i);
    expect(out.subject).toContain('11111111');
  });

  it('renders HTML containing USD-formatted total and the order id', async () => {
    const renderer = new OrderConfirmationRendererService();
    await renderer.onModuleInit();

    const out = await renderer.renderOrderConfirmation(job);

    expect(out.html).toContain('11111111-1111-1111-1111-111111111111');
    // 4999 cents = $49.99
    expect(out.html).toMatch(/\$49\.99/);
  });

  it('renders VND with no fractional digits (subunit IS the đồng)', async () => {
    const renderer = new OrderConfirmationRendererService();
    await renderer.onModuleInit();

    const out = await renderer.renderOrderConfirmation({
      ...job,
      total: { amount: 1_250_000, currency: 'VND' },
    });

    // VND has no subunit — render the integer as-is. Either symbol prefix or suffix is acceptable.
    expect(out.html).toMatch(/1,250,000/);
    expect(out.html).toMatch(/₫/);
    expect(out.html).not.toMatch(/12,500\.00/);
  });

  it('renders a plain-text fallback (no HTML tags)', async () => {
    const renderer = new OrderConfirmationRendererService();
    await renderer.onModuleInit();

    const out = await renderer.renderOrderConfirmation(job);

    expect(out.text).not.toMatch(/<[a-z]+/i);
    expect(out.text).toContain('11111111');
  });
});
