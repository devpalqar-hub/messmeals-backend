import {
    IsString,
    IsInt,
    IsUUID,
    IsOptional,
    IsBoolean,
    Min,
    Max,
} from 'class-validator';

export class CreateTestimonialDto {
    @IsUUID()
    messId: string;

    @IsInt()
    @Min(1)
    @Max(5)
    ratings: number;

    @IsString()
    reviews: string;

    @IsUUID()
    customerId: string;

    @IsOptional()
    @IsUUID()
    DeliveryagentId?: string;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
