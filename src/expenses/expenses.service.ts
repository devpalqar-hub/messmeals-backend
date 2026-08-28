import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExpenseStatus, Prisma, Role } from '@prisma/client';
import { endOfDay, startOfDay } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';
import { paginate } from 'src/common/utility/pagination.util';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { PayExpenseDto } from './dto/pay-expense.dto';
import { ExpenseAnalyticsQueryDto } from './dto/expense-analytics-query.dto';

type AuthUser = { id: string; role: Role | string };

@Injectable()
export class ExpensesService {
    constructor(private readonly prisma: PrismaService) { }

    private async getCategoryOrThrow(categoryId: string, messId: string) {
        const category = await this.prisma.expenseCategory.findUnique({ where: { id: categoryId } });
        if (!category || category.messId !== messId) {
            throw new BadRequestException('Expense category does not belong to this mess');
        }
        return category;
    }

    /** paidAmount can never be negative or exceed the total amount owed. */
    private assertPaidAmount(amount: number, paidAmount: number) {
        if (paidAmount < 0) {
            throw new BadRequestException('paidAmount cannot be negative');
        }
        if (paidAmount > amount) {
            throw new BadRequestException('paidAmount cannot exceed amount');
        }
    }

    /**
     * The single source of truth for an expense's payment status: calculated from amount vs
     * paidAmount, never set directly. amount <= 0 means the expense hasn't been finalized yet (PENDING).
     */
    private deriveStatus(amount: number, paidAmount: number): ExpenseStatus {
        if (amount <= 0) return ExpenseStatus.PENDING;
        if (paidAmount <= 0) return ExpenseStatus.UNPAID;
        if (paidAmount < amount) return ExpenseStatus.PARTIALLY_PAID;
        return ExpenseStatus.PAID;
    }

    /** Adds the amount/paidAmount-derived convenience fields every expense response should carry. */
    private decorate<T extends { amount: any; paidAmount: any; status: ExpenseStatus }>(expense: T) {
        const amount = Number(expense.amount);
        const paidAmount = Number(expense.paidAmount);
        return {
            ...expense,
            balanceDue: Math.max(amount - paidAmount, 0),
            isFullyPaid: expense.status === ExpenseStatus.PAID,
        };
    }

    /** Status breakdown (paid/partially paid/unpaid/pending totals) for the given base filters, ignoring any status filter itself. */
    private async getStatusSummary(where: Prisma.ExpenseWhereInput) {
        const grouped = await this.prisma.expense.groupBy({
            by: ['status'],
            where,
            _sum: { amount: true, paidAmount: true },
            _count: { id: true },
        });

        const byStatus: Record<ExpenseStatus, { amount: number; paidAmount: number; count: number }> = {
            PAID: { amount: 0, paidAmount: 0, count: 0 },
            PARTIALLY_PAID: { amount: 0, paidAmount: 0, count: 0 },
            UNPAID: { amount: 0, paidAmount: 0, count: 0 },
            PENDING: { amount: 0, paidAmount: 0, count: 0 },
        };

        let totalAmount = 0;
        let totalCount = 0;
        for (const g of grouped) {
            const amount = Number(g._sum.amount || 0);
            const paidAmount = Number(g._sum.paidAmount || 0);
            const count = g._count.id;
            byStatus[g.status] = { amount, paidAmount, count };
            totalAmount += amount;
            totalCount += count;
        }

        return {
            total: { amount: totalAmount, count: totalCount },
            paid: byStatus.PAID,
            partiallyPaid: byStatus.PARTIALLY_PAID,
            unpaid: byStatus.UNPAID,
            pending: byStatus.PENDING,
        };
    }

