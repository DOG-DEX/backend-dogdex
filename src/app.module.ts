import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.config';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

// Infrastructure
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { ClientsModule } from './clients/clients.module';

// Shared (global providers)
import { CloudinaryModule } from './shared/cloudinary/cloudinary.module';
import { MediaProcessorModule } from './shared/media-processor/media-processor.module';
import { AIClientModule } from './shared/ai-client/ai-client.module';
import { MailModule } from './shared/mail/mail.module';
import { GeminiModule } from './shared/gemini/gemini.module';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DogsModule } from './modules/dogs/dogs.module';
import { PredictionsModule } from './modules/predictions/predictions.module';
import { CommunityModule } from './modules/community/community.module';
import { AdminModule } from './modules/admin/admin.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { PaymentModule } from './modules/payment/payment.module';
import { MediaModule } from './modules/media/media.module';

// New scale modules (skeleton)
import { CatalogModule } from './modules/catalog/catalog.module';
import { PetsModule } from './modules/pets/pets.module';
import { ModerationModule } from './modules/moderation/moderation.module';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),

    // Infrastructure
    DatabaseModule,
    CommonModule,
    ClientsModule,

    // Shared global services
    CloudinaryModule,
    MediaProcessorModule,
    AIClientModule,
    MailModule,
    GeminiModule,

    // Feature modules
    AuthModule,
    UsersModule,
    DogsModule,
    PredictionsModule,
    CommunityModule,
    AdminModule,
    AnalyticsModule,
    PaymentModule,
    MediaModule,

    // Scale modules
    CatalogModule,
    PetsModule,
    ModerationModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
