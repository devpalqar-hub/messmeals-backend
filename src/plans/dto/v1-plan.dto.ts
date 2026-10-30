import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { BillingPeriod, DayOfWeek, ScheduleType } from '@prisma/client';

export class SetPlanMealsDto {
  @ApiProperty({
    example: ['b0a701fa-bfba-40a2-a89e-2fcda4b7a701', 'c1a701fa-bfba-40a2-a89e-2fcda4b7a702'],
    description: 'Array of meal variation UUIDs (e.g., Breakfast, Lunch, Dinner) included in the plan',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  variationIds!: string[];
}

export class SetPlanPricingDto {
  @ApiProperty({ enum: BillingPeriod, example: BillingPeriod.MONTHLY, description: 'Billing frequency' })
  @IsEnum(BillingPeriod)
  billingPeriod!: BillingPeriod;

  @ApiProperty({ example: 3500.0, description: 'Regular full price' })
  @IsNumber()
  @IsPositive()
  regularPrice!: number;

  @ApiPropertyOptional({ example: true, default: false, description: 'Whether a promotional discount is active' })
  @IsOptional()
  @IsBoolean()
  discountEnabled?: boolean;

  @ApiPropertyOptional({ example: 2999.0, description: 'Discounted promotional price' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountedPrice?: number;

  @ApiPropertyOptional({ example: 'INR', default: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;
}

export class SetPlanAvailabilityDto {
  @ApiProperty({ enum: ScheduleType, example: ScheduleType.EVERYDAY, description: 'EVERYDAY or CUSTOM' })
  @IsEnum(ScheduleType)
  scheduleType!: ScheduleType;

  @ApiPropertyOptional({
    enum: DayOfWeek,
    isArray: true,
    example: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
    description: 'Available serving days when scheduleType is CUSTOM',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  availableDays?: DayOfWeek[];
}
