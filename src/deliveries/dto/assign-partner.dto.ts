import { IsEnum, IsString } from "class-validator";
import { DeliveryStatus } from "@prisma/client";

export class AssignDeliveryPartnerDto {

    @IsString()
    partnerId: string;

}

// Phase 2.
// Delivery Partner Assigning to Orders Booked by user through their application.
export class AssignDeliveryPartnerPhs2Dto {

    //deliverypartner profile id
    @IsString()
    partnerId: string;

    @IsString()
    subscptnId: string;

}