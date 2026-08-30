import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { paginate } from 'src/common/utility/pagination.util';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';

type AuthUser = { id: string; role: Role | string };

@Injectable()
export class ExpenseCategoriesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(user: AuthUser, dto: CreateExpenseCategoryDto) {
        await assertMessAccess(this.prisma, user, dto.messId);

        try {
            return await this.prisma.expenseCategory.create({
                data: {
                    messId: dto.messId,
                    name: dto.name,
                    description: dto.description,
                    isActive: dto.isActive ?? true,
                },
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new BadRequestException('A category with this name already exists for this mess');
            }
            throw err;
        }
    }

    async findAll(
        user: AuthUser,
        messId: string,
        page?: number,
        limit?: number,
        search?: string,
        isActive?: boolean,
    ) {
        await assertMessAccess(this.prisma, user, messId);

        const where: Prisma.ExpenseCategoryWhereInput = {
            messId,
            ...(search && { name: { contains: search } }),
            ...(isActive !== undefined && { isActive }),
        };

        return paginate({
            prismaModel: this.prisma.expenseCategory,
            page,
            limit,
            where,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(user: AuthUser, id: string) {
        const category = await this.prisma.expenseCategory.findUnique({ where: { id } });

        if (!category) {
            throw new NotFoundException('Expense category not found');
        }

        await assertMessAccess(this.prisma, user, category.messId);

        return category;
    }

    async update(user: AuthUser, id: string, dto: UpdateExpenseCategoryDto) {
        await this.findOne(user, id); // existence + access check

        try {
            return await this.prisma.expenseCategory.update({
                where: { id },
                data: dto,
            });
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                throw new BadRequestException('A category with this name already exists for this mess');
            }
            throw err;
        }
    }

    async remove(user: AuthUser, id: string) {
        await this.findOne(user, id); // existence + access check

        const expenseCount = await this.prisma.expense.count({ where: { categoryId: id } });
        if (expenseCount > 0) {
            throw new BadRequestException(
                `This category is used by ${expenseCount} expense(s) and cannot be deleted. Deactivate it instead.`,
            );
        }

        return this.prisma.expenseCategory.delete({ where: { id } });
    }
}
