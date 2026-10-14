import { DeliveryStatus } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class UpdateDeliveryStatusDto {
  @ApiProperty({
    required: true,
    type: 'string',
    example: 'delivery-uuid-123',
    description: 'UUID of the delivery to update',
  })
  @IsString()
  @IsNotEmpty()
  deliveryId: string;

  @ApiProperty({
    enum: DeliveryStatus,
    required: true,
    example: DeliveryStatus.DELIVERED,
    description: 'New status for the delivery',
  })
  @IsEnum(DeliveryStatus)
  @IsNotEmpty()
  status: DeliveryStatus;
}

