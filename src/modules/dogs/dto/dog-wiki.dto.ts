import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateDogBreedDto {
  @IsString()
  @Matches(SLUG_PATTERN)
  @MaxLength(120)
  slug: string;

  @IsString()
  @Length(1, 160)
  breed: string;

  @IsString()
  @Length(1, 5000)
  description: string;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  pokedexNumber?: number;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  group?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  origin?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  mediaPath?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  coat_type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  life_expectancy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  height?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  weight?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  coat_colors?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  temperament?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  favorite_foods?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  common_health_issues?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  suitable_for?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  unsuitable_for?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(160, { each: true })
  trainable_skills?: string[];

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  energy_level?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  trainability?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  shedding_level?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rarity_level?: number;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maintenance_difficulty?: number;

  @IsOptional()
  @IsBoolean()
  good_with_children?: boolean;

  @IsOptional()
  @IsBoolean()
  good_with_other_pets?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  climate_preference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  fun_fact?: string;
}

export class UpdateDogBreedDto extends PartialType(CreateDogBreedDto) {}
