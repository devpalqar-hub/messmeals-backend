import { IsInt, IsNotEmpty, IsString } from 'class-validator';

export class UpdateDeliveryPriorityDto {
    @IsInt()
    @IsNotEmpty()
    deliveryPriority: number;
}
