import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Matches } from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ example: 'starter' })
  @IsString()
  @Matches(/^[a-z0-9-]{1,50}$/)
  planSlug: string;

  @ApiProperty({ enum: ['monthly', 'yearly'] })
  @IsIn(['monthly', 'yearly'])
  billingPeriod: 'monthly' | 'yearly';
}
