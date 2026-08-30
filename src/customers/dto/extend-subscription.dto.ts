import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ExtendSubscriptionDto {
    @ApiProperty({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsString()
    subscriptionId: string;

    @ApiProperty({
        example: '2026-07-31',
        description: 'New end date for the subscription. Must be after the current end_date.',
    })
    @IsString()
    new_end_date: string;

    @ApiPropertyOptional({ example: 'https://example.com/success' })
    @IsOptional()
    @IsString()
    successUrl?: string;

    @ApiPropertyOptional({ example: 'https://example.com/cancel' })
    @IsOptional()
    @IsString()
    cancelUrl?: string;
}
