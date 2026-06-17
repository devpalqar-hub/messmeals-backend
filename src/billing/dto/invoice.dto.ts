import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class InvoiceMonthQueryDto {
    @ApiPropertyOptional({
        example: '2026-05',
        description: 'Usage month in YYYY-MM. Defaults to current month.',
    })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}$/)
    month?: string;
}

export class SettleInvoiceDto {
    @ApiProperty({ example: '2026-05', description: 'Invoice month in YYYY-MM.' })
    @IsString()
    @Matches(/^\d{4}-\d{2}$/)
    month!: string;
}

export class OverrideInvoiceDatesDto {
    @ApiPropertyOptional({ description: 'Override period start date' })
    @IsOptional()
    @IsDateString()
    periodStart?: string;

    @ApiPropertyOptional({ description: 'Override period end date (billing date)' })
    @IsOptional()
    @IsDateString()
    periodEnd?: string;

    @ApiPropertyOptional({ description: 'Override due date' })
    @IsOptional()
    @IsDateString()
    dueDate?: string;
}
