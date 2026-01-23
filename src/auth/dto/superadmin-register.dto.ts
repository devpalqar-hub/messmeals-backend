import { IsEmail, IsString, MinLength } from 'class-validator';

export class SuperAdminRegisterDto {
    @IsString()
    name: string;

    @IsEmail()
    email: string;

    @IsString()
    phone: string;

    @IsString()
    @MinLength(6)
    password: string;
}
