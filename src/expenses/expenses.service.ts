import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { endOfDay, startOfDay } from 'date-fns';
import { PrismaService } from 'src/prisma/prisma.service';
import { paginate } from 'src/common/utility/pagination.util';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
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

    async create(user: AuthUser, dto: CreateExpenseDto) {
        await assertMessAccess(this.prisma, user, dto.messId);
        await this.getCategoryOrThrow(dto.categoryId, dto.messId);

        return this.prisma.expense.create({
            data: {
                messId: dto.messId,
                categoryId: dto.categoryId,
                title: dto.title,
                amount: dto.amount,
                description: dto.description,
                expenseDate: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
                paymentMethod: dto.paymentMethod,
                receiptUrl: dto.receiptUrl,
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
    ) {
        await assertMessAccess(this.prisma, user, messId);

        const where: Prisma.ExpenseWhereInput = {
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

        return paginate({
            prismaModel: this.prisma.expense,
            page,
            limit,
            where,
            include: { category: true },
            orderBy: { expenseDate: 'desc' },
        });
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
