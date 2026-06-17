import { IsEmail, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateUserAddressDto {
    @ApiProperty({ example: "John Doe" })
    @IsString()
    name: string;

    @ApiProperty({ example: "221B Baker Street" })
    @IsString()
    street: string;

    @ApiProperty({ example: "London" })
    @IsString()
    townOrcity: string;

    @ApiPropertyOptional({ example: "United Kingdom" })
    @IsOptional()
    @IsString()
    country?: string;

    @ApiProperty({ example: "NW1 6XE" })
    @IsString()
    postcode: string;

    @ApiPropertyOptional({ example: "Near Museum" })
    @IsOptional()
    @IsString()
    landmark?: string;

    @ApiPropertyOptional({ example: "51.5237,-0.1585" })
    @IsOptional()
    @IsString()
    latitudeLogitude?: string;

    @ApiProperty({ example: "+44-9876543210" })
    @IsString()
    phone: string;

    @ApiProperty({ example: "john@example.com" })
    @IsEmail()
    email: string;


    @ApiProperty({ example: "location link" })
    @IsString()
    @IsOptional()
    locationLink: string;
}

