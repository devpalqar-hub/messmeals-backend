import { IsString, IsEnum, IsDateString, IsOptional } from 'class-validator';
import { DeliveryStatus } from '@prisma/client';

export class CreateDeliveryDto {
    @IsDateString()
    date: string;

    @IsEnum(DeliveryStatus)
    status: DeliveryStatus;

    @IsOptional()
    @IsString()
    action?: string;

    @IsString()
    customerId: string;

    @IsString()
    messId: string

    @IsString()
    planId: string;

    @IsString()
    partnerId: string;
}
