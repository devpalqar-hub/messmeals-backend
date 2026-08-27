import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class ExpenseAnalyticsQueryDto {
    @ApiProperty({ example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11', description: 'Mess UUID' })
    @IsUUID()
    messId!: string;

    @ApiProperty({ example: '2026-08-01' })
    @IsDateString()
    date1!: string;

    @ApiPropertyOptional({ example: '2026-08-27', description: 'Defaults to date1 when omitted.' })
    @IsOptional()
    @IsDateString()
    date2?: string;

    @ApiPropertyOptional({ example: '8e6f4f4a-3bb7-4c74-9f42-5b3f7e5c7c11' })
    @IsOptional()
    @IsUUID()
    categoryId?: string;
}
