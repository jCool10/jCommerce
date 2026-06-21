import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import type { Request } from 'express';
import { HandleStripeWebhookUseCase } from '../../../src/application/use-cases/payment/handle-stripe-webhook.use-case.js';
import { StripeWebhooksController } from '../../../src/interfaces/http/stripe-webhooks.controller.js';
import type {
  StripeEventEnvelope,
  StripeSignatureVerifier,
} from '../../../src/infrastructure/stripe/stripe-signature-verifier.port.js';
import { InMemoryWebhookEventRepository } from '../../fakes/in-memory-webhook-event.repository.js';
import { FakeDirectEventPublisher } from '../../fakes/fake-direct-event-publisher.js';

const ORDER = '11111111-1111-1111-1111-111111111111';

const makeReq = (raw?: Buffer): Request =>
  ({ rawBody: raw } as unknown as Request);

const succeededEvent: StripeEventEnvelope = {
  id: 'evt_succeeded_1',
  type: 'payment_intent.succeeded',
  created: Math.floor(new Date('2026-06-18T00:00:00Z').getTime() / 1000),
  data: {
    object: {
      id: 'pi_test_1',
      amount: 1500,
      currency: 'usd',
      metadata: { orderId: ORDER },
    },
  },
};

const buildSut = (verifier: StripeSignatureVerifier) => {
  const webhookEvents = new InMemoryWebhookEventRepository();
  const publisher = new FakeDirectEventPublisher();
  const useCase = new HandleStripeWebhookUseCase(webhookEvents, publisher);
  const sut = new StripeWebhooksController(verifier, useCase);
  return { sut, webhookEvents, publisher };
};

describe('StripeWebhooksController — bad inputs', () => {
  it('throws 400 when stripe-signature header is missing', async () => {
    const verifier: StripeSignatureVerifier = { constructEvent: vi.fn() };
    const { sut, webhookEvents } = buildSut(verifier);
    await expect(
      sut.receive(undefined, makeReq(Buffer.from('{}'))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(webhookEvents.records).toHaveLength(0);
    expect(verifier.constructEvent).not.toHaveBeenCalled();
  });

  it('throws 500 when raw body is missing (parser misconfigured)', async () => {
    const verifier: StripeSignatureVerifier = { constructEvent: vi.fn() };
    const { sut } = buildSut(verifier);
    await expect(sut.receive('sig', makeReq(undefined))).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
    expect(verifier.constructEvent).not.toHaveBeenCalled();
  });

  it('throws 400 on signature verification failure — NO db write', async () => {
    const verifier: StripeSignatureVerifier = {
      constructEvent: vi.fn(() => {
        throw new Error('bad signature');
      }),
    };
    const { sut, webhookEvents } = buildSut(verifier);
    await expect(
      sut.receive('sig_bad', makeReq(Buffer.from('payload'))),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(webhookEvents.records).toHaveLength(0);
  });
});

describe('StripeWebhooksController — happy path', () => {
  it('verifies signature, records event, publishes payment.succeeded, returns 200', async () => {
    const verifier: StripeSignatureVerifier = {
      constructEvent: vi.fn(() => succeededEvent),
    };
    const { sut, webhookEvents, publisher } = buildSut(verifier);

    const result = await sut.receive(
      't=1,v1=sig',
      makeReq(Buffer.from('{"id":"evt"}')),
    );

    expect(result).toEqual({ received: true, idempotent: false });
    expect(webhookEvents.records).toHaveLength(1);
    expect(publisher.published).toHaveLength(1);
    expect(publisher.published[0]!.routingKey).toBe('payment.succeeded');
  });

  it('replays return idempotent=true and do not double-publish', async () => {
    const verifier: StripeSignatureVerifier = {
      constructEvent: vi.fn(() => succeededEvent),
    };
    const { sut, publisher } = buildSut(verifier);

    const first = await sut.receive('sig', makeReq(Buffer.from('{}')));
    const second = await sut.receive('sig', makeReq(Buffer.from('{}')));

    expect(first.idempotent).toBe(false);
    expect(second.idempotent).toBe(true);
    expect(publisher.published).toHaveLength(1);
  });

  it('returns 200 for unhandled event types without publishing', async () => {
    const invoice: StripeEventEnvelope = {
      ...succeededEvent,
      id: 'evt_inv',
      type: 'invoice.created',
      data: { object: {} },
    };
    const verifier: StripeSignatureVerifier = {
      constructEvent: vi.fn(() => invoice),
    };
    const { sut, webhookEvents, publisher } = buildSut(verifier);

    const r = await sut.receive('sig', makeReq(Buffer.from('{}')));
    expect(r.received).toBe(true);
    expect(webhookEvents.records).toHaveLength(1);
    expect(webhookEvents.records[0]!.type).toBe('invoice.created');
    expect(publisher.published).toHaveLength(0);
  });
});
