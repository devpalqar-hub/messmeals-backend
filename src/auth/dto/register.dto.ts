import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { Roles } from '@prisma/client';

export class RegisterDto {
    @IsString()
    name: string;

    @IsString()
    phone: string;

    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;
}
