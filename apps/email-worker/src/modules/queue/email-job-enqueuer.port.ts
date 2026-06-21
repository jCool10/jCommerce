import type { Money } from '@jcool/contracts';

/**
 * Payload handed off from the RabbitMQ consumer to the BullMQ queue.
 * Kept narrow on purpose: only what the order-confirmation template needs
 * + correlation IDs for logging.
 */
export interface OrderConfirmationJob {
  orderId: string;
  userId: string;
  userEmail: string;
  total: Money;
  confirmedAt: string;
  stripePaymentIntentId: string;
}

/**
 * Port (out): worker queue producer. Concrete adapter is BullMQ; tests
 * substitute a fake to assert the consumer hands off correctly.
 */
export interface EmailJobEnqueuer {
  enqueueOrderConfirmation(job: OrderConfirmationJob): Promise<void>;
}

export const EMAIL_JOB_ENQUEUER = Symbol('EMAIL_JOB_ENQUEUER');
