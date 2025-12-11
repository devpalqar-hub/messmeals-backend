import { DeliveryStatus } from "@prisma/client";

export class UpdateDeliveryStatusDto {
    deliveryId: string;
    status: DeliveryStatus; // PENDING | PROGRESS | DELIVERED
}