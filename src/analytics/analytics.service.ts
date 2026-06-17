import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfDay, endOfDay } from 'date-fns';

@Injectable()
export class AnalyticsService {
    constructor(private readonly prisma: PrismaService) { }

    private async resolveMessIds(messId?: string, ownerId?: string) {
        if (messId) return [messId];
        if (ownerId) {
            const profile = await this.prisma.messAdminProfile.findUnique({
                where: { userId: ownerId },
                include: { messes: { select: { id: true } } },
            });
            if (!profile) return [];
            return profile.messes.map((m) => m.id);
        }
        return undefined; // no filtering
    }

    async revenueSummary({ date1, date2, messId, ownerId, variationId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        const messIds = await this.resolveMessIds(messId, ownerId);

        const where: any = {
            status: 'SUCCESS',
            processedAt: { gte: from, lte: to },
        };

        // Build userSubscriptions nested where if needed
        const userSubsWhere: any = {};
        if (messIds) userSubsWhere.messId = { in: messIds };
        if (variationId) {
            userSubsWhere.plan = { Variation: { some: { id: variationId } } };
        }
        if (Object.keys(userSubsWhere).length) {
            where.userSubscriptions = userSubsWhere;
        }

        const agg = await this.prisma.payments.aggregate({
            where,
            _sum: { amount: true },
            _count: { id: true },
        });

        return {
            totalRevenue: Number(agg._sum.amount || 0),
            totalPayments: agg._count.id || 0,
        };
    }

    async revenueGraph({ date1, date2, messId, ownerId, variationId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        const messIds = await this.resolveMessIds(messId, ownerId);

        const where: any = {
            status: 'SUCCESS',
            processedAt: { gte: from, lte: to },
        };

        const userSubsWhere: any = {};
        if (messIds) userSubsWhere.messId = { in: messIds };
        if (variationId) userSubsWhere.plan = { Variation: { some: { id: variationId } } };
        if (Object.keys(userSubsWhere).length) where.userSubscriptions = userSubsWhere;

        const payments = await this.prisma.payments.findMany({
            where,
            select: { amount: true, processedAt: true },
            orderBy: { processedAt: 'asc' },
        });

        // build per-day buckets
        const buckets: Record<string, number> = {};
        const cur = new Date(from);
        while (cur <= to) {
            const key = cur.toISOString().slice(0, 10);
            buckets[key] = 0;
            cur.setDate(cur.getDate() + 1);
        }

        for (const p of payments) {
            if (!p.processedAt) continue; // guard against nullable processedAt
            const proc = new Date(p.processedAt);
            const k = proc.toISOString().slice(0, 10);
            buckets[k] = (buckets[k] || 0) + Number(p.amount || 0);
        }

        const series = Object.keys(buckets).map((d) => ({ date: d, revenue: buckets[d] }));
        return { series };
    }

    async orderStatsGraph({ date1, date2, messId, ownerId, variationId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        const messIds = await this.resolveMessIds(messId, ownerId);

        const where: any = {
            date: { gte: from, lte: to },
        } as any;
        if (messIds) where.messId = { in: messIds };
        if (variationId) {
            where.plan = { Variation: { some: { id: variationId } } };
        }

        const deliveries = await this.prisma.deliveries.findMany({
            where,
            select: { date: true, id: true },
            orderBy: { date: 'asc' },
        });

        const buckets: Record<string, number> = {};
        const cur = new Date(from);
        while (cur <= to) {
            const key = cur.toISOString().slice(0, 10);
            buckets[key] = 0;
            cur.setDate(cur.getDate() + 1);
        }

        for (const d of deliveries) {
            const k = new Date(d.date).toISOString().slice(0, 10);
            buckets[k] = (buckets[k] || 0) + 1;
        }

        const series = Object.keys(buckets).map((d) => ({ date: d, orders: buckets[d] }));
        return { series };
    }

    // Delivery agent specific deliveries per day (time-series)
    async deliveryAgentGraph({ date1, date2, agentId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        if (!agentId) throw new BadRequestException('agentId is required');

        // agentId may be deliveryPartnerProfile.id or a user.id; resolve to partnerId
        let partnerId = agentId;
        const maybePartner = await this.prisma.deliveryPartnerProfile.findUnique({ where: { id: agentId } });
        if (!maybePartner) {
            // try resolve by userId
            const byUser = await this.prisma.deliveryPartnerProfile.findUnique({ where: { userId: agentId } });
            if (!byUser) throw new BadRequestException('Delivery agent not found');
            partnerId = byUser.id;
        }

        const where: any = {
            date: { gte: from, lte: to },
            partnerId: partnerId,
        };

        const deliveries = await this.prisma.deliveries.findMany({
            where,
            select: { date: true, id: true, status: true },
            orderBy: { date: 'asc' },
        });

        const buckets: Record<string, number> = {};
        const cur = new Date(from);
        while (cur <= to) {
            const key = cur.toISOString().slice(0, 10);
            buckets[key] = 0;
            cur.setDate(cur.getDate() + 1);
        }

        for (const d of deliveries) {
            const k = new Date(d.date).toISOString().slice(0, 10);
            buckets[k] = (buckets[k] || 0) + 1;
        }

        const series = Object.keys(buckets).map((d) => ({ date: d, deliveries: buckets[d] }));
        return { series };
    }
}
