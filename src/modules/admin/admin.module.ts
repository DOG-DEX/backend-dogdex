import { Module } from '@nestjs/common';
import { BffAdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';

@Module({
  controllers: [BffAdminController],
  providers: [AdminService]
})
export class AdminModule {}
