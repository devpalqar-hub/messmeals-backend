import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';

export class PlansDto {
    @ApiProperty({ example: 'Weekly Lunch Plan' })
    @IsString()
    planName!: string

    @ApiProperty({ example: 999 })
    @IsNumber()
    @Transform(({ value }) => {
        if (value === '' || value === undefined) return undefined;
        return Number(value);
    })
    price!: number

    @ApiPropertyOptional({ example: 799 })
    @IsNumber()
    @IsOptional()
    @Transform(({ value }) => {
        if (value === '' || value === undefined) return undefined;
        return Number(value);
    })
    minPrice?: number

    @ApiProperty({ example: 'Balanced weekday meal plan' })
    @IsString()
    description!: string

    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsString()
    messId!: string

    @ApiPropertyOptional({ example: ['1f2e3d4c-1111-2222-3333-444455556666'] })
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

    @ApiPropertyOptional({
        example: [
            'https://cdn.example.com/plans/plan-1.jpg',
            'https://cdn.example.com/plans/plan-2.jpg',
        ],
        description: 'Gallery image links (S3/public URLs)'
    })
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
                    'planImages must be a valid JSON array of strings',
                );
            }
        }

        return value;
    })
    planImages?: string[];

    //default false
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isMonthlyPlan?: boolean

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isDailyPlan?: boolean

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
    @ApiPropertyOptional({ example: '1f2e3d4c-1111-2222-3333-444455556666' })
    @IsOptional()
    @IsString()
    id?: string; // ✅ add this for updates

    @ApiProperty({ example: 'Regular' })
    @IsString()
    title!: string

    @ApiProperty({ example: '09:00-12:00' })
    @IsString()
    timeRange!: string

    @ApiPropertyOptional({ example: 'Breakfast slot' })
    @IsString()
    @IsOptional()
    description?: string


    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => VariationImagesDto)
    images?: VariationImagesDto[];

}


export class PlanImagesDto {
    @ApiProperty({ example: 'https://cdn.example.com/plans/plan-1.jpg' })
    @IsString()
    url!: string;

    @ApiPropertyOptional({ example: 'Plan image' })
    @IsOptional()
    @IsString()
    altText?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumber()
    sortOrder?: number;
}


export class VariationImagesDto {
    @ApiProperty({ example: 'https://cdn.example.com/variations/variation-1.jpg' })
    @IsString()
    url!: string;

    @ApiPropertyOptional({ example: 'Variation image' })
    @IsOptional()
    @IsString()
    altText?: string;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsNumber()
    sortOrder?: number;
}
