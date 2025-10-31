import { IsString } from "class-validator";

export class CancelSubDto {

    @IsString()
    customerId: string

    @IsString()
    subscriptionId: string
}

