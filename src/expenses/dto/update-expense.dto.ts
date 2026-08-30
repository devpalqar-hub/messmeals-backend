import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class UpdateExpenseDto {
    @ApiPropertyOptional({ example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11', description: 'Expense category UUID' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiPropertyOptional({ example: 'Vegetable purchase for the week' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: 1500, description: 'Total amount owed. Leaving this at 0/unset keeps the expense PENDING.' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    amount?: number;

    @ApiPropertyOptional({
        example: 750,
        description: 'How much of `amount` has been paid so far. Compared against amount to calculate the status automatically (UNPAID/PARTIALLY_PAID/PAID).',
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

    @ApiPropertyOptional({ example: '2026-08-20' })
    @IsOptional()
    @IsDateString()
    expenseDate?: string;

    @ApiPropertyOptional({ example: 'CASH' })
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    @ApiPropertyOptional({ example: 'https://cdn.example.com/expenses/receipt-1.jpg' })
    @IsOptional()
    @IsString()
    receiptUrl?: string;
}
