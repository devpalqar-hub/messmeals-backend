import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ExpenseStatus } from '@prisma/client';
import { IsDateString, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class PayExpenseDto {
    @ApiProperty({
        enum: [ExpenseStatus.UNPAID, ExpenseStatus.PAID],
        example: ExpenseStatus.PAID,
        description:
            'The payment outcome to record — UNPAID or PAID. Use this to complete a PENDING placeholder ' +
            '(the amount must be supplied here if it was left out at creation) or to flip an UNPAID expense ' +
            'to PAID once it has actually been settled. Not for setting PENDING — use PATCH /expenses/:id for that.',
    })
    @IsIn([ExpenseStatus.UNPAID, ExpenseStatus.PAID])
    status!: ExpenseStatus;

    @ApiPropertyOptional({ example: 1500, description: 'Required if the expense still has no amount (e.g. it was created as PENDING).' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    amount?: number;

    @ApiPropertyOptional({ example: 'CASH', description: 'Free-text payment mode, e.g. CASH, UPI, CARD, BANK_TRANSFER' })
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/expenses/receipt-1.jpg' })
    @IsOptional()
    @IsString()
    receiptUrl?: string;

    @ApiPropertyOptional({ example: '2026-08-27', description: 'When status=PAID, defaults to now if omitted.' })
    @IsOptional()
    @IsDateString()
    paidAt?: string;
}
