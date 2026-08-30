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
        console.log('[RAZORPAY DEBUG] webhook received', {
            event: payload?.event,
            hasSignatureHeader: !!req.headers['x-razorpay-signature'],
            hasRawBody: !!req.rawBody,
            rawBodyLength: req.rawBody?.length ?? 0,
        });

        try {
            // Get signature from headers
            const signature = req.headers['x-razorpay-signature'] as string;

            if (!signature) {
                console.error('[RAZORPAY DEBUG] webhook rejected: missing x-razorpay-signature header');
                throw new UnauthorizedException('Missing webhook signature');
            }

            // Verify webhook signature
            const rawBody = (req.rawBody || Buffer.from('')).toString('utf8');
            if (!req.rawBody) {
                // If body-parser's `verify` hook (see main.ts) didn't run for this route,
                // rawBody is empty and the HMAC below will never match a real signature.
                console.error('[RAZORPAY DEBUG] webhook: req.rawBody is missing — signature verification will fail');
            }
            const isValidSignature = this.paymentsService.verifyWebhookSignature(
                rawBody,
                signature,
            );

            if (!isValidSignature) {
                console.error('[RAZORPAY DEBUG] webhook rejected: invalid signature', { event: payload?.event });
                throw new UnauthorizedException('Invalid webhook signature');
            }

            // Handle different event types
            const { event, payload: eventPayload } = payload;
            console.log('[RAZORPAY DEBUG] webhook signature verified, processing event:', event, JSON.stringify(eventPayload));

            switch (event) {
                // Payment orders are now created as Razorpay Payment Links, so the id we store
                // (Payments.razorpayOrderId) is the payment_link id, not the auto-generated order
                // id — correlate on the payment_link.* events below.
                case 'payment_link.paid': {
                    const linkId = eventPayload.payment_link?.entity?.id;
                    const paymentId = eventPayload.payment?.entity?.id;

                    if (!linkId || !paymentId) {
                        throw new Error('Missing payment link or payment ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentSuccess(linkId, paymentId);
                }

                case 'payment_link.cancelled':
                case 'payment_link.expired': {
                    const linkId = eventPayload.payment_link?.entity?.id;

                    if (!linkId) {
                        throw new Error('Missing payment link ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentFailure(
                        linkId,
                        event === 'payment_link.expired' ? 'Payment link expired' : 'Payment link cancelled',
                    );
                }

                // Kept for backward compatibility with older direct-order integrations
                // (create-order endpoint / any account config that still sends these).
                case 'order.paid':
                case 'payment.authorized':
                case 'payment.captured': {
                    const orderId = eventPayload.payment?.entity?.order_id;
                    const paymentId = eventPayload.payment?.entity?.id;

                    if (!orderId || !paymentId) {
                        throw new Error('Missing order or payment ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentSuccess(orderId, paymentId);
                }

                case 'payment.failed':
                case 'order.paid.failed': {
                    const failedOrderId = eventPayload.payment?.entity?.order_id || eventPayload.order?.entity?.id;
                    const failureReason = eventPayload.payment?.entity?.error_description;

                    if (!failedOrderId) {
                        throw new Error('Missing order ID in webhook');
                    }

                    return await this.paymentsService.handlePaymentFailure(
                        failedOrderId,
                        failureReason,
                    );
                }

                default:
                    // Log unhandled events but don't fail
                    console.log(`Unhandled webhook event: ${event}`, eventPayload);
                    return { success: true, message: 'Webhook received' };
            }
        } catch (error: any) {
            console.error('[RAZORPAY DEBUG] webhook processing error', {
                event: payload?.event,
                message: error?.message,
                stack: error?.stack,
            });
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
