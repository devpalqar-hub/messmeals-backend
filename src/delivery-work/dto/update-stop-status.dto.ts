import { ApiProperty } from '@nestjs/swagger';
import { VariationStatus } from '@prisma/client';
import { IsIn } from 'class-validator';

export const PARTNER_STOP_STATUSES = [
  VariationStatus.DELIVERED,
  VariationStatus.UNDELIVERED,
  VariationStatus.CANCELLED,
] as const;

export type PartnerStopStatus = (typeof PARTNER_STOP_STATUSES)[number];

export class UpdateStopStatusDto {
  @ApiProperty({
    enum: PARTNER_STOP_STATUSES,
    example: VariationStatus.DELIVERED,
    description: 'Outcome of this stop for the session’s variation.',
  })
  @IsIn(PARTNER_STOP_STATUSES)
  status: PartnerStopStatus;
}
