import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';


export class DeliveryAgentCreateDto {
    @ApiProperty({ example: 'Delivery Agent' })
    @IsString()
    name: string;

    @ApiProperty({ example: '+919876543216' })
    @IsString()
    phone: string;

    @ApiPropertyOptional({ example: 'Flat 12, Green Apartments' })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsString()
    messId: string

    @ApiPropertyOptional({ example: 'delivery.agent@example.com' })
    @IsEmail()
    @IsOptional()
    email?: string;

    @ApiProperty({ example: 'North Zone' })
    @IsString()
    deliverAgentRegion: string

    @ApiProperty({ example: true })
    @IsBoolean()
    is_active: boolean


}

export class DeliveryAgentUpdateDto {
    @ApiPropertyOptional({ example: 'Delivery Agent Updated' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: '+919876543210' })
    @IsOptional()
    @IsString()
    phone?: string;

    @ApiPropertyOptional({ example: 'Flat 42, Blue Towers' })
    @IsString()
    @IsOptional()
    address?: string;

    @ApiPropertyOptional({ example: 'South Zone' })
    @IsString()
    @IsOptional()
    deliverAgentRegion?: string

    @ApiPropertyOptional({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsOptional()
    @IsString()
    messId?: string

    @ApiPropertyOptional({ example: false })
    @IsBoolean()
    @IsOptional()
    is_active?: boolean
}
