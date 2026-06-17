import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import crypto from 'crypto';

@Injectable()
export class PaymentsService {
    private razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    private razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a Razorpay order for subscription payment
     * Returns order details with session URL for checkout
     */
    async createPaymentOrder(
        subscriptionId: string,
        amount: number,
        customerEmail?: string,
        customerPhone?: string,
        customerName?: string,
        successUrl?: string,
        cancelUrl?: string,
    ) {
        try {
            // Validate subscription exists
            const subscription = await this.prisma.userSubscriptions.findUnique({
                where: { id: subscriptionId },
                include: {
                    plan: true,
                    CustomerProfile: {
                        include: {
                            user: true,
                        },
                    },
                },
            });

            if (!subscription) {
                throw new NotFoundException('Subscription not found');
            }

            // Create Razorpay order object
            // Note: In production, you would make actual API call to Razorpay
            // For testing purposes, we're simulating the response
            const orderId = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            const orderData = {
                amount: Math.round(amount * 100), // Convert to paise (smallest currency unit)
                currency: 'INR',
                receipt: `receipt_${subscriptionId}`,
                notes: {
                    subscriptionId,
                    planId: subscription.planId,
                    userId: subscription.CustomerProfile?.userId || null,
                    successUrl: successUrl || null,
                    cancelUrl: cancelUrl || null,
                },
            };

            // Store pending payment in database for webhook validation
            const pendingPayment = await this.prisma.payments.create({
                data: {
                    razorpayOrderId: orderId,
                    subscriptionId,
                    amount: amount,
                    status: 'PENDING',
                    customerEmail: customerEmail || '',
                    customerPhone: customerPhone || '',
                    customerName: customerName || '',
                    metadata: orderData,
                },
            });

            // Generate session URL for Razorpay Checkout
            // This would be used by frontend to redirect to Razorpay
            const sessionUrl = this.generateSessionUrl(orderId, amount, customerEmail || '', customerPhone || '');

            return {
                success: true,
                message: 'Payment order created successfully',
                data: {
                    orderId,
                    sessionUrl,
                    amount,
                    currency: 'INR',
                    paymentId: pendingPayment.id,
                    customerEmail,
                    customerPhone,
                    customerName,
                },
            };
        } catch (error) {
            throw new BadRequestException(
                `Failed to create payment order: ${error.message}`,
            );
        }
    }

    /**
     * Generate session URL for Razorpay Checkout
     * Frontend will redirect to this URL
     */
    private generateSessionUrl(
        orderId: string,
        amount: number,
        email: string,
        phone: string,
    ): string {
        const baseUrl = process.env.RAZORPAY_CHECKOUT_URL || 'https://checkout.razorpay.com/v1/checkout.js';

        // Build checkout parameters
        const params: Record<string, string> = {
            key: this.razorpayKeyId || '',
            order_id: orderId,
            name: 'Supermeals',
            description: 'Meal Subscription',
            amount: Math.round(amount * 100).toString(),
            currency: 'INR',
            email: email || '',
            contact: phone || '',
        };

        const checkoutParams = new URLSearchParams(params);

        return `${baseUrl}?${checkoutParams.toString()}`;
    }

    /**
     * Verify webhook signature from Razorpay
     */
    verifyWebhookSignature(
        body: string,
        signature: string,
    ): boolean {
        try {
            const hash = crypto
                .createHmac('sha256', this.razorpayKeySecret || '')
                .update(body)
                .digest('hex');
            return hash === signature;
        } catch (error) {
            return false;
        }
    }

    /**
     * Handle successful payment webhook
     * Create subscription only after payment is confirmed
     */
    async handlePaymentSuccess(
        razorpayOrderId: string,
        razorpayPaymentId: string,
    ) {
        try {
            // Find pending payment record
            const payment = await this.prisma.payments.findUnique({
                where: { razorpayOrderId },
            });

            if (!payment) {
                throw new NotFoundException('Payment record not found');
            }

            if (payment.status !== 'PENDING') {
                throw new BadRequestException('Payment already processed');
            }

            // Update subscription to active only after payment success
            const subscription = await this.prisma.userSubscriptions.update({
                where: { id: payment.subscriptionId },
                data: {
                    is_active: true,
                    createdAt: new Date(),
                },
                include: {
                    plan: true,
                    CustomerProfile: true,
                },
            });

            // Update payment status to SUCCESS
            await this.prisma.payments.update({
                where: { id: payment.id },
                data: {
                    status: 'SUCCESS',
                    razorpayPaymentId,
                    processedAt: new Date(),
                },
            });

            // Update wallet if discount was applied
            if (subscription.discount && Number(subscription.discount) > 0 && subscription.CustomerProfile) {
                await this.prisma.customerProfile.update({
                    where: { id: subscription.CustomerProfile.id },
                    data: {
                        walletAmount: {
                            decrement: Number(subscription.discountedPrice),
                        },
                    },
                });
            }

            return {
                success: true,
                message: 'Payment successful, subscription activated',
                data: subscription,
            };
        } catch (error) {
            throw new BadRequestException(
                `Failed to process payment success: ${error.message}`,
            );
        }
    }

    /**
     * Handle payment failure webhook
     * Delete the subscription if payment fails
     */
    async handlePaymentFailure(razorpayOrderId: string, reason?: string) {
        try {
            const payment = await this.prisma.payments.findUnique({
                where: { razorpayOrderId },
            });

            if (!payment) {
                throw new NotFoundException('Payment record not found');
            }

            // Update payment status to FAILED
            await this.prisma.payments.update({
                where: { id: payment.id },
                data: {
                    status: 'FAILED',
                    failureReason: reason || 'Payment declined',
                    processedAt: new Date(),
                },
            });

            // Delete the subscription that was created but not paid for
            await this.prisma.userSubscriptions.delete({
                where: { id: payment.subscriptionId },
            });

            return {
                success: true,
                message: 'Payment failed, subscription cancelled',
                orderId: razorpayOrderId,
            };
        } catch (error) {
            throw new BadRequestException(
                `Failed to process payment failure: ${error.message}`,
            );
        }
    }

    /**
     * Retrieve payment details
     */
    async getPaymentDetails(paymentId: string) {
        const payment = await this.prisma.payments.findUnique({
            where: { id: paymentId },
            include: {
                userSubscriptions: true,
            },
        });

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        return payment;
    }
}
