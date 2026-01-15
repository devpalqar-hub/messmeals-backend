import { IsString, IsOptional, IsBoolean, IsEmail, IsObject } from 'class-validator';

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
    is_active?: boolean;

    // New Fields - phase 4
    @IsOptional()
    @IsBoolean()
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
    openingHours?: Record<string, string>;

    @IsOptional()
    @IsString()
    location?: string;
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
