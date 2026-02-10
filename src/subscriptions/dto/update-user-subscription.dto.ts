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

export class UpdateUserSubscriptionDto {

    @IsOptional()
    @IsString()
    start_date?: Date;

    @IsOptional()
    @IsString()
    end_date?: Date;

    @IsOptional()
    @IsString()
    pause_start_date?: Date;

    @IsOptional()
    @IsString()
    pause_end_date?: Date;

    @IsOptional()
    @IsString()
    cancellation_start_date?: Date;

    @IsOptional()
    @IsString()
    cancellation_end_date?: Date;

    @IsOptional()
    @IsEnum(ScheduleType)
    scheduleType?: ScheduleType;

    @IsOptional()
    @IsJSON()
    selectedDays?: any;

    @IsOptional()
    @IsNumber()
    totalPrice?: number;

    @IsOptional()
    @IsNumber()
    discount?: number;

    @IsOptional()
    @IsNumber()
    discountedPrice?: number;

    @IsOptional()
    @IsUUID()
    deliveryPartnerProfileId?: string;

    @IsOptional()
    @IsUUID()
    userAddressId?: string;

    @IsOptional()
    @IsUUID()
    planId?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @IsOptional()
    @IsString()
    cancelled_on?: Date;

    @IsOptional()
    @IsUUID()
    customerProfileId?: string;
}
