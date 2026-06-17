import {
    IsString,
    IsInt,
    IsUUID,
    IsOptional,
    IsBoolean,
    Min,
    Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTestimonialDto {
    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' })
    @IsUUID()
    messId: string;

    @ApiProperty({ example: 5 })
    @IsInt()
    @Min(1)
    @Max(5)
    ratings: number;

    @ApiProperty({ example: 'Great food and timely delivery.' })
    @IsString()
    reviews: string;

    @ApiProperty({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsUUID()
    customerId: string;

    @ApiPropertyOptional({ example: 'd8eb8a6f-44b7-4eb8-b40c-1f9f3c2f6a44' })
    @IsOptional()
    @IsUUID()
    DeliveryagentId?: string;

    @ApiPropertyOptional({ example: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
