import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SuperAdminRegisterDto {
    @ApiProperty({ example: 'Super Admin' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'superadmin@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '+919876543213' })
    @IsString()
    phone: string;

    @ApiProperty({ example: 'secure123' })
    @IsString()
    @MinLength(6)
    password: string;
}
