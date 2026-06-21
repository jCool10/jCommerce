import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';
import type { SmtpSender } from '../worker/email-worker.processor.js';

@Injectable()
export class NodemailerSmtpSender
  implements SmtpSender, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NodemailerSmtpSender.name);
  private transporter: Transporter | null = null;
  private fromHeader = 'jCool <no-reply@jcool.local>';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const host = this.config.get<string>('SMTP_HOST') ?? 'localhost';
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '1025');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = (this.config.get<string>('SMTP_SECURE') ?? 'false') === 'true';
    const from = this.config.get<string>('SMTP_FROM') ?? 'no-reply@jcool.local';
    const fromName = this.config.get<string>('SMTP_FROM_NAME') ?? 'jCool';
    this.fromHeader = `${fromName} <${from}>`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    this.logger.log(`smtp ready: ${host}:${port} (secure=${secure})`);
  }

  onModuleDestroy(): void {
    this.transporter?.close();
  }

  async send(args: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<{ messageId: string }> {
    if (!this.transporter) throw new Error('smtp not initialised');
    const info = await this.transporter.sendMail({
      from: this.fromHeader,
      to: args.to,
      subject: args.subject,
      html: args.html,
      text: args.text,
    });
    return { messageId: info.messageId };
  }
}
