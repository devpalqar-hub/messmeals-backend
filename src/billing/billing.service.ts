import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InvoiceStatus, Role } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';

function monthToRange(month?: string) {
    const now = new Date();
    const [yearStr, monthStr] = (month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`).split('-');
    const year = Number(yearStr);
    const m = Number(monthStr);
    if (!year || !m || m < 1 || m > 12) {
        throw new BadRequestException('Invalid month. Expected YYYY-MM');
    }
    const start = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
    const end = new Date(Date.UTC(year, m, 1, 0, 0, 0));
    return { start, end };
}

function parseYearMonthToUtcDate(month: string) {
    const [yearStr, monthStr] = month.split('-');
    const year = Number(yearStr);
    const m = Number(monthStr);
    if (!year || !m || m < 1 || m > 12) {
        throw new BadRequestException('Invalid month. Expected YYYY-MM');
    }
    return new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
}

function addMonthsUtc(date: Date, months: number) {
    const y = date.getUTCFullYear();
    const m = date.getUTCMonth();
    const d = date.getUTCDate();

    const targetMonthIndex = m + months;
    const targetYear = y + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12;

    const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return new Date(Date.UTC(targetYear, targetMonth, day, 0, 0, 0));
}

@Injectable()
export class BillingService {
    constructor(private readonly prisma: PrismaService) { }

    private razorpayKeyId = process.env.RAZORPAY_KEY_ID;
    private razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    private isMissingTableError(error: any) {
        const code = error?.code;
        const message = String(error?.message ?? '');
        return code === 'P2021' || message.includes('does not exist') || message.includes('Unknown table');
    }

    async assertUserCanAccessMess(
        user: { id: string; role: Role },
        messId: string,
    ) {
        if (user.role === Role.SUPERADMIN) return;
        if (user.role !== Role.MESSADMIN) {
            throw new ForbiddenException('You do not have access to this mess');
        }

        const access = await this.prisma.messAdminProfile.findFirst({
            where: {
                userId: user.id,
                messes: { some: { id: messId } },
            },
            select: { id: true },
        });
        if (!access) {
            throw new ForbiddenException('You do not have access to this mess');
        }
    }

    async getOrCreateGlobalConfig() {
        try {
            const config = await this.prisma.billingGlobalConfig.findFirst({
                orderBy: { createdAt: 'desc' },
            });
            if (config) return config;
            return this.prisma.billingGlobalConfig.create({ data: {} });
        } catch (e) {
            if (this.isMissingTableError(e)) {
                // Billing tables not migrated yet; use safe defaults.
                return {
                    id: 'BILLING_GLOBAL_DEFAULT',
                    defaultPerCustomerRate: 4,
                    defaultTrialDays: 30,
                    dueDaysBeforePeriodEnd: 5,
                    graceDaysAfterDue: 5,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                } as any;
            }
            throw e;
        }
    }

    async updateGlobalConfig(dto: {
        defaultPerCustomerRate?: number;
        defaultTrialDays?: number;
        dueDaysBeforePeriodEnd?: number;
        graceDaysAfterDue?: number;
    }) {
        try {
            const config = await this.getOrCreateGlobalConfig();
            return this.prisma.billingGlobalConfig.update({
                where: { id: config.id },
                data: {
                    ...(dto.defaultPerCustomerRate !== undefined && { defaultPerCustomerRate: dto.defaultPerCustomerRate }),
                    ...(dto.defaultTrialDays !== undefined && { defaultTrialDays: dto.defaultTrialDays }),
                    ...(dto.dueDaysBeforePeriodEnd !== undefined && { dueDaysBeforePeriodEnd: dto.dueDaysBeforePeriodEnd }),
                    ...(dto.graceDaysAfterDue !== undefined && { graceDaysAfterDue: dto.graceDaysAfterDue }),
                },
            });
        } catch (e) {
            if (this.isMissingTableError(e)) {
                throw new BadRequestException('Billing tables are not migrated yet');
            }
            throw e;
        }
    }

    async getDefaultTrialEndsAt(now: Date = new Date()) {
        const globalConfig = await this.getOrCreateGlobalConfig();
        const days = Number(globalConfig.defaultTrialDays ?? 0);
        if (!days || days <= 0) return null;
        return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }

    async ensureMessBillingConfig(messId: string, now: Date = new Date()) {
        try {
            const existing = await this.prisma.messBillingConfig.findUnique({
                where: { messId },
                select: { id: true },
            });
            if (existing) return;

            const trialEndsAt = await this.getDefaultTrialEndsAt(now);
            await this.prisma.messBillingConfig.create({
                data: {
                    messId,
                    trialEndsAt,
                },
            });
        } catch (e) {
            if (this.isMissingTableError(e)) return;
            throw e;
        }
    }

    async upsertTier(id: string | undefined, dto: { minCustomers: number; maxCustomers?: number; perCustomerRate: number; isActive?: boolean; }) {
        if (dto.maxCustomers !== undefined && dto.maxCustomers < dto.minCustomers) {
            throw new BadRequestException('maxCustomers must be >= minCustomers');
        }

        if (!id) {
            return this.prisma.billingTier.create({
                data: {
                    minCustomers: dto.minCustomers,
                    maxCustomers: dto.maxCustomers,
                    perCustomerRate: dto.perCustomerRate,
                    isActive: dto.isActive ?? true,
                },
            });
        }

        return this.prisma.billingTier.update({
            where: { id },
            data: {
                minCustomers: dto.minCustomers,
                maxCustomers: dto.maxCustomers,
                perCustomerRate: dto.perCustomerRate,
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
        });
    }

    async listTiers(role?: Role) {
        const isPublicRole = role === Role.USER || role === Role.MESSADMIN;
        return this.prisma.billingTier.findMany({
            where: isPublicRole ? { isActive: true } : undefined,
            orderBy: [{ minCustomers: 'asc' }, { maxCustomers: 'asc' }],
        });
    }

    async updateMessConfig(messId: string, dto: { trialEndsAt?: string; perCustomerRateOverride?: number; }) {
        const mess = await this.prisma.mess.findUnique({ where: { id: messId }, select: { id: true } });
        if (!mess) throw new NotFoundException('Mess not found');

        return this.prisma.messBillingConfig.upsert({
            where: { messId },
            create: {
                messId,
                trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : undefined,
                perCustomerRateOverride: dto.perCustomerRateOverride,
            },
            update: {
                ...(dto.trialEndsAt !== undefined && { trialEndsAt: dto.trialEndsAt ? new Date(dto.trialEndsAt) : null }),
                ...(dto.perCustomerRateOverride !== undefined && { perCustomerRateOverride: dto.perCustomerRateOverride }),
            },
        });
    }

    private async resolveRate(messId: string, customerCount: number) {
        const globalConfig = await this.getOrCreateGlobalConfig();
        const [messConfig, tiers] = await this.prisma.$transaction([
            this.prisma.messBillingConfig.findUnique({ where: { messId } }),
            this.prisma.billingTier.findMany({ where: { isActive: true }, orderBy: { minCustomers: "asc" } }),
        ]);
        if (messConfig?.perCustomerRateOverride !== null && messConfig?.perCustomerRateOverride !== undefined) {
            return { rate: Number(messConfig.perCustomerRateOverride), source: 'OVERRIDE' as const, globalConfig, messConfig };
        }

        const matching = tiers.find((t) => {
            const max = t.maxCustomers ?? Number.POSITIVE_INFINITY;
            return customerCount >= t.minCustomers && customerCount <= max;
        });

        if (matching) {
            return { rate: Number(matching.perCustomerRate), source: 'TIER' as const, tierId: matching.id, globalConfig, messConfig };
        }

        return { rate: Number(globalConfig.defaultPerCustomerRate), source: 'DEFAULT' as const, globalConfig, messConfig };
    }

    private async computeCustomerCount(messId: string, periodStart: Date, periodEnd: Date) {
        // Count distinct customers who started a subscription in the month.
        // This is a pragmatic interpretation of "users in that month".
        const rows = await this.prisma.userSubscriptions.findMany({
            where: {
                messId,
                createdAt: {
                    gte: periodStart,
                    lt: periodEnd,
                },
            },
            select: {
                customerProfileId: true,
            },
        });
        const distinct = new Set(rows.map((r) => r.customerProfileId).filter(Boolean) as string[]);
        return distinct.size;
    }

    private async getPendingInvoice(messId: string) {
        return this.prisma.messInvoice.findFirst({
            where: {
                messId,
                status: InvoiceStatus.UNPAID,
            },
            orderBy: [
                { dueDate: 'asc' },
                { createdAt: 'asc' },
            ],
        });
    }

    private async resolveInvoicePeriodRange(messId: string, month?: string, now: Date = new Date()) {
        const referenceDate = month ? parseYearMonthToUtcDate(month) : now;

        // Anchor billing cycle to the first-ever customer subscription for this mess.
        // If no subscriptions exist yet, fall back to calendar-month periods.
        const firstSubscription = await this.prisma.userSubscriptions.findFirst({
            where: { messId },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
        });

        if (!firstSubscription?.createdAt) {
            const legacy = monthToRange(month);
            return { periodStart: legacy.start, periodEnd: legacy.end, referenceDate };
        }

        const anchor = firstSubscription.createdAt;
        let periodStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), anchor.getUTCDate(), 0, 0, 0));
        if (referenceDate < periodStart) {
            return { periodStart, periodEnd: addMonthsUtc(periodStart, 1), referenceDate };
        }

        while (addMonthsUtc(periodStart, 1) <= referenceDate) {
            periodStart = addMonthsUtc(periodStart, 1);
        }
        const periodEnd = addMonthsUtc(periodStart, 1);
        return { periodStart, periodEnd, referenceDate };
    }

    async getOrGenerateInvoice(messId: string, month?: string) {
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
            select: { id: true, name: true, is_active: true, billingDisabled: true },
        });
        if (!mess) throw new NotFoundException('Mess not found');

        const { periodStart, periodEnd, referenceDate } = await this.resolveInvoicePeriodRange(messId, month);

        // Enforce overdue rules for the current mess before returning invoice.
        await this.enforceBillingStatus(messId);

        const existingExact = await this.prisma.messInvoice.findFirst({
            where: { messId, periodStart, periodEnd },
        });
        if (existingExact) return existingExact;

        // Safety net: during transitions (or data fixes), prevent creating multiple invoices
        // that cover the same reference date.
        const existingCovering = await this.prisma.messInvoice.findFirst({
            where: {
                messId,
                periodStart: { lte: referenceDate },
                periodEnd: { gt: referenceDate },
            },
            orderBy: { periodStart: 'desc' },
        });
        if (existingCovering) return existingCovering;

        const globalConfig = await this.getOrCreateGlobalConfig();
        const messConfig = await this.prisma.messBillingConfig.findUnique({ where: { messId } });

        // Trial handling
        if (messConfig?.trialEndsAt && periodEnd <= messConfig.trialEndsAt) {
            return this.prisma.messInvoice.create({
                data: {
                    messId,
                    periodStart,
                    periodEnd,
                    dueDate: new Date(periodEnd.getTime() - globalConfig.dueDaysBeforePeriodEnd * 24 * 60 * 60 * 1000),
                    customerCount: 0,
                    rate: 0,
                    amount: 0,
                    status: InvoiceStatus.PAID,
                    paidAt: new Date(),
                },
            });
        }

        const customerCount = await this.computeCustomerCount(messId, periodStart, periodEnd);
        const { rate } = await this.resolveRate(messId, customerCount);
        const amount = customerCount * rate;

        const dueDate = new Date(periodEnd.getTime() - globalConfig.dueDaysBeforePeriodEnd * 24 * 60 * 60 * 1000);

        return this.prisma.messInvoice.create({
            data: {
                messId,
                periodStart,
                periodEnd,
                dueDate,
                customerCount,
                rate,
                amount,
                status: InvoiceStatus.UNPAID,
            },
        });
    }

    private async createRazorpayOrder(params: {
        amountInRupees: number;
        receipt: string;
        notes?: Record<string, any>;
    }) {
        const amount = Math.round(params.amountInRupees * 100);
        const payload = {
            amount,
            currency: 'INR',
            receipt: params.receipt,
            notes: params.notes ?? {},
        };

        if (!this.razorpayKeyId || !this.razorpayKeySecret) {
            // Fallback: simulated order id (keeps local/dev working)
            return {
                id: `order_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
                amount,
                currency: 'INR',
                created_at: Math.floor(Date.now() / 1000),
                _simulated: true,
            };
        }

        const auth = Buffer.from(`${this.razorpayKeyId}:${this.razorpayKeySecret}`).toString('base64');
        const res = await axios.post('https://api.razorpay.com/v1/orders', payload, {
            headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
            },
            timeout: 15000,
        });

        return res.data;
    }

    private verifyRazorpayPaymentSignature(orderId: string, paymentId: string, signature: string) {
        if (!this.razorpayKeySecret) {
            throw new BadRequestException('RAZORPAY_KEY_SECRET is not configured');
        }
        const expected = crypto
            .createHmac('sha256', this.razorpayKeySecret)
            .update(`${orderId}|${paymentId}`)
            .digest('hex');
        return expected === signature;
    }

    async createInvoicePaymentOrder(messId: string) {
        const pendingInvoice = await this.getPendingInvoice(messId);
        const invoice = pendingInvoice ?? await this.getOrGenerateInvoice(messId);
        if (invoice.status === InvoiceStatus.PAID) {
            return {
                message: 'Invoice already paid',
                invoice,
            };
        }

        const amountInRupees = Number(invoice.amount);
        if (!amountInRupees || amountInRupees <= 0) {
            // If amount is 0, treat it as paid
            const updated = await this.prisma.messInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: InvoiceStatus.PAID,
                    paidAt: new Date(),
                    paymentProcessedAt: new Date(),
                },
            });
            return { message: 'Invoice amount is 0. Marked as paid.', invoice: updated };
        }

        const order = await this.createRazorpayOrder({
            amountInRupees,
            receipt: `mess_invoice_${invoice.id}`,
            notes: {
                messId,
                invoiceId: invoice.id,
                periodStart: invoice.periodStart.toISOString(),
                periodEnd: invoice.periodEnd.toISOString(),
            },
        });

        const updatedInvoice = await this.prisma.messInvoice.update({
            where: { id: invoice.id },
            data: {
                razorpayOrderId: order.id,
                razorpayPaymentMeta: order,
            },
        });

        return {
            message: 'Payment order created',
            keyId: this.razorpayKeyId ?? null,
            order,
            invoice: updatedInvoice,
        };
    }

    async verifyAndSettleInvoicePayment(messId: string, dto: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string; }) {
        const invoice = await this.prisma.messInvoice.findFirst({
            where: {
                messId,
                razorpayOrderId: dto.razorpayOrderId,
            },
        });
        if (!invoice) {
            throw new NotFoundException('Invoice not found for this order id');
        }
        if (invoice.status === InvoiceStatus.PAID) {
            return { message: 'Invoice already paid', invoice };
        }

        // For simulated orders (created when Razorpay keys are not configured), skip real signature verification.
        const isSimulatedOrder =
            invoice.razorpayPaymentMeta &&
            typeof invoice.razorpayPaymentMeta === 'object' &&
            (invoice.razorpayPaymentMeta as any)._simulated === true;

        if (!isSimulatedOrder) {
            const ok = this.verifyRazorpayPaymentSignature(dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
            if (!ok) {
                throw new BadRequestException('Invalid Razorpay signature');
            }
        }

        const updated = await this.prisma.messInvoice.update({
            where: { id: invoice.id },
            data: {
                status: InvoiceStatus.PAID,
                paidAt: new Date(),
                razorpayPaymentId: dto.razorpayPaymentId,
                razorpaySignature: dto.razorpaySignature,
                paymentProcessedAt: new Date(),
            },
        });

        // Reactivate on successful settlement
        await this.prisma.mess.update({
            where: { id: messId },
            data: {
                billingDisabled: false,
                billingDisabledAt: null,
                billingReactivatesAt: null,
                is_active: true,
            },
        });

        const agents = await this.prisma.deliveryPartnerProfile.findMany({
            where: { messId },
            select: { userId: true },
        });
        if (agents.length) {
            await this.prisma.user.updateMany({
                where: { id: { in: agents.map((a) => a.userId) } },
                data: { is_active: true },
            });
        }

        return { message: 'Payment verified and invoice settled', invoice: updated };
    }

    async settleInvoice(messId: string, month: string) {
        const { periodStart, periodEnd, referenceDate } = await this.resolveInvoicePeriodRange(messId, month);
        const invoice = await this.prisma.messInvoice.findFirst({
            where: {
                messId,
                OR: [
                    { periodStart, periodEnd },
                    { periodStart: { lte: referenceDate }, periodEnd: { gt: referenceDate } },
                ],
            },
            orderBy: { periodStart: 'desc' },
        });
        if (!invoice) {
            throw new NotFoundException('Invoice not found. Generate it first.');
        }

        const updated = await this.prisma.messInvoice.update({
            where: { id: invoice.id },
            data: {
                status: InvoiceStatus.PAID,
                paidAt: new Date(),
            },
        });

        // Reactivate mess if it was billing-disabled
        await this.prisma.mess.update({
            where: { id: messId },
            data: {
                billingDisabled: false,
                billingDisabledAt: null,
                billingReactivatesAt: null,
                is_active: true,
            },
        });

        // Reactivate delivery agents under this mess
        const agents = await this.prisma.deliveryPartnerProfile.findMany({
            where: { messId },
            select: { userId: true },
        });
        if (agents.length) {
            await this.prisma.user.updateMany({
                where: { id: { in: agents.map((a) => a.userId) } },
                data: { is_active: true },
            });
        }

        return updated;
    }

    async enforceBillingStatus(messId: string) {
        try {
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
            select: { id: true, billingDisabled: true, billingReactivatesAt: true },
        });
        if (!mess) throw new NotFoundException('Mess not found');

        // If already disabled but not yet reactivatable, keep disabled
        if (mess.billingDisabled && mess.billingReactivatesAt && new Date() < mess.billingReactivatesAt) {
            return { billingDisabled: true };
        }

        const globalConfig = await this.getOrCreateGlobalConfig();
        const messConfig = await this.prisma.messBillingConfig.findUnique({ where: { messId } });
        if (messConfig?.trialEndsAt && new Date() < messConfig.trialEndsAt) {
            return { billingDisabled: false, trial: true };
        }

        // If the latest UNPAID invoice is past dueDate + graceDays => disable
        const unpaid = await this.prisma.messInvoice.findFirst({
            where: { messId, status: InvoiceStatus.UNPAID },
            orderBy: { dueDate: 'desc' },
        });

        if (!unpaid) {
            return { billingDisabled: false };
        }

        const disableAt = new Date(unpaid.dueDate.getTime() + globalConfig.graceDaysAfterDue * 24 * 60 * 60 * 1000);
        if (new Date() <= disableAt) {
            // still in grace
            return { billingDisabled: false, dueDate: unpaid.dueDate, disableAt };
        }

        const reactivatesAt = new Date(disableAt.getTime() + globalConfig.graceDaysAfterDue * 24 * 60 * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
            await tx.mess.update({
                where: { id: messId },
                data: {
                    billingDisabled: true,
                    billingDisabledAt: new Date(),
                    billingReactivatesAt: reactivatesAt,
                    is_active: false,
                },
            });

            // Disable delivery agents for that mess
            const agents = await tx.deliveryPartnerProfile.findMany({
                where: { messId },
                select: { userId: true },
            });
            if (agents.length) {
                await tx.user.updateMany({
                    where: { id: { in: agents.map((a) => a.userId) }, role: Role.DELIVERYAGENT },
                    data: { is_active: false },
                });
            }
        });

        return { billingDisabled: true, disabledAt: new Date(), reactivatesAt };
        } catch (e) {
            if (this.isMissingTableError(e)) {
                // If billing tables are missing, do not block operations.
                return { billingDisabled: false, billingEnabled: false };
            }
            throw e;
        }
    }

    async assertMessActiveForPortal(messId: string) {
        await this.enforceBillingStatus(messId);
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
            select: { billingDisabled: true },
        });
        if (mess?.billingDisabled) {
            throw new ForbiddenException('Mess is disabled due to pending billing');
        }
    }
}
