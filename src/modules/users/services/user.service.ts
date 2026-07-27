import { Injectable, Logger, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UserDoc } from '../schemas/user.model';
import { PlanDoc } from '../../payment/schemas/plan.model';
import { OtpDoc, OtpType } from '../../auth/schemas/otp.model';
import { MediaDoc } from '../../media/schemas/medias.model';
import { DirectoryDoc } from '../../media/schemas/directory.model';
import { PredictionHistoryDoc } from '../../predictions/schemas/prediction_history.model';
import { FeedbackDoc } from '../../community/schemas/feedback.model';
import { MailService } from '../../../shared/mail/mail.service';
import { RegisterDto } from '../../auth/dto/auth.dto';

export type EnrichedUser = UserDoc & { tokenAllotment: number };

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('Plan') private planModel: Model<PlanDoc>,
    @InjectModel('Otp') private otpModel: Model<OtpDoc>,
    @InjectModel('Media') private mediaModel: Model<MediaDoc>,
    @InjectModel('Directory') private directoryModel: Model<DirectoryDoc>,
    @InjectModel('PredictionHistory') private predictionModel: Model<PredictionHistoryDoc>,
    @InjectModel('Feedback') private feedbackModel: Model<FeedbackDoc>,
    private mailService: MailService,
  ) {}

  async enrich(user: UserDoc | null): Promise<EnrichedUser | null> {
    if (!user) return null;
    const userPlan = await this.planModel.findOne({ slug: user.plan }).lean();
    const userObject = user.toObject ? user.toObject() : user;
    return {
      ...userObject,
      tokenAllotment: (userPlan as any)?.tokenAllotment || 0,
    } as EnrichedUser;
  }

  async getAll(options: { page?: number; limit?: number; search?: string } = {}) {
    const { page = 1, limit = 10, search } = options;
    const skip = (page - 1) * limit;
    const query: any = { isDeleted: false };

    if (search) {
      const searchRegex = new RegExp(search, "i");
      query.$or = [{ username: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      this.userModel.find(query).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      this.userModel.countDocuments(query),
    ]);

    const enrichedUsers = await Promise.all(users.map(u => this.enrich(u)));

    return {
      data: enrichedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string): Promise<EnrichedUser> {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false }).select('-password');
    const enriched = await this.enrich(user);
    if (!enriched) throw new NotFoundException('User not found');
    return enriched;
  }

  async getByEmail(email: string, selectPassword = false): Promise<EnrichedUser & { password?: string }> {
    const query = this.userModel.findOne({ email, isDeleted: false });
    const user = await (selectPassword ? query.select('+password') : query);
    const rawPassword = user?.password;
    const enriched = await this.enrich(user);
    if (!enriched) throw new NotFoundException('User not found');
    if (selectPassword && rawPassword) {
      enriched.password = rawPassword;
    }
    return enriched as EnrichedUser & { password?: string };
  }

  async createUser(data: RegisterDto): Promise<EnrichedUser> {
    this.logger.log('Creating new user');
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanUsername = data.username.trim().toLowerCase();

    const existingEmail = await this.userModel.findOne({ email: cleanEmail });
    if (existingEmail) {
      if (existingEmail.verify) {
        throw new ConflictException('Email already registered');
      }
      throw new BadRequestException('Email registered but not verified. Please verify your email or request a new OTP.');
    }

    const existingUsername = await this.userModel.findOne({ username: cleanUsername });
    if (existingUsername) throw new BadRequestException('Username taken');

    const freePlan = await this.planModel.findOne({ slug: 'free' }).lean();
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = new this.userModel({
      ...data,
      email: cleanEmail,
      username: cleanUsername,
      password: hashedPassword,
      plan: 'free',
      remainingTokens: (freePlan as any)?.tokenAllotment || 10,
    });

    await user.save();

    const directory = new this.directoryModel({ name: user.username, creator_id: user._id });
    await directory.save();
    user.directory_id = directory._id as any;
    await user.save();

    try {
      await this.sendOtp(user.email);
    } catch (e) {
      this.logger.error('Failed to send OTP', e);
    }

    const enriched = await this.enrich(user);
    delete (enriched as any).password;
    return enriched!;
  }

  async sendOtp(email: string) {
    const cleanEmail = email.trim().toLowerCase();
    const user = await this.userModel.findOne({ email: cleanEmail });
    if (!user) throw new NotFoundException('User not found');
    if (user.verify) throw new BadRequestException('Account is already verified');

    const lastOtp = await this.otpModel.findOne({
      email: cleanEmail,
      type: OtpType.EMAIL_VERIFICATION,
    }).sort({ createdAt: -1 });

    if (lastOtp && (lastOtp as any).createdAt) {
      const timePassedSec = Math.floor((Date.now() - new Date((lastOtp as any).createdAt).getTime()) / 1000);
      const cooldownSec = 60;
      if (timePassedSec < cooldownSec) {
        throw new BadRequestException(`Please wait ${cooldownSec - timePassedSec} seconds before requesting a new OTP.`);
      }
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    await this.otpModel.deleteMany({ email: cleanEmail, type: OtpType.EMAIL_VERIFICATION });

    await new this.otpModel({
      email: cleanEmail,
      otp: otpCode,
      type: OtpType.EMAIL_VERIFICATION,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    }).save();

    await this.mailService.sendVerificationOtp({ to: cleanEmail, otp: otpCode, userName: user.username });
    return { message: 'OTP sent successfully' };
  }

  async deleteUser(id: string) {
    const user = await this.userModel.findOne({ _id: id, isDeleted: false });
    if (!user) throw new ConflictException('User not found');

    await this.userModel.updateOne({ _id: id }, { $set: { isDeleted: true } });

    await Promise.all([
      this.mediaModel.updateMany({ creator_id: user._id }, { $set: { isDeleted: true } }),
      this.directoryModel.updateMany({ creator_id: user._id }, { $set: { isDeleted: true } }),
      this.predictionModel.updateMany({ user: user._id }, { $set: { isDeleted: true } }),
      this.feedbackModel.updateMany({ user_id: user._id }, { $set: { isDeleted: true } }),
    ]);

    if (user.email) {
      await this.otpModel.deleteMany({ email: user.email });
    }
    return true;
  }

  async updateUserById(userId: string, updateData: any): Promise<EnrichedUser> {
    const user = await this.userModel.findById(userId);
    if (!user || user.isDeleted) throw new NotFoundException('User not found');
    
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 10);
    }
    
    const updated = await this.userModel.findByIdAndUpdate(userId, updateData, { new: true }).select('-password');
    const enriched = await this.enrich(updated);
    if (!enriched) throw new NotFoundException('User not found');
    return enriched;
  }
}
