import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreatePaymentDto {
    @IsString()
    subscriptionId: string;

    @IsNumber()
    amount: number;

    @IsString()
    @IsOptional()
    description?: string;

    @IsString()
    @IsOptional()
    customerName?: string;

    @IsString()
    @IsOptional()
    customerEmail?: string;

    @IsString()
    @IsOptional()
    customerPhone?: string;
}
