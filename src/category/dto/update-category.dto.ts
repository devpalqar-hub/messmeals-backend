import { PartialType } from '@nestjs/mapped-types';
import { CreateCategoryDto } from './create-category.dto';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCategoryDto {
    @ApiPropertyOptional({ example: 'Breakfast' })
    @IsString()
    @IsOptional()
    name: string;

    @ApiPropertyOptional({ example: 'Morning meal category' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
