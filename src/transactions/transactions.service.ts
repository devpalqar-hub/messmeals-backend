import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  LedgerEntryReason,
  LedgerEntryType,
  Prisma,
  Role,
} from '@prisma/client';

type LedgerTx = Prisma.TransactionClient;

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Outstanding balance (sum(DEBIT) - sum(CREDIT)) for a (customer, mess) pair,
   * computed from history — used as the base to derive `balanceAfter` on a new entry.
   */
  private async outstandingBalance(
    tx: LedgerTx,
    customerProfileId: string,
    messId: string,
  ): Promise<number> {
    const totals = await tx.customerMessTransaction.groupBy({
      by: ['type'],
      where: { customerProfileId, messId },
      _sum: { amount: true },
    });
    const debit = Number(
      totals.find((t) => t.type === LedgerEntryType.DEBIT)?._sum.amount ?? 0,
    );
    const credit = Number(
      totals.find((t) => t.type === LedgerEntryType.CREDIT)?._sum.amount ?? 0,
    );
    return debit - credit;
  }

  /**
   * Atomically appends one ledger entry and snapshots the resulting balance.
   * Amounts <= 0 are a no-op (nothing to record) rather than an error, so call
   * sites that compute a possibly-zero amount (e.g. a discount reducing a charge
   * to zero) don't need their own guard.
   */
  private async recordEntry(params: {
    customerProfileId: string;
    messId: string;
    type: LedgerEntryType;
    reason: LedgerEntryReason;
    amount: number;
    subscriptionId?: string | null;
    deliveryId?: string | null;
    note?: string;
    relatedTransactionId?: string | null;
  }) {
    if (!params.amount || params.amount <= 0) return null;

    return this.prisma.$transaction(async (tx) => {
      const currentBalance = await this.outstandingBalance(
        tx,
        params.customerProfileId,
        params.messId,
      );
      const signedDelta =
        params.type === LedgerEntryType.DEBIT
          ? params.amount
          : -params.amount;
      const balanceAfter = currentBalance + signedDelta;

      return tx.customerMessTransaction.create({
        data: {
          customerProfileId: params.customerProfileId,
          messId: params.messId,
          subscriptionId: params.subscriptionId ?? undefined,
          deliveryId: params.deliveryId ?? undefined,
          type: params.type,
          reason: params.reason,
          amount: params.amount,
          balanceAfter,
          note: params.note,
          relatedTransactionId: params.relatedTransactionId ?? undefined,
        },
      });
    });
  }

  /** Monthly plan: the full charge, recorded once at subscription creation/extension. */
  async chargeMonthlyPlan(params: {
    subscriptionId: string;
    customerProfileId: string;
    messId: string;
    amount: number;
    note?: string;
  }) {
    return this.recordEntry({
      customerProfileId: params.customerProfileId,
      messId: params.messId,
      subscriptionId: params.subscriptionId,
      type: LedgerEntryType.DEBIT,
      reason: LedgerEntryReason.MONTHLY_PLAN_CHARGE,
      amount: params.amount,
      note: params.note,
    });
  }

  /**
   * Daily plan: charges exactly one day, only once that delivery's variations have
   * all reached a terminal state and the delivery itself was marked COMPLETED.
   * Idempotent — safe to call more than once for the same delivery (the unique
   * (deliveryId, reason) constraint means a second call is simply skipped).
   */
  async chargeDailyDeliveryCompleted(params: {
    deliveryId: string;
    subscriptionId?: string | null;
    customerProfileId: string;
    messId: string;
    amount: number;
  }) {
    const existing = await this.prisma.customerMessTransaction.findUnique({
      where: {
        deliveryId_reason: {
          deliveryId: params.deliveryId,
          reason: LedgerEntryReason.DAILY_DELIVERY_CHARGE,
        },
      },
    });
    if (existing) return existing;

    return this.recordEntry({
      customerProfileId: params.customerProfileId,
      messId: params.messId,
      subscriptionId: params.subscriptionId,
      deliveryId: params.deliveryId,
      type: LedgerEntryType.DEBIT,
      reason: LedgerEntryReason.DAILY_DELIVERY_CHARGE,
      amount: params.amount,
    });
  }

  /** A payment received — gateway, wallet-settlement at registration, or manually recorded. */
  async recordPayment(params: {
    customerProfileId: string;
    messId: string;
    subscriptionId?: string | null;
    amount: number;
    note?: string;
  }) {
    return this.recordEntry({
      customerProfileId: params.customerProfileId,
      messId: params.messId,
      subscriptionId: params.subscriptionId,
      type: LedgerEntryType.CREDIT,
      reason: LedgerEntryReason.PAYMENT_RECEIVED,
      amount: params.amount,
      note: params.note,
    });
  }

  /**
   * Claws back a previously-recorded credit (e.g. a daily-plan delivery/day cancellation
   * refunded to the customer's wallet) — recorded as a DEBIT so the ledger balance
   * reflects the mess no longer holding that money.
   */
  async recordRefundAdjustment(params: {
    customerProfileId: string;
    messId: string;
    subscriptionId?: string | null;
    deliveryId?: string | null;
    amount: number;
    note?: string;
  }) {
    return this.recordEntry({
      customerProfileId: params.customerProfileId,
      messId: params.messId,
      subscriptionId: params.subscriptionId,
      deliveryId: params.deliveryId,
      type: LedgerEntryType.DEBIT,
      reason: LedgerEntryReason.REFUND_ADJUSTMENT,
      amount: params.amount,
      note: params.note,
    });
  }

  /**
   * Balance summary for one (customer, mess) pair — or, when customerProfileId is
   * omitted, aggregated across every customer of that mess (used by mess analytics).
   */
  async getBalance(
    query: { customerProfileId?: string; messId?: string },
    user: { id: string; role: Role; customerProfileId?: string; messIds?: string[] },
  ) {
    const where: any = {};

    if (user.role === Role.USER) {
      where.customerProfileId = user.customerProfileId ?? 'unauthorized';
      if (query.messId) where.messId = query.messId;
    } else if (user.role === Role.MESSADMIN) {
      where.messId =
        user.messIds && user.messIds.length > 0
          ? { in: user.messIds }
          : 'unauthorized';
      if (query.messId) {
        if (!user.messIds?.includes(query.messId)) {
          throw new BadRequestException('Mess not found for this admin');
        }
        where.messId = query.messId;
      }
      if (query.customerProfileId)
        where.customerProfileId = query.customerProfileId;
    } else {
      // SUPERADMIN
      if (query.messId) where.messId = query.messId;
      if (query.customerProfileId)
        where.customerProfileId = query.customerProfileId;
    }

    const totals = await this.prisma.customerMessTransaction.groupBy({
      by: ['type'],
      where,
      _sum: { amount: true },
    });
    const totalDebit = Number(
      totals.find((t) => t.type === LedgerEntryType.DEBIT)?._sum.amount ?? 0,
    );
    const totalCredit = Number(
      totals.find((t) => t.type === LedgerEntryType.CREDIT)?._sum.amount ?? 0,
    );
    const net = totalDebit - totalCredit;

    return {
      totalDebit,
      totalCredit,
      // Amount still owed by the customer(s) to the mess.
      balanceDue: Math.max(net, 0),
      // Amount prepaid/held in advance (e.g. a daily plan's upfront wallet settlement
      // not yet consumed by completed-delivery debits).
      advanceBalance: Math.max(-net, 0),
    };
  }

  /**
   * Ledger-based revenue/pending totals across one or more messes — used by mess
   * analytics (unscoped by requesting user, since the caller already resolved which
   * mess(es) the requester is allowed to see).
   */
  async getTotalsForMessIds(messIds: string[]) {
    if (!messIds.length) {
      return { totalDebit: 0, totalCredit: 0, balanceDue: 0, advanceBalance: 0 };
    }

    const totals = await this.prisma.customerMessTransaction.groupBy({
      by: ['type'],
      where: { messId: { in: messIds } },
      _sum: { amount: true },
    });
    const totalDebit = Number(
      totals.find((t) => t.type === LedgerEntryType.DEBIT)?._sum.amount ?? 0,
    );
    const totalCredit = Number(
      totals.find((t) => t.type === LedgerEntryType.CREDIT)?._sum.amount ?? 0,
    );
    const net = totalDebit - totalCredit;

    return {
      totalDebit,
      totalCredit,
      balanceDue: Math.max(net, 0),
      advanceBalance: Math.max(-net, 0),
    };
  }

  async findAll(
    query: {
      page?: number | string;
      limit?: number | string;
      customerProfileId?: string;
      messId?: string;
      subscriptionId?: string;
      type?: LedgerEntryType;
      reason?: LedgerEntryReason;
      fromDate?: string;
      toDate?: string;
    },
    user: {
      id: string;
      role: Role;
      customerProfileId?: string;
      messIds?: string[];
    },
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (user.role === Role.USER) {
      where.customerProfileId = user.customerProfileId ?? 'unauthorized';
    } else if (user.role === Role.MESSADMIN) {
      where.messId =
        user.messIds && user.messIds.length > 0
          ? { in: user.messIds }
          : 'unauthorized';
      if (query.messId) {
        if (!user.messIds?.includes(query.messId)) {
          throw new BadRequestException('Mess not found for this admin');
        }
        where.messId = query.messId;
      }
      if (query.customerProfileId)
        where.customerProfileId = query.customerProfileId;
    } else {
      // SUPERADMIN
      if (query.messId) where.messId = query.messId;
      if (query.customerProfileId)
        where.customerProfileId = query.customerProfileId;
    }

    if (query.subscriptionId) where.subscriptionId = query.subscriptionId;
    if (query.type) where.type = query.type;
    if (query.reason) where.reason = query.reason;

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
      if (query.toDate) {
        const to = new Date(query.toDate);
        to.setDate(to.getDate() + 1);
        where.createdAt.lt = to;
      }
    }

    const [data, totalCount] = await this.prisma.$transaction([
      this.prisma.customerMessTransaction.findMany({
        where,
        include: {
          mess: { select: { id: true, name: true } },
          customerProfile: {
            select: {
              id: true,
              user: { select: { id: true, name: true, phone: true } },
            },
          },
          delivery: { select: { id: true, date: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customerMessTransaction.count({ where }),
    ]);

    return {
      message: 'Transactions fetched successfully',
      page,
      limit,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      data,
    };
  }
}
