import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

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