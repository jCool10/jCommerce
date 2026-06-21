import { describe, it, expect, vi } from 'vitest';
import { processOrderConfirmationJob } from '../src/modules/worker/email-worker.processor.js';
import type { OrderConfirmationJob } from '../src/modules/queue/email-job-enqueuer.port.js';

const job: OrderConfirmationJob = {
  orderId: '11111111-1111-1111-1111-111111111111',
  userId: '22222222-2222-2222-2222-222222222222',
  userEmail: 'buyer@example.com',
  total: { amount: 4999, currency: 'USD' },
  confirmedAt: '2026-06-18T10:00:00.000Z',
  stripePaymentIntentId: 'pi_test_123',
};

describe('processOrderConfirmationJob', () => {
  it('renders the order-confirmation template and sends via SMTP', async () => {
    const render = vi.fn().mockResolvedValue({
      subject: 'Order confirmed',
      html: '<p>thanks</p>',
      text: 'thanks',
    });
    const send = vi.fn().mockResolvedValue({ messageId: 'm-1' });

    await processOrderConfirmationJob(job, { renderer: { renderOrderConfirmation: render }, smtp: { send } });

    expect(render).toHaveBeenCalledWith(job);
    expect(send).toHaveBeenCalledWith({
      to: job.userEmail,
      subject: 'Order confirmed',
      html: '<p>thanks</p>',
      text: 'thanks',
    });
  });

  it('propagates SMTP errors so BullMQ records the failed attempt and retries', async () => {
    const render = vi.fn().mockResolvedValue({ subject: 's', html: 'h', text: 't' });
    const send = vi.fn().mockRejectedValue(new Error('smtp 421'));

    await expect(
      processOrderConfirmationJob(job, {
        renderer: { renderOrderConfirmation: render },
        smtp: { send },
      }),
    ).rejects.toThrow(/smtp 421/);
  });

  it('propagates render errors before any SMTP call (no partial sends)', async () => {
    const render = vi.fn().mockRejectedValue(new Error('mjml broke'));
    const send = vi.fn();

    await expect(
      processOrderConfirmationJob(job, {
        renderer: { renderOrderConfirmation: render },
        smtp: { send },
      }),
    ).rejects.toThrow(/mjml broke/);
    expect(send).not.toHaveBeenCalled();
  });
});
