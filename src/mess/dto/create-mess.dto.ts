import { BadRequestException } from '@nestjs/common';
import { Transform, Type } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsEmail, IsObject, IsArray, IsUUID, IsEnum, ArrayNotEmpty, IsInt, ValidateNested, IsNotEmpty } from 'class-validator';
import { FoodType, Tags } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export class CreateMessDto {
    @ApiProperty({ example: 'Super Meals' })
    @IsString()
    name!: string;

    @ApiPropertyOptional({ example: 'Healthy daily meals delivered fresh.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '123 Main Street, Bangalore' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ example: '+919876543210' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'mess@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    is_active?: boolean;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isPremium?: boolean;

    // New Fields - phase 4
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    is_verified?: boolean;

    /**
     * Example:
     * {
     *   "Monday": "9:30-4",
     *   "Tuesday": "9:30-4"
     */
    @ApiPropertyOptional({
        example: {
            Monday: '9:30-4',
            Tuesday: '9:30-4',
            Wednesday: '9:30-4',
        },
    })
    @IsOptional()
    @IsObject()
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (typeof parsed !== 'object' || Array.isArray(parsed)) {
                    throw new Error();
                }
                return parsed;
            } catch {
                throw new BadRequestException(
                    'openingHours must be a valid JSON object',
                );
            }
        }
        return value;
    })
    openingHours?: Record<string, string>;

    @ApiPropertyOptional({ example: 'Bangalore' })
    @IsOptional()
    @IsString()
    location?: string;

    @ApiPropertyOptional({ example: ['8f6f5a2a-6d3e-4c9d-8ed1-7c1c9e7b1234'] })
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return JSON.parse(value);
        }
        return value;
    })
    messAdminIds?: string[];



    @ApiPropertyOptional({ example: ['VEG', 'NON_VEG'] })
    @IsOptional()
    @IsArray()
    @IsEnum(FoodType, { each: true })
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return JSON.parse(value);
        }
        return value;
    })
    foodTypes?: FoodType[];


    @ApiPropertyOptional({ example: ['BREAKFAST', 'LUNCH'] })
    @IsOptional()
    @IsArray()
    @IsEnum(Tags, { each: true })
    @Transform(({ value }) => {
        if (typeof value === 'string') {
            return JSON.parse(value);
        }
        return value;
    })
    tags?: Tags[];


    // ✅ NEW: District (optional)
    @ApiPropertyOptional({ example: '5f6a1b2c-3d4e-5f60-7a8b-9c0d1e2f3a4b' })
    @IsOptional()
    @IsUUID()
    districtId?: string;

    @ApiPropertyOptional({ example: ['wifi', 'parking', 'home-delivery'] })
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    features?: string[];

    @ApiPropertyOptional({ example: '560001', description: 'Optional zipcode/pincode of the mess location' })
    @IsOptional()
    @IsString()
    zipcode?: string;
}

export class UpdateMessImageDto {
    @ApiPropertyOptional({ example: '7e6d5c4b-3a2f-1e0d-9c8b-7a6f5e4d3c2b' })
    @IsOptional()
    @IsUUID()
    id?: string; // present only for existing images

    @ApiProperty({ example: 'https://cdn.example.com/mess/gallery-1.jpg' })
    @IsString()
    url!: string;

    @ApiPropertyOptional({ example: 'Front view' })
    @IsOptional()
    @IsString()
    altText?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isCover?: boolean;

    @ApiPropertyOptional({ example: 1 })
    @IsOptional()
    @IsInt()
    sortOrder?: number;
}


export class UpdateMessDto {
    @ApiPropertyOptional({ example: 'Super Meals' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'Updated description for the mess.' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '123 Main Street, Bangalore' })
    @IsOptional()
    @IsString()
    address?: string;

    @ApiPropertyOptional({ example: '+919876543210' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'mess@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;


    //new field - phase 4
    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    is_verified?: boolean;


    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isPremium?: boolean;

    @ApiPropertyOptional({
        example: {
            Monday: '9:30-4',
            Tuesday: '9:30-4',
            Wednesday: '9:30-4',
        },
    })
    @IsOptional()
    @IsObject()
    openingHours?: Record<string, string>;

    @ApiPropertyOptional({ example: 'Bangalore' })
    @IsOptional()
    @IsString()
    location?: string;

    // ✅ NEW: Food types
    @ApiPropertyOptional({ example: ['VEG', 'NON_VEG'] })
    @IsOptional()
    @IsArray()
    @IsEnum(FoodType, { each: true })
    foodTypes?: FoodType[];

    // ✅ NEW: Tags
    @ApiPropertyOptional({ example: ['BREAKFAST', 'LUNCH'] })
    @IsOptional()
    @IsArray()
    @IsEnum(Tags, { each: true })
    tags?: Tags[];

    // ✅ NEW: District
    @ApiPropertyOptional({ example: '5f6a1b2c-3d4e-5f60-7a8b-9c0d1e2f3a4b' })
    @IsOptional()
    @IsUUID()
    districtId?: string;


    @ApiPropertyOptional({ example: ['wifi', 'parking', 'home-delivery'] })
    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    features?: string[];

    @ApiPropertyOptional({ example: '560001', description: 'Optional zipcode/pincode of the mess location' })
    @IsOptional()
    @IsString()
    zipcode?: string;

    @ApiPropertyOptional({
        example: [
            {
                id: '7e6d5c4b-3a2f-1e0d-9c8b-7a6f5e4d3c2b',
                url: 'https://cdn.example.com/mess/gallery-1.jpg',
                altText: 'Front view',
                isCover: true,
                sortOrder: 1,
            },
        ],
    })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateMessImageDto)
    images?: UpdateMessImageDto[];


}

export class CreateMessByAdminDto extends PartialType(CreateMessDto) {
    @ApiProperty({ example: 'Super Meals', description: 'Required mess name' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiProperty({ example: '560001', description: 'Required zipcode of the mess location' })
    @IsString()
    @IsNotEmpty()
    zipcode!: string;
}
