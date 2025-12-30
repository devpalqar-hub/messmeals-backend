import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    phone: string;

    @IsString()
    name: string;

    @IsString()
    messId: string;
}


export class UserRegisterDto {
    @IsEmail()
    email: string;

    @IsString()
    phone: string;

    @IsString()
    name: string;

    @ApiProperty({ example: "221B Baker Street" })
    @IsString()
    @IsOptional()
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
    @IsOptional()
    postcode: string;

    @ApiPropertyOptional({ example: "Near Museum" })
    @IsOptional()
    @IsString()
    landmark?: string;

    @ApiPropertyOptional({ example: "51.5237,-0.1585" })
    @IsOptional()
    @IsString()
    latitudeLogitude?: string;

}


export class RegisterDeliveryAgentDto {
    @IsEmail()
    email: string;

    @IsString()
    phone: string;

    @IsString()
    name: string;

    @IsString()
    messId: string;

    @IsString()
    @IsOptional()
    deliveryRegion: string

    @IsString()
    @IsOptional()
    address: string
}
