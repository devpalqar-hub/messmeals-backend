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

    //customer profile model
    @IsNumber()
    walletAmount: number

    @IsString()
    planId: string

    @IsString()
    start_date: string

    @IsString()
    @IsOptional()
    end_date: string

}
