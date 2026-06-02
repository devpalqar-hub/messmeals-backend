import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelDeliveryDto {
    @ApiProperty({
        example: '2026-06-10',
        description: 'ISO date of the specific delivery to cancel (YYYY-MM-DD).',
    })
    @IsString()
    date: string;
}

export class CancelSubDto {
    @ApiPropertyOptional({ example: '2026-05-20' })
    @IsString()
    @IsOptional()
    cancellation_start_date: string

    @ApiPropertyOptional({ example: '2026-05-25' })
    @IsString()
    @IsOptional()
    cancellation_end_date: string

    @ApiPropertyOptional({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsString()
    @IsOptional()
    subscriptionId: string
}