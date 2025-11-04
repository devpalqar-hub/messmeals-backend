import { IsOptional, IsString } from "class-validator";

export class PauseSubDto {

    @IsString()
    @IsOptional()
    pause_start_date: string

    @IsString()
    @IsOptional()
    pause_end_date: string
}

