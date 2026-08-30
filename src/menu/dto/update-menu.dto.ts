import { ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class UpdateMenuDto {
    @ApiPropertyOptional({
        example: '1f2e3d4c-1111-2222-3333-444455556666',
        description: 'Variation UUID this menu is for (e.g. Breakfast / Lunch / Dinner).',
    })
    @IsOptional()
    @IsUUID()
    variationId?: string;

    @ApiPropertyOptional({ example: 'Weekday Lunch' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({
        enum: DayOfWeek,
        isArray: true,
        example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
    })
    @IsOptional()
    @IsArray()
    @ArrayMinSize(1)
    @IsEnum(DayOfWeek, { each: true })
    days?: DayOfWeek[];

    @ApiPropertyOptional({ example: 'Rice, Dal, Sabzi, Roti, Pickle' })
    @IsOptional()
    @IsString()
    items?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
