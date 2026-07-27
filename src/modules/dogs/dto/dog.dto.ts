import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEmail,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class LocationDto {
  @Type(() => Number)
  @IsLatitude()
  lat: number;

  @Type(() => Number)
  @IsLongitude()
  lng: number;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}

export class DogAttributesDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  pattern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  size?: string;
}

export class CreateDogDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsString()
  @Length(1, 120)
  breed: string;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  birthday?: Date;

  @IsEnum(['male', 'female'])
  gender: 'male' | 'female';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarPath?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  photos?: string[];

  @IsOptional()
  @IsBoolean()
  sterilized?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => DogAttributesDto)
  attributes?: DogAttributesDto;
}

export class UpdateDogDto extends PartialType(CreateDogDto) {}

export class SearchLostDogsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  color?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}

export class FinderContactDto {
  @IsString()
  @Length(1, 100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}

export enum ReportFoundVerificationType {
  QR = 'qr',
  CAMERA = 'camera',
}

export class ContactOwnerDto {
  @IsString()
  dogId: string;

  @IsString()
  @Length(1, 100)
  finderName: string;

  @IsString()
  @Length(5, 30)
  finderPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

export class LostAdditionalInfoDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  content?: string;
}

export class ReportLostDto {
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ValidateNested()
  @Type(() => FinderContactDto)
  contact: FinderContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LostAdditionalInfoDto)
  additionalInfo?: LostAdditionalInfoDto;
}

export class CreateHealthRecordDto {
  @IsEnum(['vaccine', 'checkup', 'medicine', 'surgery', 'hygiene', 'other'])
  type: 'vaccine' | 'checkup' | 'medicine' | 'surgery' | 'hygiene' | 'other';

  @IsString()
  @Length(1, 160)
  title: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @Type(() => Date)
  @IsOptional()
  @IsDate()
  nextDueDate?: Date;

  @IsOptional()
  @IsBoolean()
  reminderSent?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  vetName?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(0)
  weight?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  symptoms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3000)
  diagnosis?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  attachments?: string[];
}

export class UpdateHealthRecordDto extends PartialType(CreateHealthRecordDto) {}
