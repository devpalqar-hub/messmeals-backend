import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateExpenseCategoryDto {
    @ApiPropertyOptional({ example: 'Groceries' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: 'Vegetables, rice, spices and other kitchen supplies' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
