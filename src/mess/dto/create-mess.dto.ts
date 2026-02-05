import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsEmail, IsObject, IsArray, IsUUID, IsEnum, ArrayNotEmpty } from 'class-validator';
import { FoodType, Tags } from '@prisma/client';

export class CreateMessDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    is_active?: boolean;

    @IsOptional()
    @IsBoolean()
    @Transform(({ value }) => value === 'true' || value === true)
    isPremium?: boolean;

    // New Fields - phase 4
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

    @IsOptional()
    @IsString()
    location?: string;

    // ✅ NEW: Admin assignment
    @IsOptional()
    @IsArray()
    @IsUUID('all', { each: true })
    messAdminIds?: string[];

    // ✅ NEW: Food types (optional, enum-safe)
    @IsOptional()
    @IsArray()
    @IsEnum(FoodType, { each: true })
    foodTypes?: FoodType[];

    // ✅ NEW: Tags (optional, enum-safe)
    @IsOptional()
    @IsArray()
    @IsEnum(Tags, { each: true })
    tags?: Tags[];

    // ✅ NEW: District (optional)
    @IsOptional()
    @IsUUID()
    districtId?: string;

    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    features?: string[];
}


export class UpdateMessDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    address?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsBoolean()
    is_active?: boolean;


    //new field - phase 4
    @IsOptional()
    @IsBoolean()
    is_verified?: boolean;


    @IsOptional()
    @IsBoolean()
    isPremium?: boolean;

    @IsOptional()
    @IsObject()
    openingHours?: Record<string, string>;

    @IsOptional()
    @IsString()
    location?: string;

    // ✅ NEW: Food types
    @IsOptional()
    @IsArray()
    @IsEnum(FoodType, { each: true })
    foodTypes?: FoodType[];

    // ✅ NEW: Tags
    @IsOptional()
    @IsArray()
    @IsEnum(Tags, { each: true })
    tags?: Tags[];

    // ✅ NEW: District
    @IsOptional()
    @IsUUID()
    districtId?: string;


    @IsOptional()
    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    features?: string[];

}


