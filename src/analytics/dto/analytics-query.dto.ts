import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date / primary date (YYYY-MM-DD)',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  date1?: string;

  @ApiPropertyOptional({
    description: 'End date (YYYY-MM-DD)',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  date2?: string;

  @ApiPropertyOptional({
    description: 'Start date (YYYY-MM-DD) - alias for date1',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date (YYYY-MM-DD) - alias for date2',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'From date (YYYY-MM-DD) - alias for startDate',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'To date (YYYY-MM-DD) - alias for endDate',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Mess UUID filter',
  })
  @IsOptional()
  @IsString()
  messId?: string;

  @ApiPropertyOptional({
    description: 'Mess Admin / Owner UUID filter',
  })
  @IsOptional()
  @IsString()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Meal variation UUID filter (e.g. Breakfast / Lunch / Dinner)',
  })
  @IsOptional()
  @IsString()
  variationId?: string;

  // alias support
  @ApiPropertyOptional({
    description: 'Restaurant UUID filter (alias for messId)',
  })
  @IsOptional()
  @IsString()
  restaurantId?: string;

  @ApiPropertyOptional({
    description: 'Delivery agent UUID filter',
  })
  @IsOptional()
  @IsString()
  agentId?: string;
}
