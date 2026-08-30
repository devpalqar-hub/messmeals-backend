import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DayOfWeek, Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { paginate } from 'src/common/utility/pagination.util';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';

type AuthUser = { id: string; role: Role | string };

const menuInclude = {
    variation: true,
    plans: { select: { id: true, planName: true } },
} satisfies Prisma.MenuInclude;

@Injectable()
export class MenuService {
    constructor(private readonly prisma: PrismaService) { }

    private async getVariationOrThrow(variationId: string) {
        const variation = await this.prisma.variation.findUnique({ where: { id: variationId } });
        if (!variation) {
            throw new BadRequestException('Variation not found');
        }
        return variation;
    }

    async create(user: AuthUser, dto: CreateMenuDto) {
        await assertMessAccess(this.prisma, user, dto.messId);
        await this.getVariationOrThrow(dto.variationId);

        return this.prisma.menu.create({
            data: {
                messId: dto.messId,
                variationId: dto.variationId,
                name: dto.name,
                days: dto.days,
                items: dto.items,
                isActive: dto.isActive ?? true,
            },
            include: menuInclude,
        });
    }

    async findAll(
        user: AuthUser,
        messId: string,
        page?: number,
        limit?: number,
        search?: string,
        variationId?: string,
        day?: DayOfWeek,
        planId?: string,
        isActive?: boolean,
    ) {
        await assertMessAccess(this.prisma, user, messId);

        const where: Prisma.MenuWhereInput = {
            messId,
            ...(variationId && { variationId }),
            ...(search && { name: { contains: search } }),
            ...(isActive !== undefined && { isActive }),
            ...(day && { days: { array_contains: day } as Prisma.JsonFilter }),
            ...(planId && { plans: { some: { id: planId } } }),
        };

        return paginate({
            prismaModel: this.prisma.menu,
            page,
            limit,
            where,
            include: menuInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Public helper for a plan's detail page: the menus (if any) linked to a given plan. */
    async findByPlan(planId: string) {
        const plan = await this.prisma.plans.findUnique({ where: { id: planId } });
        if (!plan) {
            throw new NotFoundException('Plan not found');
        }

        return this.prisma.menu.findMany({
            where: { plans: { some: { id: planId } }, isActive: true },
            include: menuInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(user: AuthUser, id: string) {
        const menu = await this.prisma.menu.findUnique({ where: { id }, include: menuInclude });

        if (!menu) {
            throw new NotFoundException('Menu not found');
        }

        await assertMessAccess(this.prisma, user, menu.messId);

        return menu;
    }

    async update(user: AuthUser, id: string, dto: UpdateMenuDto) {
        await this.findOne(user, id); // existence + access check

        if (dto.variationId) {
            await this.getVariationOrThrow(dto.variationId);
        }

        return this.prisma.menu.update({
            where: { id },
            data: {
                ...(dto.variationId && { variationId: dto.variationId }),
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.days !== undefined && { days: dto.days }),
                ...(dto.items !== undefined && { items: dto.items }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
            },
            include: menuInclude,
        });
    }

    async remove(user: AuthUser, id: string) {
        await this.findOne(user, id); // existence + access check

        await this.prisma.menu.delete({ where: { id } });

        return { message: 'Menu deleted successfully' };
    }
}
