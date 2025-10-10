import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '@prisma/client';

export class CreateUserDto {
    @IsString()
    name: string;

    @IsString()
    phone: string;

    @IsEmail()
    email: string;

    @IsString()
    @IsOptional()
    @MinLength(6)
    password: string;
}