import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

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
