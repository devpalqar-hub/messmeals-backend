import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VariationStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';

export class VariationCountQueryDto {
    @ApiProperty({
        description: 'Mess ID (UUID) to scope the analytics',
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    })
    @IsUUID()
    messId: string;

    @ApiProperty({
        description: 'Start of the date range (inclusive). Format: YYYY-MM-DD',
        example: '2026-06-01',
    })
    @IsDateString()
    fromDate: string;

    @ApiProperty({
        description: 'End of the date range (inclusive). Format: YYYY-MM-DD',
        example: '2026-06-30',
    })
    @IsDateString()
    toDate: string;

    @ApiPropertyOptional({
        description: 'Optional: narrow results to a specific plan (UUID)',
        example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    })
    @IsOptional()
    @IsUUID()
    planId?: string;

    @ApiPropertyOptional({
        description: 'Optional: filter by variation delivery status',
        enum: VariationStatus,
        example: VariationStatus.DELIVERED,
    })
    @IsOptional()
    @IsEnum(VariationStatus)
    status?: VariationStatus;
}
