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

    async revenueSummary({ date1, date2, messId, ownerId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        const messIds = await this.resolveMessIds(messId, ownerId);

        const where: any = {
            status: 'SUCCESS',
            processedAt: { gte: from, lte: to },
        };

        if (messIds) {
            where.userSubscriptions = { messId: { in: messIds } };
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

    async revenueGraph({ date1, date2, messId, ownerId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        const messIds = await this.resolveMessIds(messId, ownerId);

        const where: any = {
            status: 'SUCCESS',
            processedAt: { gte: from, lte: to },
        };
        if (messIds) where.userSubscriptions = { messId: { in: messIds } };

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

    async orderStatsGraph({ date1, date2, messId, ownerId }: any) {
        if (!date1) throw new BadRequestException('date1 is required');
        const from = startOfDay(new Date(date1));
        const to = endOfDay(new Date(date2 || date1));

        const messIds = await this.resolveMessIds(messId, ownerId);

        const where: any = {
            date: { gte: from, lte: to },
        } as any;
        if (messIds) where.messId = { in: messIds };

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
}
