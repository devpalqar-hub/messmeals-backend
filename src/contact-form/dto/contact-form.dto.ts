import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class CreateContactFormDto {
    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    Name: string;

    @ApiProperty({ example: '+919876543217' })
    @IsString()
    @IsNotEmpty()
    phone_number: string;

    @ApiProperty({ example: 'john@example.com' })
    @IsString()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'Need help with subscription' })
    @IsString()
    @IsNotEmpty()
    message: string;

    @ApiProperty({ example: 'Super Meals' })
    @IsString()
    @IsNotEmpty()
    messname: string;

    @ApiProperty({ example: 'Central District' })
    @IsString()
    @IsNotEmpty()
    district: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @IsNotEmpty()
    pincode: string;


}
