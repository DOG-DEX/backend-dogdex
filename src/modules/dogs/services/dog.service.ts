import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import fs from 'fs';
import { Request } from 'express';

import { DogProfileDoc } from '../schemas/dog_profile.model';
import { HealthRecordDoc } from '../schemas/health_record.model';
import { UserDoc } from '../../users/schemas/user.model';
import { PlanDoc } from '../../payment/schemas/plan.model';
import { CommunityPostDoc } from '../../community/schemas/community_post.model';
import { MailService } from '../../../shared/mail/mail.service';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { redisClient } from '../../../common/utils/redis.util';

const QR_ALERT_COOLDOWN_SECONDS = 30 * 60; // 30 minutes

@Injectable()
export class DogService {
  private readonly logger = new Logger(DogService.name);

  constructor(
    @InjectModel('DogProfile') private dogProfileModel: Model<DogProfileDoc>,
    @InjectModel('HealthRecord')
    private healthRecordModel: Model<HealthRecordDoc>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('Plan') private planModel: Model<PlanDoc>,
    @InjectModel('CommunityPost')
    private communityPostModel: Model<CommunityPostDoc>,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  // tạo dog profile
  async createDog(
    data: Partial<DogProfileDoc>,
    ownerId: string,
  ): Promise<DogProfileDoc> {
    const user = await this.userModel.findById(ownerId);
    if (!user) throw new NotFoundException('User not found');

    const userPlan = await this.planModel.findOne({ slug: user.plan });
    const dogLimit = (userPlan as any)?.dogLimit || 1;

    const currentDogCount = await this.dogProfileModel.countDocuments({
      owner_id: ownerId,
      isDeleted: { $ne: true },
    });

    if (currentDogCount >= dogLimit) {
      throw new BadRequestException(
        `Gói ${userPlan?.name || 'Free'} chỉ cho phép tối đa ${dogLimit} chú chó. ` +
        `Vui lòng nâng cấp gói để thêm chó mới.`,
      );
    }

    const dog = await this.dogProfileModel.create({
      ...data,
      owner_id: ownerId,
    });
    return dog;
  }

  // lấy list profile dogs
  async getDogsByOwner(ownerId: string): Promise<DogProfileDoc[]> {
    return this.dogProfileModel
      .find({ owner_id: ownerId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 });
  }

  async getDogById(dogId: string): Promise<DogProfileDoc | null> {
    return this.dogProfileModel.findById(dogId);
  }

  async updateDog(
    dogId: string,
    ownerId: string,
    updateData: Partial<DogProfileDoc>,
  ): Promise<DogProfileDoc> {
    const dog = await this.dogProfileModel.findById(dogId);
    if (!dog) throw new NotFoundException('Dog not found');
    if (dog.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    Object.assign(dog, updateData);
    await dog.save();
    return dog;
  }

  async deleteDog(id: string, ownerId: string): Promise<void> {
    const dog = await this.dogProfileModel.findById(id);
    if (!dog) throw new NotFoundException('Dog not found');
    if (dog.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    dog.isDeleted = true;
    await dog.save();
  }

  async reportLost(
    id: string,
    ownerId: string,
    location: { lat: number; lng: number; address?: string },
    contact: { name: string; phone?: string; email?: string },
    additionalInfo: { title?: string; content?: string } = {},
  ): Promise<DogProfileDoc> {
    const dog = await this.dogProfileModel.findById(id);
    if (!dog) throw new NotFoundException('Dog not found');
    if (dog.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    dog.isLost = true;
    dog.lastSeenLocation = location as any;
    dog.lostAt = new Date();
    await dog.save();

    return dog;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PUBLIC QR COLLAR SCAN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  async getPublicDogInfo(id: string, req: Request): Promise<any> {
    const dog = await this.dogProfileModel.findById(id);
    if (!dog || dog.isDeleted)
      throw new NotFoundException('Dog profile not found');

    const owner = await this.userModel
      .findById(dog.owner_id)
      .select('username avatarPath email firstName');

    let ownerAvatar: string | null = null;
    if (owner?.avatarPath) {
      ownerAvatar = this.cloudinaryService.buildUrl(owner.avatarPath);
    }

    // ALERT: If dog is lost, send QR scan notification email to owner
    if (dog.isLost && owner?.email) {
      this.sendQrScanAlertEmail(req, dog, owner).catch((err) => {
        this.logger.error(
          `[QR_ALERT] Failed to send scan alert for dog ${id}:`,
          err,
        );
      });
    }

    const dogObj = dog.toObject();
    const avatarUrl = dogObj.avatarPath
      ? this.cloudinaryService.buildUrl(dogObj.avatarPath)
      : null;

    return {
      ...dogObj,
      avatarUrl,
      showSystemForm: dog.isLost,
      owner_id: dog.owner_id?.toString(),
      ownerName: owner ? owner.username : 'Unknown',
      ownerEmail: owner ? owner.email : null,
      ownerAvatar,
    };
  }

  private async sendQrScanAlertEmail(
    req: Request,
    dog: any,
    owner: any,
  ): Promise<void> {
    const dogId = dog._id.toString();
    const cacheKey = `qr_alert:${dogId}`;

    if (redisClient) {
      try {
        const lastAlert = await redisClient.get(cacheKey);
        if (lastAlert) {
          this.logger.log(`[QR_ALERT] Skipped (cooldown) for dog ${dogId}`);
          return;
        }
        await redisClient.setEx(
          cacheKey,
          QR_ALERT_COOLDOWN_SECONDS,
          Date.now().toString(),
        );
      } catch (e) {
        this.logger.warn(`[QR_ALERT] Redis error:`, e);
      }
    }

    const scannerIp =
      (req.headers['x-forwarded-for'] as string) ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      'Unknown';
    const ip = Array.isArray(scannerIp)
      ? scannerIp[0]
      : scannerIp.split(',')[0].trim();

    let locationInfo = 'Không xác định được vị trí';
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const geoResponse = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,lat,lon&lang=vi`,
        { signal: controller.signal },
      );
      clearTimeout(timeoutId);
      const geoData = (await geoResponse.json()) as any;
      if (geoData.status === 'success') {
        locationInfo =
          `${geoData.city || ''}, ${geoData.regionName || ''}, ${geoData.country || ''}`.replace(
            /^, |, $/g,
            '',
          );
        if (geoData.lat && geoData.lon)
          locationInfo += ` (${geoData.lat}, ${geoData.lon})`;
      }
    } catch (e) {
      this.logger.warn(`[QR_ALERT] Failed to get IP geolocation:`, e);
    }

    const scanTime = new Date().toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      dateStyle: 'full',
      timeStyle: 'medium',
    });

    await this.mailService.sendQrScanAlert({
      to: owner.email,
      ownerName: owner.firstName || owner.username,
      dogName: dog.name,
      locationInfo,
      scanTime,
      language: 'vi',
    });
  }

  async contactOwner(
    dogId: string,
    finderName: string,
    finderPhone: string,
    message?: string,
    location?: any,
  ): Promise<void> {
    const dog = await this.dogProfileModel.findById(dogId);
    if (!dog) throw new NotFoundException('Dog not found');

    const owner = await this.userModel.findById(dog.owner_id);
    if (!owner || !owner.email)
      throw new NotFoundException('Owner email not found');

    await this.mailService.sendDogFoundNotification({
      to: owner.email,
      ownerName: owner.firstName || owner.username || 'bạn',
      dogId,
      finderName,
      finderPhone,
      message,
      location,
      language: 'vi',
    });
  }

  async reportFoundWithVerification(
    req: Request,
    dogId: string,
    verificationType: 'qr' | 'camera',
    contact: { name: string; phone?: string; email?: string; message?: string },
    location: { lat: number; lng: number; address?: string },
    file?: Express.Multer.File,
  ): Promise<any> {
    if (!dogId || !contact)
      throw new BadRequestException('Missing required fields');

    const dog = await this.dogProfileModel.findById(dogId);
    if (!dog) throw new NotFoundException('Dog not found');

    if (verificationType === 'camera' && !file) {
      throw new BadRequestException(
        'Photo evidence is required for camera verification.',
      );
    }

    let evidenceUrl = '';
    if (file) {
      const uploadResult = await this.cloudinaryService.uploadFile(
        file.path,
        `verify_${dogId}_${Date.now()}`,
        'verification',
        'image',
        'private',
      );
      evidenceUrl = uploadResult.secure_url;
      if (file.path && fs.existsSync(file.path))
        fs.promises.unlink(file.path).catch(() => { });
    }

    const dogAvatar = dog.avatarPath
      ? this.cloudinaryService.buildUrl(dog.avatarPath)
      : null;

    const communityPost = new this.communityPostModel({
      author_id: (req as any).user ? (req as any).user._id : undefined,
      type: 'FOUND',
      status: 'OPEN',
      title: `[XÁC THỰC] Bé ${dog.name} đã được tìm thấy!`,
      content: `Người tìm thấy: ${contact.name || 'Ẩn danh'}.\nLời nhắn: ${contact.message || 'Không có'}.\n(Báo cáo từ quét QR)`,
      photos: evidenceUrl ? [evidenceUrl] : dogAvatar ? [dogAvatar] : [],
      dog_id: new Types.ObjectId(dogId),
      location: {
        type: 'Point',
        coordinates: [Number(location.lng), Number(location.lat)],
        address: location.address,
      },
      contact_info: contact,
      ai_metadata: {
        breed: dog.breed,
        breed_slug: dog.breed
          .toLowerCase()
          .replace(/[\s_]+/g, '-')
          .replace(/[^\w-]+/g, '')
          .trim(),
        confidence: verificationType === 'qr' ? 1.0 : 0.8,
        verificationType,
      },
    });
    await communityPost.save();

    // Notify owner
    const owner = await this.userModel.findById(dog.owner_id);
    if (owner?.email) {
      await this.mailService.sendDogFoundNotification({
        to: owner.email,
        ownerName: owner.firstName || owner.username || 'bạn',
        dogId,
        finderName: contact.name,
        finderPhone: contact.phone || '',
        finderEmail: contact.email,
        message: contact.message,
        location,
        verificationType,
        evidenceUrl,
        language: 'vi',
      });
    }

    // Thank finder & reward tokens if account exists
    if (contact.email) {
      const finderAccount = await this.userModel.findOne({
        email: contact.email.toLowerCase().trim(),
        isDeleted: false,
      });

      if (finderAccount) {
        await this.userModel.updateOne(
          { _id: finderAccount._id },
          { $inc: { remainingTokens: 10 } },
        );
      }

      this.mailService
        .sendThankFinderEmail({
          to: contact.email,
          finderName: contact.name || 'người bạn tốt bụng',
          dogName: dog.name,
          dogBreed: dog.breed,
          location: location.address,
          verificationType,
          hasAccount: !!finderAccount,
          language: 'vi',
        })
        .catch((e) =>
          this.logger.error('Failed to send thank finder email:', e),
        );
    }

    return {
      message: 'Report processed successfully',
      postId: communityPost._id,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEALTH RECORDS
  // ─────────────────────────────────────────────────────────────────────────────

  async addHealthRecord(
    dogId: string,
    ownerId: string,
    data: Partial<HealthRecordDoc>,
  ): Promise<HealthRecordDoc> {
    const dog = await this.dogProfileModel.findById(dogId);
    if (!dog) throw new NotFoundException('Dog not found');
    if (dog.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    const user = await this.userModel.findById(ownerId);
    if (!user) throw new NotFoundException('User not found');

    const userPlan = await this.planModel.findOne({ slug: user.plan });
    const recordLimit = (userPlan as any)?.healthRecordLimitPerDog || 3;

    const currentRecordCount = await this.healthRecordModel.countDocuments({
      dog_id: dogId,
    });

    if (currentRecordCount >= recordLimit) {
      throw new BadRequestException(
        `Gói ${userPlan?.name || 'Free'} chỉ cho phép tối đa ${recordLimit} bản ghi sức khỏe mỗi chó. ` +
        `Vui lòng nâng cấp gói để thêm bản ghi mới.`,
      );
    }

    const record = await this.healthRecordModel.create({
      dog_id: dogId,
      ...data,
    });
    return record;
  }

  async getHealthRecords(
    dogId: string,
    ownerId: string,
  ): Promise<HealthRecordDoc[]> {
    const dog = await this.dogProfileModel.findById(dogId);
    if (!dog) throw new NotFoundException('Dog not found');
    if (dog.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    return this.healthRecordModel.find({ dog_id: dogId }).sort({ date: -1 });
  }

  async updateHealthRecord(
    recordId: string,
    ownerId: string,
    data: Partial<HealthRecordDoc>,
  ): Promise<HealthRecordDoc> {
    const record = await this.healthRecordModel.findById(recordId);
    if (!record) throw new NotFoundException('Health record not found');

    const dog = await this.dogProfileModel.findById(record.dog_id);
    if (!dog) throw new NotFoundException('Associated dog profile not found');
    if (dog.owner_id.toString() !== ownerId)
      throw new UnauthorizedException(
        'You are not authorized to update this record',
      );

    Object.assign(record, data);
    await record.save();
    return record;
  }

  async deleteHealthRecord(recordId: string, ownerId: string): Promise<void> {
    const record = await this.healthRecordModel.findById(recordId);
    if (!record) throw new NotFoundException('Health record not found');

    const dog = await this.dogProfileModel.findById(record.dog_id);
    if (!dog) {
      await record.deleteOne();
      return;
    }

    if (dog.owner_id.toString() !== ownerId)
      throw new UnauthorizedException(
        'You are not authorized to delete this record',
      );
    await record.deleteOne();
  }

  async searchLostDogs(filters: {
    breed?: string;
    color?: string;
    lat?: number;
    lng?: number;
  }): Promise<DogProfileDoc[]> {
    const query: any = { isLost: true, isDeleted: { $ne: true } };

    if (filters.breed) query.breed = { $regex: filters.breed, $options: 'i' };
    if (filters.color)
      query['attributes.color'] = { $regex: filters.color, $options: 'i' };

    return this.dogProfileModel.find(query).sort({ updatedAt: -1 }).limit(50);
  }
}
