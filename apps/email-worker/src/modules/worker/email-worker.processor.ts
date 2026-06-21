import type { OrderConfirmationJob } from '../queue/email-job-enqueuer.port.js';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface OrderConfirmationRenderer {
  renderOrderConfirmation(job: OrderConfirmationJob): Promise<RenderedEmail>;
}

export interface SmtpSender {
  send(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId: string }>;
}

export interface ProcessorDeps {
  renderer: OrderConfirmationRenderer;
  smtp: SmtpSender;
}

/**
 * Pure processor function: render → send. Kept side-effect-isolated so
 * BullMQ Worker code stays tiny and the business logic is unit-testable
 * without a Redis dependency.
 */
export async function processOrderConfirmationJob(
  job: OrderConfirmationJob,
  deps: ProcessorDeps,
): Promise<void> {
  const rendered = await deps.renderer.renderOrderConfirmation(job);
  await deps.smtp.send({
    to: job.userEmail,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
  });
}
