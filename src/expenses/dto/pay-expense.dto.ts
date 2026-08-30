import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PayExpenseDto {
    @ApiPropertyOptional({
        example: 1500,
        description: 'Finalizes/updates the total amount owed. Required here if the expense has no amount yet (e.g. it was created PENDING).',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    amount?: number;

    @ApiProperty({
        example: 1500,
        description:
            'Total amount paid so far (cumulative, not incremental — pass the full amount paid to date, not just this instalment). ' +
            'Compared against amount to calculate the resulting status: UNPAID (0), PARTIALLY_PAID (< amount) or PAID (>= amount).',
    })
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    paidAmount!: number;

    @ApiPropertyOptional({ example: 'CASH', description: 'Free-text payment mode, e.g. CASH, UPI, CARD, BANK_TRANSFER' })
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/expenses/receipt-1.jpg' })
    @IsOptional()
    @IsString()
    receiptUrl?: string;

    @ApiPropertyOptional({ example: '2026-08-27', description: 'When the expense becomes fully paid, defaults to now if omitted.' })
    @IsOptional()
    @IsDateString()
    paidAt?: string;
}
