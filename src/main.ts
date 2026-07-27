import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.set('trust proxy', 1);

  // Security Middlewares
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  );

  // Serve static assets dynamically from config or local fallback directory
  const uploadsDir = configService.get<string>('UPLOADS_DIR') || join(process.cwd(), 'public');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  app.useStaticAssets(uploadsDir, {
    prefix: '/public/',
  });

  // Fallback check for legacy static assets if present
  const legacyDir = join(__dirname, '..', '..', 'DogDexx', 'backend', 'public');
  if (existsSync(legacyDir)) {
    app.useStaticAssets(legacyDir, {
      prefix: '/public/',
    });
  }

  // Swagger setup
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DogDexx API')
      .setDescription('The DogDex Core API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger-ui', app, document, {
      swaggerOptions: { tryItOutEnabled: true },
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
