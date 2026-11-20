import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class OptimizeRoutesDto {
  @ApiPropertyOptional({
    description:
      'Mess UUID. Required for SUPERADMIN and for a MESSADMIN managing several messes.',
  })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({
    example: '2026-11-20',
    description: 'Delivery day (YYYY-MM-DD). Defaults to today (Asia/Kolkata).',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiPropertyOptional({ description: 'Only this variation (default: all)' })
  @IsOptional()
  @IsUUID()
  variationId?: string;

  @ApiPropertyOptional({ description: 'Only this partner (default: all)' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({ description: 'Only the unassigned deliveries' })
  @IsOptional()
  @IsBoolean()
  unassigned?: boolean;
}

export class TransferDeliveriesDto {
  @ApiPropertyOptional({
    description:
      'Mess UUID. Required for SUPERADMIN and for a MESSADMIN managing several messes.',
  })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({
    example: '2026-11-20',
    description: 'Delivery day (YYYY-MM-DD). Defaults to today (Asia/Kolkata).',
  })
  @IsOptional()
  @IsDateString()
  date?: string;

  @ApiProperty({ description: 'Partner who will take over the deliveries' })
  @IsUUID()
  toPartnerId: string;

  @ApiPropertyOptional({
    description:
      "Move all of this partner's pending deliveries for the day. Omit together with " +
      'deliveryIds to move the unassigned deliveries.',
  })
  @IsOptional()
  @IsUUID()
  fromPartnerId?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Move only these deliveries (must be on the given day).',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  deliveryIds?: string[];
}
