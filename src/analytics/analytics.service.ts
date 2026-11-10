import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { startOfDay, endOfDay } from 'date-fns';
import { TransactionsService } from 'src/transactions/transactions.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionsService: TransactionsService,
  ) {}

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

  /**
   * Helper to parse and resolve date range from query parameters.
   * Supports `startDate`/`endDate`, `fromDate`/`toDate`, and legacy `date1`/`date2`.
   * If required is true and dates are omitted, defaults to the last 30 days.
   */
  private resolveDateRange(
    query: {
      startDate?: string;
      endDate?: string;
      fromDate?: string;
      toDate?: string;
      date1?: string;
      date2?: string;
    },
    required = false,
  ): { from: Date; to: Date } | undefined {
    const startStr = query.startDate || query.fromDate || query.date1;
    const endStr = query.endDate || query.toDate || query.date2;

    if (!startStr && !endStr) {
      if (required) {
        const to = endOfDay(new Date());
        const from = startOfDay(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
        return { from, to };
      }
      return undefined;
    }

    const fromRaw = startStr ? new Date(startStr) : new Date(endStr!);
    const toRaw = endStr ? new Date(endStr) : new Date(startStr!);

    if (isNaN(fromRaw.getTime()) || isNaN(toRaw.getTime())) {
      throw new BadRequestException('Invalid date format provided');
    }

    const from = startOfDay(fromRaw);
    const to = endOfDay(toRaw);

    return from <= to
      ? { from, to }
      : { from: startOfDay(toRaw), to: endOfDay(fromRaw) };
  }

  /**
   * Ledger-based revenue/pending-payment totals — built on the customer↔mess billing
   * ledger (see TransactionsService), which (unlike revenueSummary's Payments-only
   * total) also captures wallet-settled registrations and daily-plan per-delivery
   * charges. totalRevenue = money actually received (sum of CREDIT entries);
   * pendingPayment = still owed by customers to this mess (sum(DEBIT) - sum(CREDIT),
   * floored at 0); advanceBalance = prepaid but not yet consumed by a completed
   * delivery's charge.
   */
  async ledgerSummary(query: {
    messId?: string;
    ownerId?: string;
    startDate?: string;
    endDate?: string;
    fromDate?: string;
    toDate?: string;
    date1?: string;
    date2?: string;
  }) {
    const { messId, ownerId } = query;
    const messIds = await this.resolveMessIds(messId, ownerId);
    if (!messIds) {
      throw new BadRequestException('messId or ownerId is required');
    }

    const dateRange = this.resolveDateRange(query, false);
    const totals = await this.transactionsService.getTotalsForMessIds(
      messIds,
      dateRange,
    );

    return {
      totalRevenue: totals.totalCredit,
      totalCharged: totals.totalDebit,
      pendingPayment: totals.balanceDue,
      advanceBalance: totals.advanceBalance,
      ...(dateRange
        ? {
            startDate: dateRange.from.toISOString(),
            endDate: dateRange.to.toISOString(),
          }
        : {}),
    };
  }

  async revenueSummary(query: any) {
    const dateRange = this.resolveDateRange(query, true)!;
    const { from, to } = dateRange;

    const messIds = await this.resolveMessIds(query.messId, query.ownerId);

    const where: any = {
      status: 'SUCCESS',
      processedAt: { gte: from, lte: to },
    };

    // Build userSubscriptions nested where if needed
    const userSubsWhere: any = {};
    if (messIds) userSubsWhere.messId = { in: messIds };
    if (query.variationId) {
      userSubsWhere.plan = { Variation: { some: { id: query.variationId } } };
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
      startDate: from.toISOString(),
      endDate: to.toISOString(),
    };
  }

  async revenueGraph(query: any) {
    const dateRange = this.resolveDateRange(query, true)!;
    const { from, to } = dateRange;

    const messIds = await this.resolveMessIds(query.messId, query.ownerId);

    const where: any = {
      status: 'SUCCESS',
      processedAt: { gte: from, lte: to },
    };

    const userSubsWhere: any = {};
    if (messIds) userSubsWhere.messId = { in: messIds };
    if (query.variationId)
      userSubsWhere.plan = { Variation: { some: { id: query.variationId } } };
    if (Object.keys(userSubsWhere).length)
      where.userSubscriptions = userSubsWhere;

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

    const series = Object.keys(buckets).map((d) => ({
      date: d,
      revenue: buckets[d],
    }));
    return {
      series,
      startDate: from.toISOString(),
      endDate: to.toISOString(),
    };
  }

  async orderStatsGraph(query: any) {
    const dateRange = this.resolveDateRange(query, true)!;
    const { from, to } = dateRange;

    const messIds = await this.resolveMessIds(query.messId, query.ownerId);

    const where: any = {
      date: { gte: from, lte: to },
    } as any;
    if (messIds) where.messId = { in: messIds };
    if (query.variationId) {
      where.plan = { Variation: { some: { id: query.variationId } } };
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

    const series = Object.keys(buckets).map((d) => ({
      date: d,
      orders: buckets[d],
    }));
    return {
      series,
      startDate: from.toISOString(),
      endDate: to.toISOString(),
    };
  }

  // Delivery agent specific deliveries per day (time-series)
  async deliveryAgentGraph(query: any) {
    const dateRange = this.resolveDateRange(query, true)!;
    const { from, to } = dateRange;
    const agentId = query.agentId;

    if (!agentId) throw new BadRequestException('agentId is required');

    // agentId may be deliveryPartnerProfile.id or a user.id; resolve to partnerId
    let partnerId = agentId;
    const maybePartner = await this.prisma.deliveryPartnerProfile.findUnique({
      where: { id: agentId },
    });
    if (!maybePartner) {
      // try resolve by userId
      const byUser = await this.prisma.deliveryPartnerProfile.findUnique({
        where: { userId: agentId },
      });
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

    const series = Object.keys(buckets).map((d) => ({
      date: d,
      deliveries: buckets[d],
    }));
    return {
      series,
      startDate: from.toISOString(),
      endDate: to.toISOString(),
    };
  }
}
