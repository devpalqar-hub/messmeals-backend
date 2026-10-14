import { DeliveryStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    required: true,
    type: 'string',
    example: 'delivery-uuid-123',
    description: 'UUID of the delivery to update',
  })
  deliveryId: string;

  @ApiProperty({
    enum: DeliveryStatus,
    required: true,
    example: DeliveryStatus.DELIVERED,
    description: 'New status for the delivery',
  })
  status: DeliveryStatus;
}
