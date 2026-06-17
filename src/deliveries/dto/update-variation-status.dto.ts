import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { VariationStatus } from '@prisma/client';

export class UpdateVariationStatusDto {
    @ApiProperty({
        enum: VariationStatus,
        example: VariationStatus.DELIVERED,
        description: 'Set the status of a specific variation within a delivery (e.g. Breakfast DELIVERED, Dinner UNDELIVERED).',
    })
    @IsEnum(VariationStatus)
    status: VariationStatus;
}
