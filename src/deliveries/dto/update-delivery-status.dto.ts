import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class UpdateDeliveryStatusDto {
    @ApiProperty({ enum: DeliveryStatus, example: DeliveryStatus.DELIVERED })
    @IsEnum(DeliveryStatus)
    status: DeliveryStatus;
}

/**
 * DTO for mess owner / mess admin to mark a delivery as
 * COMPLETED (delivered & confirmed) or UNDELIVERED (failed delivery).
 */
export class UpdateDeliveryOwnerStatusDto {
    @ApiProperty({
        enum: [DeliveryStatus.COMPLETED, DeliveryStatus.UNDELIVERED],
        example: DeliveryStatus.COMPLETED,
        description: 'COMPLETED = successfully delivered & confirmed. UNDELIVERED = delivery failed.',
    })
    @IsEnum(DeliveryStatus, { message: 'status must be COMPLETED or UNDELIVERED' })
    status: DeliveryStatus;
}