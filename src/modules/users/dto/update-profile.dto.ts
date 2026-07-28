import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, Matches } from 'class-validator';

/**
 * Fields a signed-in member may change about their own profile.
 * Privileged fields such as role, plan, verification state and token balance are deliberately absent.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 30, example: 'trainer_dex' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[a-z0-9_]+$/, {
    message: 'Username can only contain lowercase letters, numbers, and underscores',
  })
  username?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  country?: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ example: '+84901234567' })
  @IsOptional()
  @IsString()
  @Matches(/^[+0-9()\-\s]{6,30}$/, { message: 'phoneNumber is invalid' })
  phoneNumber?: string;

  @ApiPropertyOptional({ maxLength: 10000000 })
  @IsOptional()
  @IsString()
  @MaxLength(10000000)
  avatarPath?: string;

  @ApiPropertyOptional({ maxLength: 300 })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  address?: string;
}
