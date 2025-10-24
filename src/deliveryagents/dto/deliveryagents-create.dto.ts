import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Roles } from '@prisma/client';

export class DeliveryAgentCreateDto {
    @IsString()
    name: string;

    @IsString()
    phone: string;

    @IsString()
    @IsOptional()
    address: string;

    @IsEmail()
    email: string;


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

    @IsString()
    @IsOptional()
    address: string;

}
