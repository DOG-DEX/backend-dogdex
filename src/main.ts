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
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.set('trust proxy', configService.get<boolean>('TRUST_PROXY', false));

  // Security Middlewares
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  const configuredOrigins = configService
    .get<string>('CORS_ORIGINS', '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    // TEMPORARY FOR LOCAL DEVELOPMENT: accept any origin while NODE_ENV is not
    // production. Before exposing a public environment, remove this branch and
    // set CORS_ORIGINS=https://app.dogdex.example,https://www.dogdex.example.
    origin: isProduction ? configuredOrigins : true,
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
  const uploadsDir =
    configService.get<string>('UPLOADS_DIR') || join(process.cwd(), 'public');
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
  if (!isProduction) {
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
