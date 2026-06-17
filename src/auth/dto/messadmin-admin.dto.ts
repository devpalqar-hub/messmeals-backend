import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateMessAdminBySuperAdminDto {
    @ApiProperty({ example: 'Mess Admin' })
    @IsString()
    name!: string;

    @ApiProperty({ example: 'messadmin@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: '+919876543214' })
    @IsString()
    phone!: string;

    @ApiProperty({ example: 'secure123' })
    @IsString()
    @MinLength(6)
    password!: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiPropertyOptional({ example: ['c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11'] })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    messIds?: string[];
}

export class UpdateMessAdminBySuperAdminDto {
    @ApiPropertyOptional({ example: 'Updated Mess Admin' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'updated@example.com' })
    @IsOptional()
    @IsEmail()
    email?: string;

    @ApiPropertyOptional({ example: '+919876543215' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'secure456' })
    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    is_active?: boolean;

    @ApiPropertyOptional({ example: ['c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11'] })
    @IsOptional()
    @IsArray()
    @IsUUID('4', { each: true })
    messIds?: string[];
}

export class MessAdminListQueryDto {
    @ApiPropertyOptional({ example: 'john' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiPropertyOptional({ example: 'true' })
    @IsOptional()
    @IsString()
    isActive?: string;

    @ApiPropertyOptional({ example: '1' })
    @IsOptional()
    @IsString()
    page?: string;

    @ApiPropertyOptional({ example: '10' })
    @IsOptional()
    @IsString()
    limit?: string;
}
