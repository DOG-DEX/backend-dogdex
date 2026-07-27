import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { RegisterDto } from '../dto/auth.dto';
import { MailerClient } from '../../../clients/mailer.client';
import { MailService } from '../../../shared/mail/mail.service';
import { UserService, EnrichedUser } from '../../users/services/user.service';
import { UserDoc } from '../../users/schemas/user.model';
import { RefreshTokenDoc } from '../schemas/refreshToken.model';
import { OtpDoc, OtpType } from '../schemas/otp.model';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    @InjectModel('RefreshToken')
    private refreshTokenModel: Model<RefreshTokenDoc>,
    @InjectModel('Otp') private otpModel: Model<OtpDoc>,
    private mailerClient: MailerClient,
    private mailService: MailService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  private generateJti() {
    return crypto.randomBytes(16).toString('hex');
  }

  private hashRefreshToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getRefreshTokenExpiry(token: string) {
    const payload = this.jwtService.decode(token) as { exp?: number } | null;
    if (!payload?.exp) {
      throw new UnauthorizedException(
        'Unable to determine refresh token expiration',
      );
    }
    return new Date(payload.exp * 1000);
  }

  private async generateTokens(user: EnrichedUser | UserDoc, jti: string) {
    const accessToken = await this.jwtService.signAsync(
      { id: user._id.toString(), role: user.role, plan: user.plan },
      {
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_ACCESS_EXPIRES_IN',
        ) as any,
      },
    );
    const refreshToken = await this.jwtService.signAsync(
      { id: user._id.toString(), jti },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.getOrThrow<string>(
          'JWT_REFRESH_EXPIRES_IN',
        ) as any,
      },
    );
    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    return this.userService.createUser(dto);
  }

  async login(email: string, pass: string) {
    const cleanEmail = email.trim().toLowerCase();
    const userWithPassword = await this.userService.getByEmail(
      cleanEmail,
      true,
    );

    if (!userWithPassword || !userWithPassword.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(pass, userWithPassword.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!userWithPassword.verify) {
      await this.userService.sendOtp(userWithPassword.email);
      throw new BadRequestException(
        'Account not verified. A new OTP has been sent.',
      );
    }

    const jti = this.generateJti();
    const { accessToken, refreshToken } = await this.generateTokens(
      userWithPassword,
      jti,
    );

    // Persist only a one-way hash so a database leak cannot replay active sessions.
    await new this.refreshTokenModel({
      user: userWithPassword._id,
      jti,
      tokenHash: this.hashRefreshToken(refreshToken),
      expiresAt: this.getRefreshTokenExpiry(refreshToken),
    }).save();

    delete (userWithPassword as any).password;
    return {
      user: userWithPassword,
      accessToken,
      refreshToken,
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken)
      throw new BadRequestException('Refresh token is required');
    await this.refreshTokenModel.deleteOne({
      tokenHash: this.hashRefreshToken(refreshToken),
    });
    return true;
  }

  async refreshToken(oldRefreshToken: string) {
    if (!oldRefreshToken)
      throw new BadRequestException('Refresh token is required');

    let decoded: any;
    try {
      decoded = await this.jwtService.verifyAsync(oldRefreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const storedToken = await this.refreshTokenModel
      .findOne({
        tokenHash: this.hashRefreshToken(oldRefreshToken),
        expiresAt: { $gt: new Date() },
      })
      .select('+tokenHash');
    if (!storedToken) {
      throw new UnauthorizedException(
        'Token reuse detected or invalid session',
      );
    }

    await this.refreshTokenModel.deleteOne({ _id: storedToken._id });

    const user = await this.userService.getById(decoded.id);
    if (!user) throw new UnauthorizedException('User not found');

    const newJti = this.generateJti();
    const { accessToken, refreshToken: newRefreshToken } =
      await this.generateTokens(user, newJti);

    await new this.refreshTokenModel({
      user: user._id,
      jti: newJti,
      tokenHash: this.hashRefreshToken(newRefreshToken),
      expiresAt: this.getRefreshTokenExpiry(newRefreshToken),
    }).save();

    return { accessToken, refreshToken: newRefreshToken };
  }

  async verifyEmail(email: string, otp: string) {
    const cleanEmail = email.trim().toLowerCase();
    const existingOtp = await this.otpModel
      .findOne({
        email: cleanEmail,
        type: OtpType.EMAIL_VERIFICATION,
        expiresAt: { $gt: new Date() },
      })
      .select('+otpHash');
    if (!existingOtp || !(await bcrypt.compare(otp, existingOtp.otpHash))) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.userService.getByEmail(cleanEmail);
    if (!user) throw new BadRequestException('User not found');
    await this.userService.updateUserById(user._id.toString(), {
      verify: true,
    });
    await this.otpModel.deleteMany({
      email: cleanEmail,
      type: OtpType.EMAIL_VERIFICATION,
    });

    return { message: 'Email verified successfully' };
  }

  async resendVerificationOtp(email: string) {
    return this.userService.sendOtp(email);
  }

  async forgotPassword(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.userService
      .getByEmail(cleanEmail)
      .catch(() => null);
    if (!user) return { message: 'If the account exists, an OTP will be sent' };

    const otp = crypto.randomInt(100000, 999999).toString();
    await this.otpModel.deleteMany({
      email: cleanEmail,
      type: OtpType.PASSWORD_RESET,
    });

    await new this.otpModel({
      email: cleanEmail,
      otpHash: await bcrypt.hash(otp, 12),
      type: OtpType.PASSWORD_RESET,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }).save();

    await this.mailService.sendPasswordResetOtp({
      to: email,
      otp,
      userName: user.username,
    });
    return { message: 'If the account exists, an OTP will be sent' };
  }

  async resetPassword(email: string, otp: string, pass: string) {
    const cleanEmail = email.trim().toLowerCase();
    const existingOtp = await this.otpModel
      .findOne({
        email: cleanEmail,
        type: OtpType.PASSWORD_RESET,
        expiresAt: { $gt: new Date() },
      })
      .select('+otpHash');
    if (!existingOtp || !(await bcrypt.compare(otp, existingOtp.otpHash))) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    const user = await this.userService.getByEmail(cleanEmail, true);
    if (!user) throw new ConflictException('User not found');

    const hashedPassword = await bcrypt.hash(pass, 10);
    await this.userService.updateUserById(user._id.toString(), {
      password: hashedPassword,
    } as any);

    await this.otpModel.deleteMany({
      email: cleanEmail,
      type: OtpType.PASSWORD_RESET,
    });
    await this.refreshTokenModel.deleteMany({ user: user._id });

    return { message: 'Password reset successful' };
  }
}
