import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTopupDto {
    @ApiProperty({
        description: 'Amount to top-up in smallest unit (e.g., paise)',
        example: 1000,
        minimum: 1
    })
    @Type(() => Number)
    @IsInt()
    @Min(1)
    amount: number;

    @ApiPropertyOptional({
        description: 'Source of payment (razorpay, card, etc.)',
        example: 'razorpay'
    })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({
        description: 'Additional metadata for the transaction',
        example: { orderId: "ORD123" }
    })
    @IsOptional()
    meta?: any;
}