    async create(user: AuthUser, dto: CreateExpenseDto) {
        await assertMessAccess(this.prisma, user, dto.messId);
        await this.getCategoryOrThrow(dto.categoryId, dto.messId);

        const isPending = dto.status === ExpenseStatus.PENDING;
        if (!isPending && (dto.amount === undefined || dto.amount === null || dto.amount <= 0)) {
            throw new BadRequestException('amount is required and must be greater than 0 unless status is PENDING');
        }

        const amount = isPending ? (dto.amount ?? 0) : dto.amount!;
        const paidAmount = isPending ? 0 : (dto.paidAmount ?? 0);
        if (!isPending) {
            this.assertPaidAmount(amount, paidAmount);
        }
        const status = isPending ? ExpenseStatus.PENDING : this.deriveStatus(amount, paidAmount);

        const expense = await this.prisma.expense.create({
            data: {
                messId: dto.messId,
                categoryId: dto.categoryId,
                title: dto.title,
                amount,
                paidAmount,
                description: dto.description,
                expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
                paymentMethod: dto.paymentMethod,
                receiptUrl: dto.receiptUrl,
                status,
                paidAt: status === ExpenseStatus.PAID ? new Date() : null,
                createdById: user.id,
            },
            include: { category: true },
        });

        return this.decorate(expense);
    }

    async findAll(
        user: AuthUser,
        messId: string,
        page?: number,
        limit?: number,
        search?: string,
        categoryId?: string,
        date1?: string,
        date2?: string,
        status?: ExpenseStatus,
    ) {
        await assertMessAccess(this.prisma, user, messId);

        const baseWhere: Prisma.ExpenseWhereInput = {
            messId,
            ...(categoryId && { categoryId }),
            ...(search && { title: { contains: search } }),
            ...(date1 && {
                expenseDate: {
                    gte: startOfDay(new Date(date1)),
                    lte: endOfDay(new Date(date2 || date1)),
                },
            }),
        };

        const [result, summary] = await Promise.all([
            paginate({
                prismaModel: this.prisma.expense,
                page,
                limit,
                where: { ...baseWhere, ...(status && { status }) },
                include: { category: true },
                orderBy: { expenseDate: 'desc' },
            }),
            // summary intentionally ignores the status filter so paid/partially-paid/unpaid/pending tab totals stay stable
            this.getStatusSummary(baseWhere),
        ]);

        return {
            ...result,
            data: (result.data as any[]).map((e) => this.decorate(e)),
            summary,
        };
    }

    async findOne(user: AuthUser, id: string) {
        const expense = await this.prisma.expense.findUnique({
            where: { id },
            include: { category: true },
        });

        if (!expense) {
            throw new NotFoundException('Expense not found');
        }

        await assertMessAccess(this.prisma, user, expense.messId);

        return this.decorate(expense);
    }

    async update(user: AuthUser, id: string, dto: UpdateExpenseDto) {
        const expense = await this.findOne(user, id); // existence + access check

        if (dto.categoryId) {
            await this.getCategoryOrThrow(dto.categoryId, expense.messId);
        }

        const nextAmount = dto.amount !== undefined ? dto.amount : Number(expense.amount);
        const nextPaidAmount = dto.paidAmount !== undefined ? dto.paidAmount : Number(expense.paidAmount);

        if (nextAmount > 0) {
            this.assertPaidAmount(nextAmount, nextPaidAmount);
        }
        const nextStatus = this.deriveStatus(nextAmount, nextPaidAmount);

        const paidAt =
            nextStatus === ExpenseStatus.PAID
                ? (expense.status === ExpenseStatus.PAID ? expense.paidAt : new Date())
                : null;

        const updated = await this.prisma.expense.update({
            where: { id },
            data: {
                ...(dto.categoryId && { categoryId: dto.categoryId }),
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.amount !== undefined && { amount: dto.amount }),
                ...(dto.paidAmount !== undefined && { paidAmount: dto.paidAmount }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.expenseDate !== undefined && { expenseDate: new Date(dto.expenseDate) }),
                ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
                ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
                status: nextStatus,
                paidAt,
            },
            include: { category: true },
        });

