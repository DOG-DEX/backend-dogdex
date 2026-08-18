import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';

import { PetDoc } from '../schemas/pet.schema';
import { HealthRecordDoc } from '../schemas/health_record.schema';
import { UserDoc } from '../../users/schemas/user.model';
import { PlanDoc } from '../../payment/schemas/plan.model';
import { CommunityPostDoc } from '../../community/schemas/community_post.model';
import { MailService } from '../../../shared/mail/mail.service';
import { CloudinaryService } from '../../../shared/cloudinary/cloudinary.service';
import { redisClient } from '../../../common/utils/redis.util';

const QR_ALERT_COOLDOWN_SECONDS = 30 * 60; // 30 minutes

@Injectable()
export class PetService {
  private readonly logger = new Logger(PetService.name);

  constructor(
    @InjectModel('Pet') private petModel: Model<PetDoc>,
    @InjectModel('HealthRecord')
    private healthRecordModel: Model<HealthRecordDoc>,
    @InjectModel('User') private userModel: Model<UserDoc>,
    @InjectModel('Plan') private planModel: Model<PlanDoc>,
    @InjectModel('CommunityPost')
    private communityPostModel: Model<CommunityPostDoc>,
    private readonly mailService: MailService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // Tạo hồ sơ thú cưng mới
  async createPet(
    data: Partial<PetDoc>,
    ownerId: string,
  ): Promise<PetDoc> {
    const user = await this.userModel.findById(ownerId);
    if (!user) throw new NotFoundException('User not found');

    const userPlan = await this.planModel.findOne({ slug: user.plan || 'free' });
    const petLimit = (userPlan as any)?.dogLimit || (userPlan as any)?.petLimit || 5;

    const currentPetCount = await this.petModel.countDocuments({
      owner_id: ownerId,
      isDeleted: { $ne: true },
    });

    if (currentPetCount >= petLimit) {
      throw new BadRequestException(
        `Gói ${userPlan?.name || 'Free'} đã đạt giới hạn tối đa (${petLimit} thú cưng). Vui lòng nâng cấp gói để thêm cún mới.`,
      );
    }

    const pet = await this.petModel.create({
      ...data,
      owner_id: ownerId,
      isLost: false,
      isDeleted: false,
    });
    return pet;
  }

  // Lấy danh sách thú cưng của user
  async getPetsByOwner(ownerId: string): Promise<PetDoc[]> {
    return this.petModel
      .find({ owner_id: ownerId, isDeleted: { $ne: true } })
      .sort({ createdAt: -1 });
  }

  async getPetById(petId: string): Promise<PetDoc | null> {
    const pet = await this.petModel.findOne({ _id: petId, isDeleted: { $ne: true } });
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');
    return pet;
  }

  async updatePet(
    petId: string,
    ownerId: string,
    updateData: Partial<PetDoc>,
  ): Promise<PetDoc> {
    const pet = await this.petModel.findById(petId);
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');
    if (pet.owner_id.toString() !== ownerId) throw new UnauthorizedException('Không có quyền chỉnh sửa.');

    Object.assign(pet, updateData);
    await pet.save();
    return pet;
  }

  async deletePet(id: string, ownerId: string): Promise<void> {
    const pet = await this.petModel.findById(id);
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');
    if (pet.owner_id.toString() !== ownerId) throw new UnauthorizedException('Không có quyền xóa.');

    pet.isDeleted = true;
    await pet.save();
  }

  async reportLost(
    id: string,
    ownerId: string,
    locationData?: { lat?: number; lng?: number; address?: string },
  ): Promise<PetDoc> {
    const pet = await this.petModel.findById(id);
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');
    if (pet.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    pet.isLost = true;
    pet.lostAt = new Date();
    if (locationData && locationData.lat && locationData.lng) {
      pet.lastSeenLocation = {
        lat: locationData.lat,
        lng: locationData.lng,
        address: locationData.address || '',
      };
    }
    await pet.save();
    return pet;
  }

  async searchLostPets(filters?: { breed?: string; city?: string }): Promise<PetDoc[]> {
    const query: any = { isLost: true, isDeleted: { $ne: true } };
    if (filters?.breed) {
      query.breed = { $regex: new RegExp(filters.breed, 'i') };
    }
    return this.petModel.find(query).sort({ lostAt: -1, updatedAt: -1 });
  }

  async getPublicPetInfo(id: string, req?: Request): Promise<any> {
    const pet = await this.petModel.findOne({ _id: id, isDeleted: { $ne: true } });
    if (!pet) throw new NotFoundException('Hồ sơ thú cưng không tồn tại.');

    const owner = await this.userModel.findById(pet.owner_id).select('username email phoneNumber firstName lastName');

    // Trigger QR Scan Alert if pet is marked as lost
    if (pet.isLost && owner?.email) {
      this.sendQrScannedNotification(pet, owner, req).catch((err) => {
        this.logger.warn(`Failed to send QR alert email: ${err.message}`);
      });
    }

    return {
      id: pet._id,
      name: pet.name,
      breed: pet.breed,
      gender: pet.gender,
      birthday: pet.birthday,
      avatarPath: pet.avatarPath,
      photos: pet.photos,
      isLost: pet.isLost,
      lastSeenLocation: pet.lastSeenLocation,
      attributes: pet.attributes,
      owner: owner
        ? {
            username: owner.username,
            phone: owner.phoneNumber,
            email: owner.email,
            name: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.username,
          }
        : null,
    };
  }

  private async sendQrScannedNotification(pet: PetDoc, owner: any, req?: Request) {
    const cacheKey = `qr_alert:${pet._id}`;
    if (redisClient) {
      try {
        const lastAlert = await redisClient.get(cacheKey);
        if (lastAlert) return; // Cooldown active
        await redisClient.setEx(cacheKey, QR_ALERT_COOLDOWN_SECONDS, '1');
      } catch (e) {
        this.logger.warn('[QR_ALERT] Redis error:', e);
      }
    }

    await this.mailService.sendQrScanAlert({
      to: owner.email,
      ownerName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.username,
      dogName: pet.name,
      locationInfo: 'Gần vị trí của bạn, Việt Nam',
      scanTime: new Date().toLocaleString('vi-VN'),
    });
  }

  async contactOwner(
    petId: string,
    finderName: string,
    finderPhone: string,
    message?: string,
    location?: { lat?: number; lng?: number; address?: string },
  ): Promise<void> {
    const pet = await this.petModel.findById(petId);
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');

    const owner = await this.userModel.findById(pet.owner_id);
    if (!owner || !owner.email) throw new NotFoundException('Không tìm thấy thông tin chủ thú cưng.');

    await this.mailService.sendDogFoundNotification({
      to: owner.email,
      ownerName: `${owner.firstName || ''} ${owner.lastName || ''}`.trim() || owner.username,
      dogId: pet._id.toString(),
      finderName,
      finderPhone,
      message: message || 'Tôi vừa quét được thẻ vòng cổ của bé cún.',
      location: location && location.lat && location.lng
        ? {
            lat: location.lat,
            lng: location.lng,
            address: location.address,
          }
        : undefined,
    });
  }

  async reportFound(petId: string, locationInfo?: string, contactPhone?: string): Promise<boolean> {
    const pet = await this.petModel.findById(petId);
    if (!pet) return false;
    pet.isLost = false;
    await pet.save();
    return true;
  }

  // Health Records
  async addHealthRecord(petId: string, ownerId: string, data: any): Promise<HealthRecordDoc> {
    const pet = await this.petModel.findById(petId);
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');
    if (pet.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    return this.healthRecordModel.create({
      ...data,
      dog_id: petId,
    });
  }

  async getHealthRecords(petId: string, ownerId: string): Promise<HealthRecordDoc[]> {
    const pet = await this.petModel.findById(petId);
    if (!pet) throw new NotFoundException('Thú cưng không tồn tại.');
    if (pet.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    return this.healthRecordModel.find({ dog_id: petId }).sort({ date: -1 });
  }

  async updateHealthRecord(recordId: string, ownerId: string, data: any): Promise<HealthRecordDoc> {
    const record = await this.healthRecordModel.findById(recordId);
    if (!record) throw new NotFoundException('Bản ghi y tế không tồn tại.');

    const pet = await this.petModel.findById(record.dog_id);
    if (!pet || pet.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    Object.assign(record, data);
    await record.save();
    return record;
  }

  async deleteHealthRecord(recordId: string, ownerId: string): Promise<void> {
    const record = await this.healthRecordModel.findById(recordId);
    if (!record) throw new NotFoundException('Bản ghi y tế không tồn tại.');

    const pet = await this.petModel.findById(record.dog_id);
    if (!pet || pet.owner_id.toString() !== ownerId) throw new UnauthorizedException();

    await this.healthRecordModel.deleteOne({ _id: recordId });
  }
}
