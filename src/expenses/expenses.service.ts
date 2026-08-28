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

    /** A PENDING entry is a placeholder that can be completed later; every other status needs a real amount. */
    private assertAmountForStatus(status: ExpenseStatus, amount: number | undefined | null) {
        if (status !== ExpenseStatus.PENDING && (amount === undefined || amount === null || Number(amount) <= 0)) {
            throw new BadRequestException('amount is required and must be greater than 0 unless status is PENDING');
        }
    }

    /** Status breakdown (paid/unpaid/pending totals) for the given base filters, ignoring any status filter itself. */
    private async getStatusSummary(where: Prisma.ExpenseWhereInput) {
        const grouped = await this.prisma.expense.groupBy({
            by: ['status'],
            where,
            _sum: { amount: true },
            _count: { id: true },
        });

        const byStatus: Record<ExpenseStatus, { amount: number; count: number }> = {
            PAID: { amount: 0, count: 0 },
            UNPAID: { amount: 0, count: 0 },
            PENDING: { amount: 0, count: 0 },
        };

        let totalAmount = 0;
        let totalCount = 0;
        for (const g of grouped) {
            const amount = Number(g._sum.amount || 0);
            const count = g._count.id;
            byStatus[g.status] = { amount, count };
            totalAmount += amount;
            totalCount += count;
        }

        return {
            total: { amount: totalAmount, count: totalCount },
            paid: byStatus.PAID,
            unpaid: byStatus.UNPAID,
            pending: byStatus.PENDING,
        };
    }

    async create(user: AuthUser, dto: CreateExpenseDto) {
        await assertMessAccess(this.prisma, user, dto.messId);
        await this.getCategoryOrThrow(dto.categoryId, dto.messId);

        const status = dto.status ?? ExpenseStatus.UNPAID;
        this.assertAmountForStatus(status, dto.amount);

        return this.prisma.expense.create({
            data: {
                messId: dto.messId,
                categoryId: dto.categoryId,
                title: dto.title,
                amount: dto.amount ?? 0,
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
            // summary intentionally ignores the status filter so paid/unpaid/pending tab totals stay stable
            this.getStatusSummary(baseWhere),
        ]);

        return { ...result, summary };
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

        return expense;
    }

    async update(user: AuthUser, id: string, dto: UpdateExpenseDto) {
        const expense = await this.findOne(user, id); // existence + access check

        if (dto.categoryId) {
            await this.getCategoryOrThrow(dto.categoryId, expense.messId);
        }

        const nextStatus = dto.status ?? expense.status;
        const nextAmount = dto.amount !== undefined ? dto.amount : Number(expense.amount);
        this.assertAmountForStatus(nextStatus, nextAmount);

        const paidAt =
            nextStatus === ExpenseStatus.PAID
                ? (!dto.status && expense.status === ExpenseStatus.PAID ? expense.paidAt : new Date())
                : null;

        return this.prisma.expense.update({
            where: { id },
            data: {
                ...(dto.categoryId && { categoryId: dto.categoryId }),
                ...(dto.title !== undefined && { title: dto.title }),
                ...(dto.amount !== undefined && { amount: dto.amount }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.expenseDate !== undefined && { expenseDate: new Date(dto.expenseDate) }),
                ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
                ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
                status: nextStatus,
                paidAt,
            },
            include: { category: true },
        });
    }

    /**
     * Dedicated "settle payment" action: completes a PENDING placeholder (supplying the amount if it
     * was left out) or flips an UNPAID expense to PAID/back, without needing the full generic update
     * payload. Rejects PENDING as a target — that's what the create/update PENDING flow is for.
     */
    async payExpense(user: AuthUser, id: string, dto: PayExpenseDto) {
        const expense = await this.findOne(user, id); // existence + access check

        const nextAmount = dto.amount !== undefined ? dto.amount : Number(expense.amount);
        this.assertAmountForStatus(dto.status, nextAmount);

        const paidAt =
            dto.status === ExpenseStatus.PAID
                ? (dto.paidAt ? new Date(dto.paidAt) : new Date())
                : null;

        return this.prisma.expense.update({
            where: { id },
            data: {
                ...(dto.amount !== undefined && { amount: dto.amount }),
                ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod }),
                ...(dto.receiptUrl !== undefined && { receiptUrl: dto.receiptUrl }),
                status: dto.status,
                paidAt,
            },
            include: { category: true },
        });
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
            _sum: { amount: true },
            _count: { id: true },
        });

        return {
            totalExpense: Number(agg._sum.amount || 0),
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
            _sum: { amount: true },
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
