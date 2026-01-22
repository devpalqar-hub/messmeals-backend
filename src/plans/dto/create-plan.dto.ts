import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export class PlansDto {
    @IsString()
    planName: string

    @IsNumber()
    @Transform(({ value }) => {
        if (value === '' || value === undefined) return undefined;
        return Number(value);
    })
    price: number

    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === undefined) return undefined;
        return Number(value);
    })
    minPrice: number

    @IsString()
    description: string

    @IsString()
    messId: string

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => {
        if (!value) return undefined;

        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (!Array.isArray(parsed)) {
                    throw new Error();
                }
                return parsed;
            } catch {
                throw new BadRequestException(
                    'variationIds must be a valid JSON array of strings',
                );
            }
        }

        return value;
    })
    variationIds?: string[];

    //default false
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isMonthlyPlan: boolean

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isDailyPlan: boolean

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => PlanImagesDto)
    images?: PlanImagesDto[];

    // @IsOptional()
    // @IsArray()
    // @ValidateNested({ each: true })
    // @Type(() => VariationDto)
    // variations?: VariationDto[];
}


export class VariationDto {
    @IsOptional()
    @IsString()
    id?: string; // ✅ add this for updates

    @IsString()
    title: string

    @IsString()
    timeRange: string

    @IsString()
    @IsOptional()
    description: string


    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VariationImagesDto)
    images?: VariationImagesDto[];

}


export class PlanImagesDto {
    @IsString()
    url: string;

    @IsOptional()
    @IsString()
    altText?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;
}


export class VariationImagesDto {
    @IsString()
    url: string;

    @IsOptional()
    @IsString()
    altText?: string;

    @IsOptional()
    @IsNumber()
    sortOrder?: number;
}