        return this.decorate(updated);
    }

    /**
     * Dedicated "settle payment" action: completes a PENDING placeholder (supplying the amount if it
     * was left out) or records a payment against an already-finalized expense. paidAmount is the
     * cumulative total paid to date (not an instalment), so the call is safe to retry. Status
     * (UNPAID/PARTIALLY_PAID/PAID) is always calculated from amount vs paidAmount here too.
     */
    async payExpense(user: AuthUser, id: string, dto: PayExpenseDto) {
        const expense = await this.findOne(user, id); // existence + access check

        const nextAmount = dto.amount !== undefined ? dto.amount : Number(expense.amount);
        if (nextAmount <= 0) {
            throw new BadRequestException(
                'amount must be set (either already on the expense or passed here) before recording a payment',
            );
        }
        this.assertPaidAmount(nextAmount, dto.paidAmount);
        const status = this.deriveStatus(nextAmount, dto.paidAmount);

        const updated = await this.prisma.expense.update({
            where: { id },
            data: {
                amount: nextAmount,
                paidAmount: dto.paidAmount,
                ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
                ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
                status,
                paidAt: status === ExpenseStatus.PAID ? (dto.paidAt ? new Date(dto.paidAt) : new Date()) : null,
            },
            include: { category: true },
        });

        return this.decorate(updated);
    }

    async remove(user: AuthUser, id: string) {
        await this.findOne(user, id); // existence + access check

        await this.prisma.expense.delete({ where: { id } });

        return { message: 'Expense deleted successfully' };
    }

    // ─── Analytics ──────────────────────────────────────────────────────────

    async analyticsSummary(user: AuthUser, query: ExpenseAnalyticsQueryDto) {
        await assertMessAccess(this.prisma, user, query.messId);

        const from = startOfDay(new Date(query.date1));
        const to = endOfDay(new Date(query.date2 || query.date1));

        const where: Prisma.ExpenseWhereInput = {
            messId: query.messId,
            expenseDate: { gte: from, lte: to },
            ...(query.categoryId && { categoryId: query.categoryId }),
            ...(query.status && { status: query.status }),
        };

        const agg = await this.prisma.expense.aggregate({
            where,
            _sum: { amount: true, paidAmount: true },
            _count: { id: true },
        });

        const totalExpense = Number(agg._sum.amount || 0);
        const totalPaid = Number(agg._sum.paidAmount || 0);

        return {
            totalExpense,
            totalPaid,
            totalOutstanding: Math.max(totalExpense - totalPaid, 0),
            totalCount: agg._count.id || 0,
        };
    }

    async analyticsByCategory(user: AuthUser, query: ExpenseAnalyticsQueryDto) {
        await assertMessAccess(this.prisma, user, query.messId);

        const from = startOfDay(new Date(query.date1));
        const to = endOfDay(new Date(query.date2 || query.date1));

        const grouped = await this.prisma.expense.groupBy({
            by: ['categoryId'],
            where: {
                messId: query.messId,
                expenseDate: { gte: from, lte: to },
                ...(query.categoryId && { categoryId: query.categoryId }),
                ...(query.status && { status: query.status }),
            },
            _sum: { amount: true, paidAmount: true },
            _count: { id: true },
        });

        const categories = await this.prisma.expenseCategory.findMany({
            where: { id: { in: grouped.map((g) => g.categoryId) } },
            select: { id: true, name: true },
        });
        const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

        const breakdown = grouped
            .map((g) => ({
                categoryId: g.categoryId,
                categoryName: categoryMap.get(g.categoryId) || 'Unknown',
                totalExpense: Number(g._sum.amount || 0),
                totalPaid: Number(g._sum.paidAmount || 0),
                count: g._count.id,
            }))
            .sort((a, b) => b.totalExpense - a.totalExpense);

        return { breakdown };
    }

    async analyticsGraph(user: AuthUser, query: ExpenseAnalyticsQueryDto) {
        await assertMessAccess(this.prisma, user, query.messId);

        const from = startOfDay(new Date(query.date1));
        const to = endOfDay(new Date(query.date2 || query.date1));

        const expenses = await this.prisma.expense.findMany({
            where: {
                messId: query.messId,
                expenseDate: { gte: from, lte: to },
                ...(query.categoryId && { categoryId: query.categoryId }),
                ...(query.status && { status: query.status }),
            },
            select: { amount: true, expenseDate: true },
            orderBy: { expenseDate: 'asc' },
        });

        const buckets: Record<string, number> = {};
        const cur = new Date(from);
        while (cur <= to) {
            const key = cur.toISOString().slice(0, 10);
            buckets[key] = 0;
            cur.setDate(cur.getDate() + 1);
        }

        for (const e of expenses) {
            const k = new Date(e.expenseDate).toISOString().slice(0, 10);
            buckets[k] = (buckets[k] || 0) + Number(e.amount || 0);
        }

        const series = Object.keys(buckets).map((d) => ({ date: d, expense: buckets[d] }));
        return { series };
    }
}
