import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { MenuDayEntryDto } from './menu-day-entry.dto';

export class CreateMenuDto {
    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11', description: 'Mess UUID this menu belongs to' })
    @IsUUID()
    messId!: string;

    @ApiProperty({ example: 'Weekly Menu', description: 'Name of the menu.' })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Monday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    monday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Tuesday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    tuesday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Wednesday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    wednesday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Thursday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    thursday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Friday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    friday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Saturday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    saturday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Sunday\'s meal entries (variation + items).' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    sunday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
