import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariationStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const PARTNER_STOP_STATUSES = [
  VariationStatus.DELIVERED,
  VariationStatus.UNDELIVERED,
  VariationStatus.CANCELLED,
] as const;

export type PartnerStopStatus = (typeof PARTNER_STOP_STATUSES)[number];

/** Statuses that need the partner to say why. */
export const STATUSES_REQUIRING_NOTE: readonly VariationStatus[] = [
  VariationStatus.UNDELIVERED,
  VariationStatus.CANCELLED,
];

export class UpdateStopStatusDto {
  @ApiProperty({
    enum: PARTNER_STOP_STATUSES,
    example: VariationStatus.UNDELIVERED,
    description: 'Outcome of this stop for the session’s variation.',
  })
  @IsIn(PARTNER_STOP_STATUSES)
  status: PartnerStopStatus;

  @ApiPropertyOptional({
    example: 'Customer not available, door locked',
    maxLength: 500,
    description:
      'Reason for the outcome — required for UNDELIVERED and CANCELLED, ignored for DELIVERED.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf(
    (o: UpdateStopStatusDto) =>
      STATUSES_REQUIRING_NOTE.includes(o.status) || o.note !== undefined,
  )
  @IsString()
  @IsNotEmpty({ message: 'note is required for UNDELIVERED and CANCELLED' })
  @MaxLength(500)
  note?: string;
}
