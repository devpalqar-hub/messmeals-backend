import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '@prisma/client';

export class DeliveryAgentCreateDto {
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

export class DeliveryAgentUpdateDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    phone?: string;

    @IsOptional()
    @IsEmail()
    email?: string;

    @IsOptional()
    @IsString()
    @MinLength(6)
    password?: string;
}
