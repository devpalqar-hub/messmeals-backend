import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ExpenseStatus } from '@prisma/client';
import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateExpenseDto {
    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11', description: 'Mess UUID this expense belongs to' })
    @IsUUID()
    messId!: string;

    @ApiProperty({ example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11', description: 'Expense category UUID' })
    @IsUUID()
    categoryId!: string;

    @ApiProperty({ example: 'Vegetable purchase for the week' })
    @IsString()
    @IsNotEmpty()
    title!: string;

    @ApiPropertyOptional({
        example: 1500,
        description: 'Total amount owed. Required and must be > 0 unless status is PENDING (a pending entry can be logged without a final amount and completed later).',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    amount?: number;

    @ApiPropertyOptional({
        example: 0,
        description:
            'How much of `amount` has already been paid (defaults to 0). Compared against `amount` to calculate ' +
            'the expense status automatically: UNPAID (0), PARTIALLY_PAID (< amount) or PAID (>= amount). Ignored when status is PENDING.',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    paidAmount?: number;

    @ApiPropertyOptional({ example: 'Bought from the local wholesale market' })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiPropertyOptional({ example: '2026-08-20', description: 'Date the expense was incurred. Defaults to now.' })
    @IsOptional()
    @IsDateString()
    expenseDate?: string;

    @ApiPropertyOptional({ example: 'CASH', description: 'Free-text payment mode, e.g. CASH, UPI, CARD, BANK_TRANSFER' })
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/expenses/receipt-1.jpg' })
    @IsOptional()
    @IsString()
    receiptUrl?: string;

    @ApiPropertyOptional({
        enum: [ExpenseStatus.PENDING],
        example: ExpenseStatus.PENDING,
        description:
            'Pass PENDING to log a placeholder entry with no final amount yet, to be completed later. ' +
            'Omit otherwise — the real status (UNPAID/PARTIALLY_PAID/PAID) is always calculated from amount vs paidAmount, not set directly.',
    })
    @IsOptional()
    @IsIn([ExpenseStatus.PENDING])
    status?: ExpenseStatus;
}
