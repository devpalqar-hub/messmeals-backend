import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DayOfWeek } from '@prisma/client';
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsEnum,
    IsNotEmpty,
    IsOptional,
    IsString,
    IsUUID,
} from 'class-validator';

export class CreateMenuDto {
    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11', description: 'Mess UUID this menu belongs to' })
    @IsUUID()
    messId!: string;

    @ApiProperty({
        example: '1f2e3d4c-1111-2222-3333-444455556666',
        description: 'Variation UUID this menu is for (e.g. Breakfast / Lunch / Dinner).',
    })
    @IsUUID()
    variationId!: string;

    @ApiPropertyOptional({ example: 'Weekday Lunch' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({
        enum: DayOfWeek,
        isArray: true,
        example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
        description: 'Days of the week this menu applies to.',
    })
    @IsArray()
    @ArrayMinSize(1)
    @IsEnum(DayOfWeek, { each: true })
    days!: DayOfWeek[];

    @ApiProperty({ example: 'Rice, Dal, Sabzi, Roti, Pickle', description: 'Menu items as free text.' })
    @IsString()
    @IsNotEmpty()
    items!: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
