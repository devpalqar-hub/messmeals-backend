import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsBoolean, IsEmail, IsObject, IsArray, IsUUID } from 'class-validator';

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
     * }
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
    @IsObject()
    openingHours?: Record<string, string>;

    @IsOptional()
    @IsString()
    location?: string;
}


