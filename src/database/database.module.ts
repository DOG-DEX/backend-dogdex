import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Connection } from 'mongoose';
import { EnvConfig } from '../config/env.config';
import { logger } from '../common/utils/logger.util';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<EnvConfig, true>) => {
        const uri = configService.get<string>('MONGO_URI');
        if (!uri) {
          logger.error('[DatabaseConfig] MONGO_URI is missing or undefined in environment variables!');
        } else {
          // Mask password for safe console output
          const maskedUri = uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@');
          logger.info(`[DatabaseConfig] Initializing MongoDB connection to: ${maskedUri}`);
        }

        return {
          uri,
          connectionFactory: (connection: Connection) => {
            connection.on('connected', () => {
              logger.info(
                `[DatabaseConfig] MongoDB connected successfully to database: '${connection.name}' on host '${connection.host}'`,
              );
            });

            connection.on('error', (err: any) => {
              logger.error(`[DatabaseConfig] MongoDB connection failure: ${err.message}`, {
                name: err.name,
                code: err.code,
                stack: err.stack,
              });
            });

            connection.on('disconnected', () => {
              logger.warn('[DatabaseConfig] MongoDB connection disconnected!');
            });

            connection.on('reconnected', () => {
              logger.info('[DatabaseConfig] MongoDB connection re-established.');
            });

            return connection;
          },
        };
      },
    }),
  ],
})
export class DatabaseModule { }
