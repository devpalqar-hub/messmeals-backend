import { ApiPropertyOptional } from '@nestjs/swagger';
import { VariationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';

export class ListDeliveryVariationsQueryDto {
  @ApiPropertyOptional({ description: 'Page number (default 1)', example: 1 })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size (default 20)',
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Filter by this variation (meal) status, e.g. only PENDING Breakfast rows',
    enum: VariationStatus,
    example: VariationStatus.PENDING,
  })
  @IsOptional()
  @IsEnum(VariationStatus)
  status?: VariationStatus;

  @ApiPropertyOptional({
    description: 'Filter by exact delivery date (YYYY-MM-DD)',
    example: '2026-06-01',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({
    description:
      'Filter by mess (UUID). SUPERADMIN only — MESSADMIN is already scoped to their own mess(es).',
  })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by delivery partner / agent (UUID). SUPERADMIN and MESSADMIN only.',
  })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({
    description:
      'Filter by variation (UUID) — e.g. only Breakfast rows, or only Dinner rows.',
  })
  @IsOptional()
  @IsUUID()
  variationId?: string;

  @ApiPropertyOptional({
    description: 'Filter by subscription (UUID).',
  })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;
}
