import { IsArray, IsDateString, IsEnum, IsOptional, IsString } from "class-validator";
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

export class AssignDeliveryPartnerToDeliveriesDto {
    @IsString()
    partnerId: string;

    // Option 1: assign for specific deliveries
    @IsOptional()
    @IsArray()
    deliveryIds?: string[];

    // Option 2: assign for a subscription (date filtered)
    @IsOptional()
    @IsString()
    subscriptionId?: string;

    @IsOptional()
    @IsDateString()
    fromDate?: string;

    @IsOptional()
    @IsDateString()
    toDate?: string;
}