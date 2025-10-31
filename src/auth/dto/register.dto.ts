import { IsEmail, IsEnum, IsString, MinLength, IsOptional } from 'class-validator';
import { Roles } from '@prisma/client';

export class RegisterDto {
    @IsString()
    name: string;

    @IsString()
    @MinLength(10)
    phone: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsOptional()
    @IsEnum(Roles)
    role?: Roles;
}
