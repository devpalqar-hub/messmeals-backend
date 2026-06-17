import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
    @ApiProperty({ example: '+919876543210' })
    @IsString()
    @MinLength(10)
    phone: string;

}
