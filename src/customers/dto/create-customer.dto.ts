import { IsEmail, IsNumber, IsOptional, IsPhoneNumber, IsString, MinLength } from 'class-validator';

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

    //customer profile model
    @IsNumber()
    walletAmount: number

    @IsString()
    planId: string

    @IsString()
    deliveryPartnerId: string

    @IsString()
    start_date: string

    @IsString()
    @IsOptional()
    end_date: string

}


export class UpdateCustomerDto {
    //user model
    @IsString()
    name: string;

    @IsString()
    address: string

    //customer profile model
    @IsNumber()
    walletAmount: number

    @IsString()
    planId: string

    @IsString()
    deliveryPartnerId: string

}
