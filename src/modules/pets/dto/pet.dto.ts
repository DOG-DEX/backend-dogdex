import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  Length,
  MaxLength,
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

export class PetAttributesDto {
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

export class CreatePetDto {
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
  @Type(() => PetAttributesDto)
  attributes?: PetAttributesDto;
}

export class UpdatePetDto extends PartialType(CreatePetDto) {}

export class SearchLostPetsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  breed?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;
}

export class ContactOwnerDto {
  @IsString()
  petId: string;

  @IsString()
  @Length(1, 100)
  finderName: string;

  @IsString()
  @Length(5, 30)
  finderPhone: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}

export class HealthRecordDto {
  @IsString()
  @Length(1, 150)
  title: string;

  @Type(() => Date)
  @IsDate()
  date: Date;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  vetClinic?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  attachments?: string[];
}
