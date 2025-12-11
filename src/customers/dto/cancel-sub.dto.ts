import { IsOptional, IsString } from "class-validator";

export class CancelSubDto {

    @IsString()
    @IsOptional()
    cancellation_start_date: string

    @IsString()
    @IsOptional()
    cancellation_end_date: string

    @IsString()
    @IsOptional()
    subscriptionId: string
}