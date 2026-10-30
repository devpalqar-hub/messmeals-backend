import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { DayOfWeek } from '@prisma/client';

export class SetMenuDaysDto {
  @ApiProperty({
    enum: DayOfWeek,
    isArray: true,
    example: [DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY, DayOfWeek.THURSDAY, DayOfWeek.FRIDAY],
    description: 'Serving days to enable for this menu',
  })
  @IsArray()
  @IsEnum(DayOfWeek, { each: true })
  days!: DayOfWeek[];
}

export class DayMealItemDto {
  @ApiProperty({ example: 'b0a701fa-bfba-40a2-a89e-2fcda4b7a701', description: 'Variation UUID (e.g., Breakfast, Lunch, Dinner)' })
  @IsString()
  @IsNotEmpty()
  variationId!: string;

  @ApiProperty({ example: 'Paneer Butter Masala, 3 Rotis, Jeera Rice, Dal Fry', description: 'Comma-separated meal items' })
  @IsString()
  @IsNotEmpty()
  items!: string;
}

export class SetDayMealsDto {
  @ApiProperty({ type: [DayMealItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DayMealItemDto)
  meals!: DayMealItemDto[];
}
