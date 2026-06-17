import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class RegisterDto {
    @ApiProperty({ example: 'admin@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '+919876543210' })
    @IsString()
    phone: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    name: string;

    @ApiPropertyOptional({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsOptional()
    @IsUUID()
    messId?: string;
}

export class UserRegisterDto {
    @ApiProperty({ example: 'customer@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '+919876543211' })
    @IsString()
    phone: string;

    @ApiProperty({ example: 'Jane Doe' })
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
    @ApiProperty({ example: 'delivery@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '+919876543212' })
    @IsString()
    phone: string;

    @ApiProperty({ example: 'Delivery Partner' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsString()
    messId: string;

    @ApiPropertyOptional({ example: 'North Zone' })
    @IsString()
    @IsOptional()
    deliveryRegion: string

    @ApiPropertyOptional({ example: '123 Delivery Street' })
    @IsString()
    @IsOptional()
    address: string
}
