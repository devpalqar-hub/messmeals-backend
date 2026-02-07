import { Transform, Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsNumber,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

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


}
