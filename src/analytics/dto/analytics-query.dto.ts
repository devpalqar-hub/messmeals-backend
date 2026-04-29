import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
    @IsDateString()
    date1: string;

    @IsOptional()
    @IsDateString()
    date2?: string;

    @IsOptional()
    @IsString()
    messId?: string;

    @IsOptional()
    @IsString()
    ownerId?: string;

    // alias support
    @IsOptional()
    @IsString()
    restaurantId?: string;
}
