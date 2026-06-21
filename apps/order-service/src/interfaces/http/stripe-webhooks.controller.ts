import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Inject,
  InternalServerErrorException,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { HandleStripeWebhookUseCase } from '../../application/use-cases/payment/handle-stripe-webhook.use-case.js';
import { isErr } from '../../domain/common/result.js';
import {
  STRIPE_SIGNATURE_VERIFIER,
  type StripeSignatureVerifier,
} from '../../infrastructure/stripe/stripe-signature-verifier.port.js';
import { mapStripeEventToInput } from './stripe-event.mapper.js';

/**
 * Stripe webhook receiver — mounted at `/api/v1/webhooks/stripe`.
 *
 * Hardening:
 *   - Missing `stripe-signature` header → 400 (no DB write)
 *   - Signature verification failure → 400 (no DB write)
 *   - Body delivered as raw Buffer (route-scoped express.raw in main.ts);
 *     Stripe HMAC is computed over the exact wire bytes, so any prior
 *     JSON.parse() round-trip would re-serialize differently and break.
 *   - Use-case errors (rare; persistence or publish) → 500 so Stripe retries
 *   - All non-error replies are 200, including idempotent ones
 */
@Controller({ path: 'webhooks/stripe', version: '1' })
export class StripeWebhooksController {
  private readonly logger = new Logger(StripeWebhooksController.name);

  constructor(
    @Inject(STRIPE_SIGNATURE_VERIFIER)
    private readonly verifier: StripeSignatureVerifier,
    private readonly handle: HandleStripeWebhookUseCase,
  ) {}

  @Post()
  @HttpCode(200)
  async receive(
    @Headers('stripe-signature') signatureHeader: string | string[] | undefined,
    @Req() req: Request,
  ): Promise<{ received: true; idempotent: boolean }> {
    // Express types allow `string | string[]` for headers. Stripe never
    // sends an array, so a multi-valued header is a sign of tampering or a
    // misbehaving proxy — reject rather than silently picking the first.
    if (Array.isArray(signatureHeader)) {
      throw new BadRequestException('multiple stripe-signature headers');
    }
    const signature = signatureHeader;
    if (!signature) {
      throw new BadRequestException('missing stripe-signature header');
    }

    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      this.logger.error('raw body missing — express.raw parser misconfigured');
      throw new InternalServerErrorException('raw body unavailable');
    }

    let event;
    try {
      event = this.verifier.constructEvent(rawBody, signature);
    } catch (error) {
      throw new BadRequestException(
        `invalid signature: ${(error as Error).message}`,
      );
    }

    const input = mapStripeEventToInput(event);
    const result = await this.handle.execute(input);
    if (isErr(result)) {
      this.logger.error(
        `handle failed event=${event.id} kind=${result.error.kind}`,
      );
      throw new InternalServerErrorException('webhook processing failed');
    }

    return { received: true, idempotent: result.value.idempotent };
  }
}
