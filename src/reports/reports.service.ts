import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { LedgerEntryReason, LedgerEntryType, Role } from '@prisma/client';
import { endOfDay, startOfDay, subMilliseconds } from 'date-fns';
import * as ExcelJS from 'exceljs';
import { PrismaService } from 'src/prisma/prisma.service';
import { assertMessAccess } from 'src/common/utility/mess-access.util';

type Requester = { id: string; role: Role | string };
type Range = { from: Date; to: Date };

const n = (v: any) => Number(v ?? 0);
const round = (v: number) => Math.round(v * 100) / 100;
const pct = (cur: number, prev: number) =>
  prev === 0 ? (cur === 0 ? 0 : null) : round(((cur - prev) / Math.abs(prev)) * 100);

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
  ) {}

  private resolveRange(startDate?: string, endDate?: string): Range {
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format provided');
    }
    const a = { from: startOfDay(start), to: endOfDay(end) };
    return a.from <= a.to
      ? a
      : { from: startOfDay(end), to: endOfDay(start) };
  }

  /** Ledger + expense figures for one period (used for current and previous). */
  private async periodFigures(messId: string, r: Range) {
    const [ledger, expenses] = await Promise.all([
      this.prisma.customerMessTransaction.groupBy({
        by: ['type', 'reason'],
        where: {
          messId,
          deletedAt: null,
          createdAt: { gte: r.from, lte: r.to },
        },
        _sum: { amount: true },
      }),
      this.prisma.expense.aggregate({
        where: { messId, expenseDate: { gte: r.from, lte: r.to } },
        _sum: { amount: true, paidAmount: true },
      }),
    ]);
    const sum = (type: LedgerEntryType, reason?: LedgerEntryReason) =>
      ledger
        .filter((l) => l.type === type && (!reason || l.reason === reason))
        .reduce((s, l) => s + n(l._sum.amount), 0);

    const received = sum(LedgerEntryType.CREDIT);
    const refunds = sum(
      LedgerEntryType.DEBIT,
      LedgerEntryReason.REFUND_ADJUSTMENT,
    );
    const charged = sum(LedgerEntryType.DEBIT) - refunds;
    const expenseTotal = n(expenses._sum.amount);
    const expensePaid = n(expenses._sum.paidAmount);
    return {
      ledger,
      received,
      refunds,
      charged,
      netRevenue: received - refunds,
      expenseTotal,
      expensePaid,
    };
  }

  async buildReport(
    user: Requester,
    q: { messId: string; startDate?: string; endDate?: string },
  ) {
    await assertMessAccess(this.prisma, user, q.messId);
    const mess = await this.prisma.mess.findUnique({
      where: { id: q.messId },
      select: { id: true, name: true },
    });
    if (!mess) throw new NotFoundException('Mess not found');

    const range = this.resolveRange(q.startDate, q.endDate);
    const spanMs = range.to.getTime() - range.from.getTime();
    const prevTo = subMilliseconds(range.from, 1);
    const prevRange: Range = {
      from: new Date(prevTo.getTime() - spanMs),
      to: prevTo,
    };
    const messId = q.messId;
    const now = new Date();

    const [
      cur,
      prev,
      openingAgg,
      closingAgg,
      expenseRows,
      newSubs,
      activeSubs,
      deliveryGroups,
      customerBalances,
    ] = await Promise.all([
      this.periodFigures(messId, range),
      this.periodFigures(messId, prevRange),
      // Outstanding before the period start == dues "raised from previous".
      this.prisma.customerMessTransaction.groupBy({
        by: ['type'],
        where: { messId, deletedAt: null, createdAt: { lt: range.from } },
        _sum: { amount: true },
      }),
      this.prisma.customerMessTransaction.groupBy({
        by: ['type'],
        where: { messId, deletedAt: null, createdAt: { lte: range.to } },
        _sum: { amount: true },
      }),
      this.prisma.expense.findMany({
        where: { messId, expenseDate: { gte: range.from, lte: range.to } },
        include: { category: { select: { id: true, name: true } } },
        orderBy: { expenseDate: 'desc' },
      }),
      this.prisma.userSubscriptions.count({
        where: {
          messId,
          deletedAt: null,
          createdAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.userSubscriptions.count({
        where: {
          messId,
          deletedAt: null,
          is_active: true,
          OR: [{ end_date: null }, { end_date: { gte: now } }],
        },
      }),
      this.prisma.deliveries.groupBy({
        by: ['status'],
        where: {
          messId,
          deletedAt: null,
          date: { gte: range.from, lte: range.to },
        },
        _count: { _all: true },
      }),
      this.prisma.customerMessTransaction.groupBy({
        by: ['customerProfileId', 'type'],
        where: { messId, deletedAt: null, createdAt: { lte: range.to } },
        _sum: { amount: true },
      }),
    ]);

    const bal = (rows: typeof openingAgg) =>
      n(rows.find((r) => r.type === 'DEBIT')?._sum.amount) -
      n(rows.find((r) => r.type === 'CREDIT')?._sum.amount);
    const openingNet = bal(openingAgg);
    const closingNet = bal(closingAgg);

    // Expense by category
    const catMap = new Map<string, any>();
    for (const e of expenseRows) {
      const c =
        catMap.get(e.categoryId) ??
        {
          categoryId: e.categoryId,
          category: e.category.name,
          count: 0,
          totalAmount: 0,
          paidAmount: 0,
          dueAmount: 0,
          expenses: [] as any[],
        };
      c.count++;
      c.totalAmount += n(e.amount);
      c.paidAmount += n(e.paidAmount);
      c.expenses.push({
        id: e.id,
        title: e.title,
        date: e.expenseDate,
        amount: n(e.amount),
        paidAmount: n(e.paidAmount),
        status: e.status,
        paymentMethod: e.paymentMethod,
      });
      catMap.set(e.categoryId, c);
    }
    const categories = [...catMap.values()]
      .map((c) => ({
        ...c,
        totalAmount: round(c.totalAmount),
        paidAmount: round(c.paidAmount),
        dueAmount: round(c.totalAmount - c.paidAmount),
        percentOfExpense: cur.expenseTotal
          ? round((c.totalAmount / cur.expenseTotal) * 100)
          : 0,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Customer dues (top 10)
    const perCustomer = new Map<string, number>();
    for (const row of customerBalances) {
      const sign = row.type === 'DEBIT' ? 1 : -1;
      perCustomer.set(
        row.customerProfileId,
        (perCustomer.get(row.customerProfileId) ?? 0) + sign * n(row._sum.amount),
      );
    }
    const owing = [...perCustomer.entries()]
      .filter(([, v]) => v > 0.005)
      .sort((a, b) => b[1] - a[1]);
    const topIds = owing.slice(0, 10).map(([id]) => id);
    const profiles = topIds.length
      ? await this.prisma.customerProfile.findMany({
          where: { id: { in: topIds } },
          select: { id: true, user: { select: { name: true, phone: true } } },
        })
      : [];
    const pmap = new Map(profiles.map((p) => [p.id, p.user]));
    const topPendingCustomers = owing.slice(0, 10).map(([id, due]) => ({
      customerProfileId: id,
      name: pmap.get(id)?.name ?? null,
      phone: pmap.get(id)?.phone ?? null,
      pendingAmount: round(due),
    }));

    const deliveries = {
      total: deliveryGroups.reduce((s, g) => s + g._count._all, 0),
      byStatus: Object.fromEntries(
        deliveryGroups.map((g) => [g.status ?? 'UNKNOWN', g._count._all]),
      ),
    };

    const byReason = cur.ledger
      .filter((l) => l.type === 'CREDIT')
      .map((l) => ({ reason: l.reason, amount: round(n(l._sum.amount)) }));

    return {
      mess: { id: mess.id, name: mess.name },
      period: { startDate: range.from.toISOString(), endDate: range.to.toISOString() },
      generatedAt: now.toISOString(),
      revenue: {
        totalReceived: round(cur.received),
        refunds: round(cur.refunds),
        netRevenue: round(cur.netRevenue),
        totalCharged: round(cur.charged),
        receivedByReason: byReason,
      },
      pending: {
        /** Outstanding dues carried in from before the period start. */
        broughtForwardFromPrevious: round(Math.max(openingNet, 0)),
        raisedThisPeriod: round(cur.charged),
        receivedThisPeriod: round(cur.received),
        /** Total still to be collected as of period end. */
        totalPendingToReceive: round(Math.max(closingNet, 0)),
        advanceBalance: round(Math.max(-closingNet, 0)),
        customersWithPending: owing.length,
        topPendingCustomers,
      },
      expenses: {
        totalExpense: round(cur.expenseTotal),
        paidExpense: round(cur.expensePaid),
        unpaidExpense: round(cur.expenseTotal - cur.expensePaid),
        count: expenseRows.length,
        byCategory: categories,
      },
      profit: {
        /** Cash view: money received minus expenses actually paid. */
        cashProfit: round(cur.netRevenue - cur.expensePaid),
        /** Accrual view: billed minus total expense incurred. */
        netProfit: round(cur.charged - cur.expenseTotal),
      },
      comparisonWithPreviousPeriod: {
        previousPeriod: {
          startDate: prevRange.from.toISOString(),
          endDate: prevRange.to.toISOString(),
        },
        revenue: {
          current: round(cur.received),
          previous: round(prev.received),
          change: round(cur.received - prev.received),
          changePercent: pct(cur.received, prev.received),
        },
        expense: {
          current: round(cur.expenseTotal),
          previous: round(prev.expenseTotal),
          change: round(cur.expenseTotal - prev.expenseTotal),
          changePercent: pct(cur.expenseTotal, prev.expenseTotal),
        },
        profit: {
          current: round(cur.netRevenue - cur.expensePaid),
          previous: round(prev.netRevenue - prev.expensePaid),
          change: round(cur.netRevenue - cur.expensePaid - (prev.netRevenue - prev.expensePaid)),
        },
      },
      metrics: {
        newSubscriptions: newSubs,
        activeSubscriptions: activeSubs,
        deliveries,
        collectionRatePercent: cur.charged
          ? round((cur.received / cur.charged) * 100)
          : null,
        expenseToRevenuePercent: cur.netRevenue
          ? round((cur.expenseTotal / cur.netRevenue) * 100)
          : null,
      },
    };
  }

  async buildExcel(report: Awaited<ReturnType<ReportsService['buildReport']>>) {
    const wb = new ExcelJS.Workbook();
    const money = '#,##0.00';

    const s = wb.addWorksheet('Summary');
    s.columns = [{ width: 38 }, { width: 22 }];
    const rows: [string, any][] = [
      ['Mess', report.mess.name],
      ['Period', `${report.period.startDate.slice(0, 10)} to ${report.period.endDate.slice(0, 10)}`],
      ['', ''],
      ['Revenue received', report.revenue.totalReceived],
      ['Refunds', report.revenue.refunds],
      ['Net revenue', report.revenue.netRevenue],
      ['Total charged (billed)', report.revenue.totalCharged],
      ['', ''],
      ['Pending brought forward (previous)', report.pending.broughtForwardFromPrevious],
      ['Pending raised this period', report.pending.raisedThisPeriod],
      ['Total pending to receive', report.pending.totalPendingToReceive],
      ['Advance balance', report.pending.advanceBalance],
      ['Customers with pending', report.pending.customersWithPending],
      ['', ''],
      ['Total expense', report.expenses.totalExpense],
      ['Paid expense', report.expenses.paidExpense],
      ['Unpaid expense', report.expenses.unpaidExpense],
      ['', ''],
      ['Cash profit', report.profit.cashProfit],
      ['Net profit (accrual)', report.profit.netProfit],
      ['', ''],
      ['New subscriptions', report.metrics.newSubscriptions],
      ['Active subscriptions', report.metrics.activeSubscriptions],
      ['Total deliveries', report.metrics.deliveries.total],
      ['Collection rate %', report.metrics.collectionRatePercent ?? 'n/a'],
      ['Revenue change vs previous period %', report.comparisonWithPreviousPeriod.revenue.changePercent ?? 'n/a'],
      ['Expense change vs previous period %', report.comparisonWithPreviousPeriod.expense.changePercent ?? 'n/a'],
    ];
    rows.forEach(([k, v]) => {
      const row = s.addRow([k, v]);
      row.getCell(1).font = { bold: true };
      if (typeof v === 'number') row.getCell(2).numFmt = money;
    });

    const c = wb.addWorksheet('Expense by Category');
    c.addRow(['Category', 'Count', 'Total', 'Paid', 'Due', '% of expense']).font = { bold: true };
    report.expenses.byCategory.forEach((x) =>
      c.addRow([x.category, x.count, x.totalAmount, x.paidAmount, x.dueAmount, x.percentOfExpense]),
    );
    c.columns.forEach((col, i) => (col.width = i === 0 ? 28 : 14));

    const e = wb.addWorksheet('Expenses');
    e.addRow(['Date', 'Category', 'Title', 'Amount', 'Paid', 'Status', 'Method']).font = { bold: true };
    report.expenses.byCategory.forEach((cat) =>
      cat.expenses.forEach((x: any) =>
        e.addRow([new Date(x.date).toISOString().slice(0, 10), cat.category, x.title, x.amount, x.paidAmount, x.status, x.paymentMethod ?? '']),
      ),
    );
    e.columns.forEach((col, i) => (col.width = [12, 22, 30, 14, 14, 16, 16][i]));

    const p = wb.addWorksheet('Pending Customers');
    p.addRow(['Customer', 'Phone', 'Pending']).font = { bold: true };
    report.pending.topPendingCustomers.forEach((x) =>
      p.addRow([x.name ?? '', x.phone ?? '', x.pendingAmount]),
    );
    p.columns.forEach((col) => (col.width = 22));

    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  private esc(v: any) {
    return String(v ?? '').replace(/[&<>"']/g, (ch) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!,
    );
  }

  private buildHtml(r: Awaited<ReturnType<ReportsService['buildReport']>>) {
    const f = (v: number) => v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const row = (k: string, v: string) =>
      `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee">${this.esc(k)}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right"><b>${this.esc(v)}</b></td></tr>`;
    const cats = r.expenses.byCategory
      .map((c) => row(`${c.category} (${c.count})`, f(c.totalAmount)))
      .join('');
    return `<div style="font-family:Arial,sans-serif;max-width:560px">
<h2>${this.esc(r.mess.name)} — Report</h2>
<p>${r.period.startDate.slice(0, 10)} to ${r.period.endDate.slice(0, 10)}</p>
<table style="width:100%;border-collapse:collapse">
${row('Revenue received', f(r.revenue.totalReceived))}
${row('Pending brought forward', f(r.pending.broughtForwardFromPrevious))}
${row('Total pending to receive', f(r.pending.totalPendingToReceive))}
${row('Total expense', f(r.expenses.totalExpense))}
${row('Cash profit', f(r.profit.cashProfit))}
${row('Active subscriptions', String(r.metrics.activeSubscriptions))}
</table>
<h3>Expenses by category</h3>
<table style="width:100%;border-collapse:collapse">${cats || row('No expenses', '-')}</table>
<p style="color:#888;font-size:12px">Full details are in the attached Excel file.</p></div>`;
  }

  async export(
    user: Requester,
    dto: { messId: string; startDate?: string; endDate?: string; email?: string[] },
  ) {
    const report = await this.buildReport(user, dto);
    const buffer = await this.buildExcel(report);
    const filename = `mess-report-${report.period.startDate.slice(0, 10)}_${report.period.endDate.slice(0, 10)}.xlsx`;

    if (dto.email?.length) {
      await this.mailer.sendMail({
        to: dto.email,
        subject: `${report.mess.name} report (${report.period.startDate.slice(0, 10)} – ${report.period.endDate.slice(0, 10)})`,
        html: this.buildHtml(report),
        attachments: [
          {
            filename,
            content: buffer,
            contentType:
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        ],
      });
      return { emailed: true as const, to: dto.email, filename };
    }
    return { emailed: false as const, buffer, filename };
  }
}
