import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsOptional, IsUUID } from 'class-validator';

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1';

export class WorkDayQueryDto {
  @ApiPropertyOptional({
    example: '2026-11-20',
    description: 'Delivery day (YYYY-MM-DD). Defaults to today (Asia/Kolkata).',
  })
  @IsOptional()
  @IsDateString()
  date?: string;
}

export class MyRouteQueryDto extends WorkDayQueryDto {
  @ApiProperty({ description: 'Variation UUID (e.g. Lunch)' })
  @IsUUID()
  variationId: string;
}

export class DeliveryDetailsQueryDto {
  @ApiPropertyOptional({
    description:
      'Variation UUID — highlights that meal and returns its route position.',
  })
  @IsOptional()
  @IsUUID()
  variationId?: string;
}

export class AdminRoutesQueryDto extends WorkDayQueryDto {
  @ApiPropertyOptional({
    description:
      'Mess UUID. Required for SUPERADMIN and for a MESSADMIN managing several messes.',
  })
  @IsOptional()
  @IsUUID()
  messId?: string;

  @ApiPropertyOptional({ description: 'Only this variation' })
  @IsOptional()
  @IsUUID()
  variationId?: string;

  @ApiPropertyOptional({ description: 'Only this delivery partner' })
  @IsOptional()
  @IsUUID()
  partnerId?: string;

  @ApiPropertyOptional({
    description: 'Only deliveries with no partner assigned',
    type: Boolean,
  })
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  unassigned?: boolean;
}
