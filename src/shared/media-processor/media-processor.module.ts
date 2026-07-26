import { Global, Module } from '@nestjs/common';
import { MediaProcessorService } from './media-processor.service';

@Global()
@Module({
  providers: [MediaProcessorService],
  exports: [MediaProcessorService],
})
export class MediaProcessorModule {}
