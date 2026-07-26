import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  
  app.set('trust proxy', 1);
  
  // Security Middlewares
  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Serve static assets
  app.useStaticAssets(join(__dirname, '..', '..', 'DogDexx', 'backend', 'public'), {
    prefix: '/public/',
  });

  // Swagger setup
  if (configService.get('NODE_ENV') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('DogDexx API')
      .setDescription('The DogDexx BFF and Core API description')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document, {
      swaggerOptions: { tryItOutEnabled: true }
    });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}
bootstrap();
