import {
    IsOptional,
    IsUUID,
    IsDateString,
    IsEnum,
    IsNumber,
    IsBoolean,
    IsJSON,
} from 'class-validator';
import { ScheduleType } from '@prisma/client';

export class UpdateUserSubscriptionDto {

    @IsOptional()
    @IsDateString()
    start_date?: Date;

    @IsOptional()
    @IsDateString()
    end_date?: Date;

    @IsOptional()
    @IsDateString()
    pause_start_date?: Date;

    @IsOptional()
    @IsDateString()
    pause_end_date?: Date;

    @IsOptional()
    @IsDateString()
    cancellation_start_date?: Date;

    @IsOptional()
    @IsDateString()
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
    @IsDateString()
    cancelled_on?: Date;

    @IsOptional()
    @IsUUID()
    customerProfileId?: string;
}
