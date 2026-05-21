import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InvoiceStatus, Role } from '@prisma/client';

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

@Injectable()
export class BillingService {
    constructor(private readonly prisma: PrismaService) { }

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
        const config = await this.prisma.billingGlobalConfig.findFirst({
            orderBy: { createdAt: 'desc' },
        });
        if (config) return config;
        return this.prisma.billingGlobalConfig.create({ data: {} });
    }

    async updateGlobalConfig(dto: {
        defaultPerCustomerRate?: number;
        dueDaysBeforePeriodEnd?: number;
        graceDaysAfterDue?: number;
    }) {
        const config = await this.getOrCreateGlobalConfig();
        return this.prisma.billingGlobalConfig.update({
            where: { id: config.id },
            data: {
                ...(dto.defaultPerCustomerRate !== undefined && { defaultPerCustomerRate: dto.defaultPerCustomerRate }),
                ...(dto.dueDaysBeforePeriodEnd !== undefined && { dueDaysBeforePeriodEnd: dto.dueDaysBeforePeriodEnd }),
                ...(dto.graceDaysAfterDue !== undefined && { graceDaysAfterDue: dto.graceDaysAfterDue }),
            },
        });
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

    async listTiers() {
        return this.prisma.billingTier.findMany({
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

    async getOrGenerateInvoice(messId: string, month?: string) {
        const mess = await this.prisma.mess.findUnique({
            where: { id: messId },
            select: { id: true, name: true, is_active: true, billingDisabled: true },
        });
        if (!mess) throw new NotFoundException('Mess not found');

        const { start: periodStart, end: periodEnd } = monthToRange(month);

        // Enforce overdue rules for the current mess before returning invoice.
        await this.enforceBillingStatus(messId);

        const existing = await this.prisma.messInvoice.findFirst({
            where: { messId, periodStart, periodEnd },
        });
        if (existing) return existing;

        const globalConfig = await this.getOrCreateGlobalConfig();
        const messConfig = await this.prisma.messBillingConfig.findUnique({ where: { messId } });

        // Trial handling
        if (messConfig?.trialEndsAt && new Date() < messConfig.trialEndsAt) {
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

    async settleInvoice(messId: string, month: string) {
        const { start: periodStart, end: periodEnd } = monthToRange(month);
        const invoice = await this.prisma.messInvoice.findFirst({
            where: { messId, periodStart, periodEnd },
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
