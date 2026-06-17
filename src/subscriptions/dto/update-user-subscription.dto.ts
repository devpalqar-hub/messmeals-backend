import {
    IsOptional,
    IsUUID,
    IsString,
    IsEnum,
    IsNumber,
    IsBoolean,
    IsJSON,
} from 'class-validator';
import { ScheduleType } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserSubscriptionDto {

    @ApiPropertyOptional({ example: '2026-05-07' })
    @IsOptional()
    @IsString()
    start_date?: Date;

    @ApiPropertyOptional({ example: '2026-06-07' })
    @IsOptional()
    @IsString()
    end_date?: Date;

    @ApiPropertyOptional({ example: '2026-05-20' })
    @IsOptional()
    @IsString()
    pause_start_date?: Date;

    @ApiPropertyOptional({ example: '2026-05-25' })
    @IsOptional()
    @IsString()
    pause_end_date?: Date;

    @ApiPropertyOptional({ example: '2026-06-01' })
    @IsOptional()
    @IsString()
    cancellation_start_date?: Date;

    @ApiPropertyOptional({ example: '2026-06-03' })
    @IsOptional()
    @IsString()
    cancellation_end_date?: Date;

    @ApiPropertyOptional({ example: 'WEEKLY' })
    @IsOptional()
    @IsEnum(ScheduleType)
    scheduleType?: ScheduleType;

    @ApiPropertyOptional({ example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'] })
    @IsOptional()
    @IsJSON()
    selectedDays?: any;

    @ApiPropertyOptional({ example: 1200 })
    @IsOptional()
    @IsNumber()
    totalPrice?: number;

    @ApiPropertyOptional({ example: 100 })
    @IsOptional()
    @IsNumber()
    discount?: number;

    @ApiPropertyOptional({ example: 1100 })
    @IsOptional()
    @IsNumber()
    discountedPrice?: number;

    @ApiPropertyOptional({ example: 'b3f4fb3e-0e61-43c3-8b3b-b833f18b2f55' })
    @IsOptional()
    @IsUUID()
    deliveryPartnerProfileId?: string;

    @ApiPropertyOptional({ example: 'a1c2e3f4-1111-2222-3333-444455556666' })
    @IsOptional()
    @IsUUID()
    userAddressId?: string;

    @ApiPropertyOptional({ example: '7a6f2f43-9f6b-4c50-8d49-3f0f7f2ed111' })
    @IsOptional()
    @IsUUID()
    planId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiPropertyOptional({ example: '2026-05-07' })
    @IsOptional()
    @IsString()
    cancelled_on?: Date;

    @ApiPropertyOptional({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsOptional()
    @IsUUID()
    customerProfileId?: string;
}
