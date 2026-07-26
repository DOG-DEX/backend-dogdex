import { Module, Global } from '@nestjs/common';
import { GeminiClient } from './gemini.client';
import { MailerClient } from './mailer.client';
import { CloudinaryClient } from './cloudinary.client';
import { MomoClient } from './momo.client';
import { FfmpegClient } from './ffmpeg.client';

@Global()
@Module({
  providers: [
    GeminiClient,
    MailerClient,
    CloudinaryClient,
    MomoClient,
    FfmpegClient,
  ],
  exports: [
    GeminiClient,
    MailerClient,
    CloudinaryClient,
    MomoClient,
    FfmpegClient,
  ],
})
export class ClientsModule {}
