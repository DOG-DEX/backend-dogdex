import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailerClient {
  private readonly logger = new Logger(MailerClient.name);
  
  constructor(private configService: ConfigService) {}

  async sendEmail(to: string, subject: string, content: string): Promise<void> {
    this.logger.log(`Mock sending email to ${to} - Subject: ${subject}`);
    // TODO: Migrate Brevo API / Nodemailer logic from legacy email.service.ts
  }
}
