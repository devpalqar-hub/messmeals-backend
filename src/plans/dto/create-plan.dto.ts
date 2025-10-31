import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class PlansDto {
    @IsString()
    planName: string

    @IsNumber()
    price: number

    @IsNumber()
    @IsOptional()
    minPrice: number

    @IsString()
    description: string

    @IsString()
    messId: string

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    variationIds?: string[];

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
