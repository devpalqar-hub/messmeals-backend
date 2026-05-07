import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateDistrictDto {
    @ApiPropertyOptional({ example: 'Central District' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/districts/central.jpg' })
    @IsOptional()
    @IsString()
    image?: string;


    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isPopular?: boolean;
}
