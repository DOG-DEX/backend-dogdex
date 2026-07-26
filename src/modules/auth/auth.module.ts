import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './services/auth.service';
import { TokenService } from './services/token.service';
import { AuthController } from './controllers/auth.controller';
import { UsersModule } from '../users/users.module';
import { RefreshTokenModel } from './schemas/refreshToken.model';
import { OtpModel } from './schemas/otp.model';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UsersModule,
    MongooseModule.forFeature([
      { name: 'RefreshToken', schema: RefreshTokenModel.schema },
      { name: 'Otp', schema: OtpModel.schema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET') || 'defaultSecret',
        signOptions: { 
          expiresIn: (config.get<string>('JWT_ACCESS_EXPIRATION') || '15m') as any 
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, TokenService, JwtStrategy],
  exports: [AuthService, TokenService, JwtModule],
})
export class AuthModule {}
