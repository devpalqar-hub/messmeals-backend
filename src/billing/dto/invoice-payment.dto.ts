import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

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
