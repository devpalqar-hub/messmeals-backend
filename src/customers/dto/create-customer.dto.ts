import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, IsBoolean, IsEnum, IsJSON, IsArray } from 'class-validator';
import { ScheduleType, DayOfWeek } from '@prisma/client';

export class CreateCustomerDto {
    //user model
    @IsString()
    name: string;

    @IsPhoneNumber()
    @IsString()
    phone: string;

    @IsEmail()
    email: string;

    @IsString()
    address: string

    @IsString()
    latitude_logitude: string

    @IsString()
    currentLocation: string

    @IsBoolean()
    is_active: boolean

    //customer profile model
    @IsString()
    walletAmount: string

    @IsString()
    discount: string

    @IsString()
    planId: string

    @IsString()
    deliveryPartnerId: string

    @IsString()
    start_date: string

    @IsString()
    @IsOptional()
    end_date: string

    //phase 2 changes:

    @IsEnum(ScheduleType)
    scheduleType: ScheduleType;

    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true }) // optional if you have enum
    selectedDays: string[];


}

export class UpdateCustomerDto {
    //user model
    @IsString()
    @IsOptional()
    name: string;

    @IsString()
    @IsOptional()
    address: string

    @IsString()
    @IsOptional()
    latitude_logitude: string

    @IsString()
    @IsOptional()
    currentLocation: string

    //customer profile model
    @IsNumber()
    @IsOptional()
    walletAmount: number

    @IsString()
    @IsOptional()
    planId: string

    @IsString()
    @IsOptional()
    deliveryPartnerId: string

}



export class choosePlanDto {

    @IsString()
    addressId: string

    @IsString()
    planId: string

    @IsString()
    start_date: string

    @IsString()
    @IsOptional()
    end_date: string

    //phase 2 changes:

    @IsEnum(ScheduleType)
    scheduleType: ScheduleType;

    @IsOptional()
    @IsArray()
    @IsEnum(DayOfWeek, { each: true }) // optional if you have enum
    selectedDays: string[];

    @IsOptional()
    @IsString()
    successUrl: string;

    @IsOptional()
    @IsString()
    cancelUrl: string;

}