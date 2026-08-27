import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { DeliveryStatus, ScheduleType } from '@prisma/client';
import axios from 'axios';
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

            // Create a real, payable Razorpay Payment Link (hosted checkout page).
            // successUrl is wired in as callback_url so Razorpay redirects the user back
            // there once payment completes; reference_id lets us correlate the webhook
            // even though the link id (not a raw order id) is what we store below.
            const paymentLink = await this.createRazorpayPaymentLink({
                amountInRupees: amount,
                referenceId: subscriptionId,
                customerName,
                customerEmail,
                customerPhone,
                description: purpose === 'EXTENSION' ? 'Meal Subscription Extension' : 'Meal Subscription',
                callbackUrl: successUrl,
                notes: {
                    subscriptionId,
                    planId: subscription.planId,
                    userId: subscription.CustomerProfile?.userId || null,
                    cancelUrl: cancelUrl || null,
                    purpose,
                    ...(extraMeta || {}),
                },
            });

            // Store pending payment in database for webhook validation
            const pendingPayment = await this.prisma.payments.create({
                data: {
                    razorpayOrderId: paymentLink.id,
                    subscriptionId,
                    amount: amount,
                    status: 'PENDING',
                    customerEmail: customerEmail || '',
                    customerPhone: customerPhone || '',
                    customerName: customerName || '',
                    metadata: paymentLink,
                },
            });

            return {
                success: true,
                message: 'Payment order created successfully',
                data: {
                    orderId: paymentLink.id,
                    // Real, directly-openable Razorpay hosted checkout URL (redirect/webview friendly).
                    paymentUrl: paymentLink.short_url,
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
     * Creates a Razorpay Payment Link via the real Payment Links API
     * (https://api.razorpay.com/v1/payment_links). Falls back to a simulated link when
     * RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET aren't configured, so local/dev keeps working.
     */
    private async createRazorpayPaymentLink(params: {
        amountInRupees: number;
        referenceId: string;
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string;
        description?: string;
        callbackUrl?: string;
        notes?: Record<string, any>;
    }) {
        const amount = Math.round(params.amountInRupees * 100); // paise

        if (!this.razorpayKeyId || !this.razorpayKeySecret) {
            // Fallback: simulated payment link (keeps local/dev working without live Razorpay keys)
            const id = `plink_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            return {
                id,
                short_url: `${process.env.RAZORPAY_CHECKOUT_URL || 'https://rzp.io/l'}/${id}`,
                amount,
                currency: 'INR',
                status: 'created',
                reference_id: params.referenceId,
                created_at: Math.floor(Date.now() / 1000),
                _simulated: true,
            };
        }

        const payload: Record<string, any> = {
            amount,
            currency: 'INR',
            accept_partial: false,
            reference_id: params.referenceId,
            description: params.description || 'Meal Subscription Payment',
            customer: {
                name: params.customerName || undefined,
                email: params.customerEmail || undefined,
                contact: params.customerPhone || undefined,
            },
            notify: { sms: false, email: false },
            notes: params.notes ?? {},
        };
        if (params.callbackUrl) {
            payload.callback_url = params.callbackUrl;
            payload.callback_method = 'get';
        }

        const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
        const res = await axios.post('https://api.razorpay.com/v1/payment_links', payload, {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        return res.data;
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
