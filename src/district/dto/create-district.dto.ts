import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateDistrictDto {
    @ApiProperty({ example: 'Central District' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'https://cdn.example.com/districts/central.jpg' })
    @IsString()
    image: string;
}
