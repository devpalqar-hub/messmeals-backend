import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, IsBoolean } from 'class-validator';

export class RenewSubscriptionDto {

    @IsString()
    planId: string

    @IsString()
    start_date: string

    @IsString()
    deliveryPartnerId: string

    @IsString()
    customerProfileId: string

    @IsString()
    discount: string

    @IsString()
    @IsOptional()
    end_date: string

}
