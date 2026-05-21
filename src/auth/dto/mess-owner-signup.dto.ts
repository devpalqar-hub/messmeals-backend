import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class MessOwnerSignupDto {
    @ApiProperty({
        example: 'Suresh',
        description: 'Contact / owner name (alias of ownerName if ownerName is omitted).',
    })
    @IsString()
    name!: string;

    @ApiPropertyOptional({
        example: 'Suresh Kumar',
        description: 'Owner name (optional; if omitted, `name` will be used).',
    })
    @IsOptional()
    @IsString()
    ownerName?: string;

    @ApiProperty({ example: '+919895728129' })
    @IsString()
    phone!: string;

    @ApiProperty({ example: 'owner@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'Edappally, Kochi' })
    @IsString()
    address!: string;

    @ApiProperty({
        example: 'Ernakulam',
        description: 'District name (must exist in Districts table).',
    })
    @IsString()
    district!: string;

    @ApiProperty({ example: 'Annapoorna Mess' })
    @IsString()
    messName!: string;

    @ApiProperty({ example: '123456', description: 'OTP received on phone.' })
    @IsString()
    otp!: string;
}

export class MessOwnerSendOtpDto {
    @ApiProperty({
        example: 'Suresh',
        description: 'Contact / owner name (alias of ownerName if ownerName is omitted).',
    })
    @IsString()
    name!: string;

    @ApiPropertyOptional({
        example: 'Suresh Kumar',
        description: 'Owner name (optional; if omitted, `name` will be used).',
    })
    @IsOptional()
    @IsString()
    ownerName?: string;

    @ApiProperty({ example: '+919895728129' })
    @IsString()
    phone!: string;

    @ApiProperty({ example: 'owner@example.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'Edappally, Kochi' })
    @IsString()
    address!: string;

    @ApiProperty({
        example: 'Ernakulam',
        description: 'District name (must exist in Districts table).',
    })
    @IsString()
    district!: string;

    @ApiProperty({ example: 'Annapoorna Mess' })
    @IsString()
    messName!: string;
}
