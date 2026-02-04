import { IsEnum, IsOptional, IsString, IsBooleanString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Role } from '@prisma/client';

export class GetUsersQueryDto {
    @IsOptional()
    @IsString()
    search?: string; // name | phone | email

    @IsOptional()
    @IsBooleanString()
    is_active?: string; // "true" | "false"

    @IsOptional()
    @IsEnum(Role)
    role?: Role;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    limit?: number = 10;
}
