import { describe, expect, it, vi } from 'vitest';
import { isErr, isOk } from '../../src/domain/common/result.js';
import { StripePaymentGatewayAdapter } from '../../src/infrastructure/stripe/stripe-payment-gateway.adapter.js';
import type { StripePaymentIntentsClient } from '../../src/infrastructure/stripe/stripe-payment-intents.port.js';

const ORDER = '11111111-1111-1111-1111-111111111111';

const makeClient = (
  impl: Partial<StripePaymentIntentsClient>,
): StripePaymentIntentsClient => ({
  create: vi.fn(),
  ...impl,
}) as StripePaymentIntentsClient;

describe('StripePaymentGatewayAdapter — createIntent', () => {
  it('calls Stripe SDK with idempotencyKey=orderId, lowercased currency, metadata.orderId', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'pi_live_abc',
      client_secret: 'pi_live_abc_secret',
    });
    const adapter = new StripePaymentGatewayAdapter(makeClient({ create }));

    const r = await adapter.createIntent({
      orderId: ORDER,
      amount: 1500,
      currency: 'USD',
    });

    expect(isOk(r)).toBe(true);
    if (isOk(r)) {
      expect(r.value.stripePaymentIntentId).toBe('pi_live_abc');
      expect(r.value.clientSecret).toBe('pi_live_abc_secret');
    }
    expect(create).toHaveBeenCalledTimes(1);
    const [params, options] = (create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(params.amount).toBe(1500);
    expect(params.currency).toBe('usd');
    expect(params.metadata.orderId).toBe(ORDER);
    expect(options.idempotencyKey).toBe(ORDER);
  });

  it('supports VND amounts (đồng — already integer subunit)', async () => {
    const create = vi.fn().mockResolvedValue({
      id: 'pi_vnd',
      client_secret: 'pi_vnd_secret',
    });
    const adapter = new StripePaymentGatewayAdapter(makeClient({ create }));
    await adapter.createIntent({ orderId: ORDER, amount: 350_000, currency: 'VND' });
    const [params] = (create as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(params.amount).toBe(350_000);
    expect(params.currency).toBe('vnd');
  });

  it('returns PAYMENT_GATEWAY_FAILED when Stripe SDK throws', async () => {
    const create = vi.fn().mockRejectedValue(new Error('rate_limited'));
    const adapter = new StripePaymentGatewayAdapter(makeClient({ create }));
    const r = await adapter.createIntent({
      orderId: ORDER,
      amount: 1500,
      currency: 'USD',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.kind).toBe('PAYMENT_GATEWAY_FAILED');
      if (r.error.kind === 'PAYMENT_GATEWAY_FAILED') {
        expect(r.error.reason).toContain('rate_limited');
      }
    }
  });

  it('returns error if Stripe response omits client_secret', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pi_x', client_secret: null });
    const adapter = new StripePaymentGatewayAdapter(makeClient({ create }));
    const r = await adapter.createIntent({
      orderId: ORDER,
      amount: 1500,
      currency: 'USD',
    });
    expect(isErr(r)).toBe(true);
    if (isErr(r) && r.error.kind === 'PAYMENT_GATEWAY_FAILED') {
      expect(r.error.reason).toMatch(/client_secret/);
    }
  });
});
