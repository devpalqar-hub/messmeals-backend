import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class SuperAdminLoginDto {
    @ApiProperty({ example: 'superadmin@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'secure123' })
    @IsString()
    password: string;
}
