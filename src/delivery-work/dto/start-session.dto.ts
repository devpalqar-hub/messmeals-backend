import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class StartWorkSessionDto {
  @ApiProperty({ description: 'Variation UUID to start (e.g. Lunch)' })
  @IsUUID()
  variationId: string;

  @ApiPropertyOptional({
    example: '2026-11-20',
    description: 'Delivery day (YYYY-MM-DD). Defaults to today (Asia/Kolkata).',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}
