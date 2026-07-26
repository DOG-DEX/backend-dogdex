import { Global, Module } from '@nestjs/common';
import { AIClientService } from './ai-client.service';

@Global()
@Module({
  providers: [AIClientService],
  exports: [AIClientService],
})
export class AIClientModule {}
