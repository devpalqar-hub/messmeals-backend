import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { MenuDayEntryDto } from './menu-day-entry.dto';

export class UpdateMenuDto {
    @ApiPropertyOptional({ example: 'Weekly Menu' })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Monday\'s meal entries entirely when present.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    monday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Tuesday\'s meal entries entirely when present.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    tuesday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Wednesday\'s meal entries entirely when present.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    wednesday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Thursday\'s meal entries entirely when present.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    thursday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Friday\'s meal entries entirely when present.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    friday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Saturday\'s meal entries entirely when present.' })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MenuDayEntryDto)
    saturday?: MenuDayEntryDto[];

    @ApiPropertyOptional({ type: [MenuDayEntryDto], description: 'Replaces Sunday\'s meal entries entirely when present.' })
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
