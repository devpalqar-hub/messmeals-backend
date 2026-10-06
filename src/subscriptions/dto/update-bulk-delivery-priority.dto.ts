import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNotEmpty, IsUUID, ValidateNested } from 'class-validator';

export class UpdateBulkSequenceItemDto {
    @ApiProperty()
    @IsUUID()
    @IsNotEmpty()
    subscriptionId: string;

    @ApiProperty()
    @IsInt()
    @IsNotEmpty()
    deliveryPriority: number;
}

export class UpdateBulkDeliveryPriorityDto {
    @ApiProperty({ type: [UpdateBulkSequenceItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => UpdateBulkSequenceItemDto)
    subscriptions: UpdateBulkSequenceItemDto[];
}
