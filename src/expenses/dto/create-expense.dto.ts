import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ExpenseStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

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
        description: 'Required and must be > 0 unless status is PENDING (a pending entry can be logged without a final amount and completed later).',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    amount?: number;

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
        enum: ExpenseStatus,
        example: ExpenseStatus.UNPAID,
        description:
            'Defaults to UNPAID. Set to PENDING to log a placeholder entry (amount optional) that can be completed and moved to UNPAID/PAID later.',
    })
    @IsOptional()
    @IsEnum(ExpenseStatus)
    status?: ExpenseStatus;
}
