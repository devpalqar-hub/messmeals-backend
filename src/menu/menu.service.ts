import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { paginate } from 'src/common/utility/pagination.util';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuDayEntryDto } from './dto/menu-day-entry.dto';
import { MENU_WEEKDAYS, MenuDayKey } from './menu-days.util';

type AuthUser = { id: string; role: Role | string };
type ScheduleEntry = { variationId: string; items: string };
/** Stored shape: keyed by DayOfWeek (e.g. "MONDAY"), only days that have entries are present. */
type Schedule = Partial<Record<string, ScheduleEntry[]>>;

@Injectable()
export class MenuService {
    constructor(private readonly prisma: PrismaService) { }

    /** Builds the internal { MONDAY: [...], ... } schedule from a create/update DTO's day properties. */
    private buildScheduleFromDto(dto: Partial<Record<MenuDayKey, MenuDayEntryDto[] | undefined>>): Schedule {
        const schedule: Schedule = {};
        for (const { key, day } of MENU_WEEKDAYS) {
            const entries = dto[key];
            if (entries !== undefined) {
                schedule[day] = entries.map((e) => ({ variationId: e.variationId, items: e.items }));
            }
        }
        return schedule;
    }

    /** Converts the stored { MONDAY: [...] } schedule back into { monday: [...], ... } for API responses. */
    private toResponseShape(schedule: Schedule) {
        const shaped: Record<string, ScheduleEntry[]> = {};
        for (const { key, day } of MENU_WEEKDAYS) {
            const entries = schedule?.[day];
            if (entries?.length) {
                shaped[key] = entries;
            }
        }
        return shaped;
    }

    private async assertVariationsExist(schedule: Schedule) {
        const allEntries = Object.values(schedule).flatMap((entries) => entries ?? []);
        const variationIds = [...new Set(allEntries.map((e) => e.variationId))];
        if (variationIds.length === 0) return;

        const found = await this.prisma.variation.findMany({
            where: { id: { in: variationIds } },
            select: { id: true },
        });
        if (found.length !== variationIds.length) {
            throw new BadRequestException('One or more variation IDs are invalid');
        }
    }

    private assertHasAnyDay(schedule: Schedule) {
        const hasAnyDay = Object.values(schedule).some((entries) => entries && entries.length > 0);
        if (!hasAnyDay) {
            throw new BadRequestException('At least one day must have menu entries');
        }
    }

    private decorate<T extends { schedule: unknown }>(menu: T) {
        const { schedule, ...rest } = menu;
        return { ...rest, ...this.toResponseShape((schedule as Schedule) ?? {}) };
    }

    async create(user: AuthUser, dto: CreateMenuDto) {
        await assertMessAccess(this.prisma, user, dto.messId);

        const schedule = this.buildScheduleFromDto(dto);
        this.assertHasAnyDay(schedule);
        await this.assertVariationsExist(schedule);

        const menu = await this.prisma.menu.create({
            data: {
                messId: dto.messId,
                name: dto.name,
                schedule: schedule as Prisma.InputJsonValue,
                isActive: dto.isActive ?? true,
            },
        });

        return this.decorate(menu);
    }

    async findAll(
        user: AuthUser,
        messId: string,
        page?: number,
        limit?: number,
        search?: string,
        planId?: string,
        isActive?: boolean,
    ) {
        await assertMessAccess(this.prisma, user, messId);

        const where: Prisma.MenuWhereInput = {
            messId,
            ...(search && { name: { contains: search } }),
            ...(isActive !== undefined && { isActive }),
            ...(planId && { plans: { some: { id: planId } } }),
        };

        const result = await paginate({
            prismaModel: this.prisma.menu,
            page,
            limit,
            where,
            orderBy: { createdAt: 'desc' },
        });

        return { ...result, data: (result.data as any[]).map((m) => this.decorate(m)) };
    }

    /** Public helper for a plan's detail page: the menus (if any) linked to a given plan. */
    async findByPlan(planId: string) {
        const plan = await this.prisma.plans.findUnique({ where: { id: planId } });
        if (!plan) {
            throw new NotFoundException('Plan not found');
        }

        const menus = await this.prisma.menu.findMany({
            where: { plans: { some: { id: planId } }, isActive: true },
            orderBy: { createdAt: 'desc' },
        });

        return menus.map((m) => this.decorate(m));
    }

    async findOne(user: AuthUser, id: string) {
        const menu = await this.prisma.menu.findUnique({ where: { id } });

        if (!menu) {
            throw new NotFoundException('Menu not found');
        }

        await assertMessAccess(this.prisma, user, menu.messId);

        return this.decorate(menu);
    }

    async update(user: AuthUser, id: string, dto: UpdateMenuDto) {
        const existing = await this.prisma.menu.findUnique({ where: { id } });
        if (!existing) {
            throw new NotFoundException('Menu not found');
        }
        await assertMessAccess(this.prisma, user, existing.messId);

        // Only the days actually present in the dto get replaced; every other day is left untouched.
        // Pass an empty array for a day to clear just that day.
        const currentSchedule = (existing.schedule as Schedule) ?? {};
        const patch = this.buildScheduleFromDto(dto);
        const mergedSchedule: Schedule = { ...currentSchedule, ...patch };

        this.assertHasAnyDay(mergedSchedule);
        await this.assertVariationsExist(mergedSchedule);

        const menu = await this.prisma.menu.update({
            where: { id },
            data: {
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                schedule: mergedSchedule as Prisma.InputJsonValue,
            },
        });

        return this.decorate(menu);
    }

    async remove(user: AuthUser, id: string) {
        const menu = await this.prisma.menu.findUnique({ where: { id } });
        if (!menu) {
            throw new NotFoundException('Menu not found');
        }
        await assertMessAccess(this.prisma, user, menu.messId);

        await this.prisma.menu.delete({ where: { id } });

        return { message: 'Menu deleted successfully' };
    }
}
