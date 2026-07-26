import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MomoClient {
  private readonly logger = new Logger(MomoClient.name);

  constructor(private configService: ConfigService) {}

  // TODO: Migrate Momo create payment logic
}
