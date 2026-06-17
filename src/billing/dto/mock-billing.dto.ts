import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class MockBillingQueryDto {
    @ApiProperty({
        example: 'uuid-of-the-mess',
        description: 'The mess ID to simulate billing for.',
    })
    @IsUUID()
    messId!: string;

    @ApiPropertyOptional({
        example: '2026-06-01',
        description:
            'Reference date (YYYY-MM-DD). The billing period that contains this date will be simulated. Defaults to today.',
    })
    @IsOptional()
    @IsString()
    @IsDateString()
    date?: string;
}
