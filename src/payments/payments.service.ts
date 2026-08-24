import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeliveryStatus, ScheduleType } from '@prisma/client';
import crypto from 'crypto';

/** Distinguishes a fresh plan booking from a paid extension of an existing one. */
export type PaymentPurpose = 'NEW_BOOKING' | 'EXTENSION';

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
        purpose: PaymentPurpose = 'NEW_BOOKING',
        extraMeta?: Record<string, any>,
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
                    purpose,
                    ...(extraMeta || {}),
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
     * - NEW_BOOKING: activates the subscription and generates its deliveries
     *   (nothing is created until payment succeeds).
     * - EXTENSION: pushes end_date to the paid-for date and generates the
     *   extra deliveries for the newly covered range.
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

            const notes = (payment.metadata as any)?.notes || {};
            const purpose: PaymentPurpose = notes.purpose === 'EXTENSION' ? 'EXTENSION' : 'NEW_BOOKING';

            let subscription = await this.prisma.userSubscriptions.findUnique({
                where: { id: payment.subscriptionId },
                include: { plan: true, CustomerProfile: true },
            });
            if (!subscription) {
                throw new NotFoundException('Subscription not found for this payment');
            }

            if (purpose === 'EXTENSION') {
                const newEndDate = notes.newEndDate ? new Date(notes.newEndDate) : null;
                if (!newEndDate || isNaN(newEndDate.getTime())) {
                    throw new BadRequestException('Missing/invalid newEndDate on extension payment');
                }

                const rangeStart = new Date(subscription.end_date as Date);
                rangeStart.setDate(rangeStart.getDate() + 1);

                subscription = await this.prisma.userSubscriptions.update({
                    where: { id: subscription.id },
                    data: { end_date: newEndDate, is_active: true, cancelled_on: null },
                    include: { plan: true, CustomerProfile: true },
                });

                await this.generateDeliveriesForRange(subscription, rangeStart, newEndDate);
            } else {
                subscription = await this.prisma.userSubscriptions.update({
                    where: { id: subscription.id },
                    data: { is_active: true },
                    include: { plan: true, CustomerProfile: true },
                });

                // Generate deliveries only if this booking has none yet
                // (webhooks can safely be retried without duplicating them).
                const existingDeliveries = await this.prisma.deliveries.count({
                    where: { subscriptionId: subscription.id },
                });
                if (existingDeliveries === 0) {
                    await this.generateDeliveriesForRange(
                        subscription,
                        subscription.start_date,
                        subscription.end_date as Date,
                    );
                }
            }

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
                message:
                    purpose === 'EXTENSION'
                        ? 'Payment successful, subscription extended'
                        : 'Payment successful, subscription activated',
                data: subscription,
            };
        } catch (error) {
            throw new BadRequestException(
                `Failed to process payment success: ${error.message}`,
            );
        }
    }

    /**
     * Handle payment failure webhook.
     * - NEW_BOOKING: the subscription was never active, so it is deleted
     *   (nothing was ever delivered/charged for it).
     * - EXTENSION: the subscription already existed and is running — it is
     *   left untouched, only the payment attempt is marked FAILED.
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

            const notes = (payment.metadata as any)?.notes || {};
            const purpose: PaymentPurpose = notes.purpose === 'EXTENSION' ? 'EXTENSION' : 'NEW_BOOKING';

            if (purpose === 'NEW_BOOKING') {
                // Delete the subscription that was created but not paid for.
                await this.prisma.userSubscriptions.deleteMany({
                    where: { id: payment.subscriptionId, is_active: false },
                });
            }

            return {
                success: true,
                message:
                    purpose === 'EXTENSION'
                        ? 'Payment failed, subscription extension was not applied'
                        : 'Payment failed, subscription cancelled',
                orderId: razorpayOrderId,
            };
        } catch (error) {
            throw new BadRequestException(
                `Failed to process payment failure: ${error.message}`,
            );
        }
    }

    /**
     * Creates PENDING deliveries (+ their plan variations) for every
     * chargeable day of [rangeStart, rangeEnd] according to the
     * subscription's scheduleType/selectedDays. Used both for the initial
     * booking (after payment success) and for paid extensions.
     */
    private async generateDeliveriesForRange(
        subscription: {
            id: string;
            planId: string;
            messId: string;
            customerProfileId: string | null;
            deliveryPartnerProfileId: string | null;
            scheduleType: ScheduleType;
            selectedDays: any;
        },
        rangeStart: Date,
        rangeEnd: Date,
    ) {
        if (!subscription.customerProfileId || rangeStart > rangeEnd) return;

        const weekdayMap = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
        const selectedDaysUpper =
            subscription.scheduleType === ScheduleType.CUSTOM
                ? ((subscription.selectedDays as string[]) ?? []).map((d) => d.toUpperCase())
                : [];

        const deliveriesToCreate: any[] = [];
        const currentDate = new Date(rangeStart);
        while (currentDate <= rangeEnd) {
            const shouldCreate =
                subscription.scheduleType === ScheduleType.EVERYDAY ||
                selectedDaysUpper.includes(weekdayMap[currentDate.getUTCDay()]);

            if (shouldCreate) {
                deliveriesToCreate.push({
                    date: new Date(currentDate),
                    customerId: subscription.customerProfileId,
                    planId: subscription.planId,
                    subscriptionId: subscription.id,
                    status: DeliveryStatus.PENDING,
                    partnerId: subscription.deliveryPartnerProfileId,
                    messId: subscription.messId,
                });
            }
            currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        }

        if (deliveriesToCreate.length === 0) return;

        await this.prisma.deliveries.createMany({ data: deliveriesToCreate });

        const plan = await this.prisma.plans.findUnique({
            where: { id: subscription.planId },
            select: { Variation: { where: { isActive: true }, select: { id: true } } },
        });
        const variationIds = plan?.Variation?.map((v) => v.id) ?? [];
        if (variationIds.length === 0) return;

        const createdDeliveries = await this.prisma.deliveries.findMany({
            where: { subscriptionId: subscription.id, date: { in: deliveriesToCreate.map((d) => d.date) } },
            select: { id: true },
        });

        await this.prisma.deliveryVariation.createMany({
            data: createdDeliveries.flatMap((d) =>
                variationIds.map((vid) => ({ deliveryId: d.id, variationId: vid, status: 'PENDING' as const })),
            ),
            skipDuplicates: true,
        });
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
