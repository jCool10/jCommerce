import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import Handlebars, { type TemplateDelegate } from 'handlebars';
import mjml2html from 'mjml';
import type { OrderConfirmationJob } from '../queue/email-job-enqueuer.port.js';
import type {
  OrderConfirmationRenderer,
  RenderedEmail,
} from '../worker/email-worker.processor.js';
import { formatMoney } from './format-money.js';

// nestjs tsconfig targets CommonJS — __dirname is the source dir in dev
// (ts-node) and the compiled dist dir in prod. nest-cli copies the .mjml
// asset alongside the JS via the `assets` directive in nest-cli.json.
declare const __dirname: string;
const HERE = __dirname;

/**
 * Pre-compiles the MJML → HTML pipeline once at boot, then renders each
 * job by binding Handlebars vars. Avoids per-job MJML cost (it's the
 * slowest step). Plain-text fallback is generated from the same vars
 * (no HTML stripping — keeps it readable in plain MUAs).
 */
@Injectable()
export class OrderConfirmationRendererService
  implements OrderConfirmationRenderer, OnModuleInit
{
  private readonly logger = new Logger(OrderConfirmationRendererService.name);
  private htmlTemplate: TemplateDelegate<Record<string, string>> | null = null;
  private textTemplate: TemplateDelegate<Record<string, string>> | null = null;

  async onModuleInit(): Promise<void> {
    const mjmlSource = await this.loadMjml();
    // @types/mjml@4.x declares the return as a Promise even though the
    // runtime is sync — `await` covers both safely.
    const compiled = await mjml2html(mjmlSource, { validationLevel: 'soft' });
    if (compiled.errors.length > 0) {
      this.logger.warn(
        `mjml compile warnings: ${compiled.errors.map((e: { message: string }) => e.message).join('; ')}`,
      );
    }
    this.htmlTemplate = Handlebars.compile<Record<string, string>>(compiled.html);
    this.textTemplate = Handlebars.compile<Record<string, string>>(PLAIN_TEXT_TEMPLATE);
  }

  async renderOrderConfirmation(job: OrderConfirmationJob): Promise<RenderedEmail> {
    if (!this.htmlTemplate || !this.textTemplate) {
      await this.onModuleInit();
    }
    const vars = {
      orderId: job.orderId,
      shortOrderId: job.orderId.split('-')[0] ?? job.orderId.slice(0, 8),
      stripePaymentIntentId: job.stripePaymentIntentId,
      confirmedAt: job.confirmedAt,
      totalFormatted: formatMoney(job.total),
    };
    const html = this.htmlTemplate!(vars);
    const text = this.textTemplate!(vars);
    return {
      subject: `Order confirmed — #${vars.shortOrderId} (${vars.totalFormatted})`,
      html,
      text,
    };
  }

  private async loadMjml(): Promise<string> {
    // Resolve template alongside the compiled JS (nest-cli copies .mjml via the
    // `assets` directive in nest-cli.json). In dev/test, `import.meta.url`
    // points at `src/` so the same relative path works.
    const path = join(HERE, 'order-confirmation.mjml');
    return readFile(path, 'utf8');
  }
}

const PLAIN_TEXT_TEMPLATE = [
  'Order confirmed',
  '',
  'Thanks for your order. We have received your payment and are getting it ready.',
  '',
  'Order ID: {{orderId}}',
  'Confirmed: {{confirmedAt}}',
  'Payment: {{stripePaymentIntentId}}',
  'Total: {{totalFormatted}}',
  '',
  'This is a transactional email from jCool. Reply to support@jcool.local for help.',
].join('\n');
