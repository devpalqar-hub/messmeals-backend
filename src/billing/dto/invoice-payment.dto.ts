import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class CreateInvoicePaymentOrderDto {
    @ApiPropertyOptional({
        example: '2026-05',
        description: 'Invoice month in YYYY-MM. Defaults to current month.',
    })
    @IsOptional()
    @IsString()
    @Matches(/^\d{4}-\d{2}$/)
    month?: string;
}

export class VerifyInvoicePaymentDto {
    @ApiProperty({ example: 'order_9A33XWu170gUtm', description: 'Razorpay order id.' })
    @IsString()
    razorpayOrderId!: string;

    @ApiProperty({ example: 'pay_29QQoUBi66xm2f', description: 'Razorpay payment id.' })
    @IsString()
    razorpayPaymentId!: string;

    @ApiProperty({ example: 'generated_signature', description: 'Razorpay signature.' })
    @IsString()
    razorpaySignature!: string;
}
