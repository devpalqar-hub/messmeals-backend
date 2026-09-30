import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEnum,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';
import { DayOfWeek, ScheduleType } from '@prisma/client';

class PlanImagesDto {
    @IsString()
    url: string;

    @IsOptional()
    @IsString()
    altText?: string;
}

export class UpdatePlanDto {
    @IsOptional()
    @IsString()
    planName?: string;

    @IsOptional()
    @IsNumber()
    price?: number;

    @IsOptional()
    @IsNumber()
    minPrice?: number;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    messId?: string;

    @IsOptional()
    @IsBoolean()
    lunch?: boolean;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variationIds?: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    planImages?: string[];

    // Optional — replaces the full set of menus linked to this plan (must belong to the same mess).
    // Pass [] to unlink all.
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    menuIds?: string[];


    //default false
    @IsOptional()
    @IsBoolean()
    isActive: boolean

    //default false
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isMonthlyPlan: boolean

    //default false
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isDailyPlan: boolean

    // The plan's own weekly schedule — see PlansDto.scheduleType for the full description.
    @IsOptional()
    @IsEnum(ScheduleType)
    scheduleType?: ScheduleType;

    // Required when scheduleType is CUSTOM — the weekdays this plan runs on.
    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true })
    availableDays?: string[];

}
