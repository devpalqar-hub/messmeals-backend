import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export class UpdateExpenseDto {
    @ApiPropertyOptional({ example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11', description: 'Expense category UUID' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;

    @ApiPropertyOptional({ example: 'Vegetable purchase for the week' })
    @IsOptional()
    @IsString()
    title?: string;

    @ApiPropertyOptional({ example: 1500 })
    @IsOptional()
    @IsNumber()
    @IsPositive()
    @Transform(({ value }) => (value === '' || value === undefined ? undefined : Number(value)))
    amount?: number;

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
