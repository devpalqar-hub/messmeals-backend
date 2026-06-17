import {
    Controller,
    Post,
    Body,
    Get,
    Param,
    UseGuards,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { RazorpayWebhookDto } from './dto/razorpay-webhook.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Request } from 'express';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) { }

    /**
     * Create a payment order for subscription
     * POST /payments/create-order
     */
    @UseGuards(JwtAuthGuard)
    @Post('create-order')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create payment order', description: 'Creates a Razorpay order for subscription payment.' })
    @ApiResponse({ status: 201, description: 'Payment order created successfully.' })
    async createOrder(@Body() dto: CreatePaymentDto) {
        const { subscriptionId, amount, customerEmail, customerPhone, customerName } = dto;

        const result = await this.paymentsService.createPaymentOrder(
            subscriptionId,
            amount,
            customerEmail || '',
            customerPhone || '',
            customerName || '',
        );

        return result;
    }

    /**
     * Razorpay Webhook Handler
     * POST /payments/webhook
     * Webhook signature verification is crucial for security
     */
    @Post('webhook')
    @ApiOperation({ summary: 'Razorpay webhook', description: 'Receives and processes Razorpay webhooks.' })
    async handleWebhook(
        @Req() req: any,
        @Body() payload: RazorpayWebhookDto,
    ) {
        try {
            // Get signature from headers
            const signature = req.headers['x-razorpay-signature'] as string;

            if (!signature) {
                throw new UnauthorizedException('Missing webhook signature');
            }

            // Verify webhook signature
            const rawBody = (req.rawBody || Buffer.from('')).toString('utf8');
            const isValidSignature = this.paymentsService.verifyWebhookSignature(
                rawBody,
                signature,
            );

            if (!isValidSignature) {
                throw new UnauthorizedException('Invalid webhook signature');
            }

            // Handle different event types
            const { event, payload: eventPayload } = payload;

            switch (event) {
                case 'order.paid':
                case 'payment.authorized':
                    // Payment successful - activate subscription
                    const orderId = eventPayload.payment?.entity?.order_id;
                    const paymentId = eventPayload.payment?.entity?.id;

                    if (!orderId || !paymentId) {
                        throw new Error('Missing order or payment ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentSuccess(orderId, paymentId);

                case 'payment.failed':
                case 'order.paid.failed':
                    // Payment failed - delete subscription
                    const failedOrderId = eventPayload.payment?.entity?.order_id || eventPayload.order?.entity?.id;
                    const failureReason = eventPayload.payment?.entity?.error_description;

                    if (!failedOrderId) {
                        throw new Error('Missing order ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentFailure(
                        failedOrderId,
                        failureReason,
                    );

                case 'payment.captured':
                    // Payment captured (for authorized payments)
                    const capturedOrderId = eventPayload.payment?.entity?.order_id;
                    const capturedPaymentId = eventPayload.payment?.entity?.id;

                    if (!capturedOrderId || !capturedPaymentId) {
                        throw new Error('Missing order or payment ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentSuccess(
                        capturedOrderId,
                        capturedPaymentId,
                    );

                default:
                    // Log unhandled events but don't fail
                    console.log(`Unhandled webhook event: ${event}`, eventPayload);
                    return { success: true, message: 'Webhook received' };
            }
        } catch (error: any) {
            console.error('Webhook processing error:', error);
            // Return 200 OK to Razorpay even on error (to prevent retry)
            // Error details are logged for debugging
            return {
                success: false,
                message: error.message,
            };
        }
    }

    /**
     * Get payment details
     * GET /payments/:paymentId
     */
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get payment details', description: 'Returns payment details by payment UUID.' })
    @ApiParam({ name: 'paymentId', description: 'Payment UUID' })
    @Get(':paymentId')
    async getPaymentDetails(@Param('paymentId') paymentId: string) {
        return await this.paymentsService.getPaymentDetails(paymentId);
    }

    /**
     * Health check endpoint for Razorpay webhook
     * GET /payments/health
     */
    @Get('health/check')
    @ApiOperation({ summary: 'Payment health check', description: 'Returns a health response for payments service.' })
    healthCheck() {
        return {
            status: 'ok',
            message: 'Payment service is running',
        };
    }
}
