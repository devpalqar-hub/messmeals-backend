import { IsEnum, IsString } from "class-validator";
import { DeliveryStatus } from "@prisma/client";

export class AssignDeliveryPartnerDto {

    @IsString()
    partnerId: string;

}