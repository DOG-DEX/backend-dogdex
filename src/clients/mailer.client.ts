import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../shared/mail/mail.service';

@Injectable()
export class MailerClient {
  private readonly logger = new Logger(MailerClient.name);

  constructor(private mailService: MailService) {}

  async sendEmail(to: string, subject: string, content: string): Promise<void> {
    return this.mailService.sendEmail(to, subject, content);
  }
}
