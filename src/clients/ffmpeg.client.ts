import { Injectable, Logger } from '@nestjs/common';
import * as ffmpeg from 'fluent-ffmpeg';

@Injectable()
export class FfmpegClient {
  private readonly logger = new Logger(FfmpegClient.name);

  // TODO: Add video frame extraction logic from media.service.ts
}
