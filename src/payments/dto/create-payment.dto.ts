import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';

export class CreatePaymentDto {
    @ApiProperty({ example: '9b8c7d6e-1234-5678-90ab-cdef12345678' })
    @IsString()
    subscriptionId: string;

    @ApiProperty({ example: 999 })
    @IsNumber()
    amount: number;

    @ApiPropertyOptional({ example: 'Subscription renewal payment' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiPropertyOptional({ example: 'Jane Doe' })
    @IsString()
    @IsOptional()
    customerName?: string;

    @ApiPropertyOptional({ example: 'jane@example.com' })
    @IsString()
    @IsOptional()
    customerEmail?: string;

    @ApiPropertyOptional({ example: '+919876543220' })
    @IsString()
    @IsOptional()
    customerPhone?: string;
}
