import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import { DayOfWeek } from '@prisma/client';
import { DayMealItemDto } from './dto/v1-menu.dto';

type AuthUser = { id: string; role: string };
type Schedule = Record<string, { variationId: string; items: string }[]>;

@Injectable()
export class V1MenuService {
  constructor(private readonly prisma: PrismaService) {}

  private async getMenuAndAssert(user: AuthUser, menuId: string) {
    const menu = await this.prisma.menu.findUnique({
      where: { id: menuId },
      include: { mess: true },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    await assertMessAccess(this.prisma, user, menu.messId);
    return menu;
  }

  // GET /api/v1/menus/:id/days
  async getDays(user: AuthUser, menuId: string) {
    const menu = await this.getMenuAndAssert(user, menuId);
    const schedule = (menu.schedule as Schedule) || {};
    const days = Object.keys(schedule);

    return {
      success: true,
      message: 'Menu serving days retrieved',
      data: {
        menuId: menu.id,
        menuName: menu.name,
        days,
        dayDetails: Object.entries(schedule).map(([day, meals]) => ({
          day,
          mealCount: meals?.length ?? 0,
        })),
      },
    };
  }

  // PUT /api/v1/menus/:id/days
  async setDays(user: AuthUser, menuId: string, days: DayOfWeek[]) {
    const menu = await this.getMenuAndAssert(user, menuId);
    const currentSchedule = (menu.schedule as Schedule) || {};
    const updatedSchedule: Schedule = {};

    for (const day of days) {
      updatedSchedule[day] = currentSchedule[day] || [];
    }

    const updated = await this.prisma.menu.update({
      where: { id: menuId },
      data: {
        schedule: updatedSchedule as any,
      },
    });

    return {
      success: true,
      message: 'Menu serving days updated successfully',
      data: {
        menuId: updated.id,
        days: Object.keys(updatedSchedule),
      },
    };
  }

  // GET /api/v1/menus/:id/days/:day/meals
  async getDayMeals(user: AuthUser, menuId: string, day: DayOfWeek) {
    const menu = await this.getMenuAndAssert(user, menuId);
    const schedule = (menu.schedule as Schedule) || {};
    const meals = schedule[day] || [];

    // Fetch variation names
    const variationIds = meals.map((m) => m.variationId);
    const variations = await this.prisma.variation.findMany({
      where: { id: { in: variationIds } },
      select: { id: true, title: true },
    });
    const varMap = new Map(variations.map((v) => [v.id, v.title]));

    const enrichedMeals = meals.map((m) => ({
      variationId: m.variationId,
      variationName: varMap.get(m.variationId) || 'Meal',
      items: m.items,
    }));

    return {
      success: true,
      message: `Meals for ${day} retrieved`,
      data: {
        menuId: menu.id,
        day,
        meals: enrichedMeals,
      },
    };
  }

  // PUT /api/v1/menus/:id/days/:day/meals
  async setDayMeals(
    user: AuthUser,
    menuId: string,
    day: DayOfWeek,
    meals: DayMealItemDto[],
  ) {
    const menu = await this.getMenuAndAssert(user, menuId);

    // Verify variations exist
    const variationIds = [...new Set(meals.map((m) => m.variationId))];
    if (variationIds.length > 0) {
      const found = await this.prisma.variation.findMany({
        where: { id: { in: variationIds } },
        select: { id: true },
      });
      if (found.length !== variationIds.length) {
        throw new BadRequestException('One or more variation IDs are invalid');
      }
    }

    const schedule = (menu.schedule as Schedule) || {};
    schedule[day] = meals.map((m) => ({
      variationId: m.variationId,
      items: m.items,
    }));

    await this.prisma.menu.update({
      where: { id: menuId },
      data: { schedule: schedule as any },
    });

    return {
      success: true,
      message: `Meals for ${day} updated successfully`,
      data: {
        menuId: menu.id,
        day,
        meals,
      },
    };
  }

  // DELETE /api/v1/menus/:id/days/:day/meals
  async deleteDayMeals(user: AuthUser, menuId: string, day: DayOfWeek) {
    const menu = await this.getMenuAndAssert(user, menuId);
    const schedule = (menu.schedule as Schedule) || {};

    delete schedule[day];

    await this.prisma.menu.update({
      where: { id: menuId },
      data: { schedule: schedule as any },
    });

    return {
      success: true,
      message: `Meals for ${day} deleted successfully`,
      data: { menuId: menu.id, day },
    };
  }

  // GET /api/v1/menus/:id/progress
  async getProgress(user: AuthUser, menuId: string) {
    const menu = await this.getMenuAndAssert(user, menuId);
    const schedule = (menu.schedule as Schedule) || {};

    const allDays = Object.values(DayOfWeek);
    const configuredDays = Object.keys(schedule).filter(
      (day) => schedule[day] && schedule[day].length > 0,
    );

    const configuredCount = configuredDays.length;
    const completionPercentage = Math.round((configuredCount / 7) * 100);

    return {
      success: true,
      message: 'Menu progress calculated',
      data: {
        menuId: menu.id,
        totalDays: 7,
        configuredDaysCount: configuredCount,
        configuredDays,
        missingDays: allDays.filter((d) => !configuredDays.includes(d)),
        completionPercentage,
        isComplete: configuredCount >= 5, // minimum 5 days for onboarding completeness
      },
    };
  }

  // POST /api/v1/menus/:id/validate
  async validateMenu(user: AuthUser, menuId: string) {
    const menu = await this.getMenuAndAssert(user, menuId);
    const schedule = (menu.schedule as Schedule) || {};
    const errors: string[] = [];

    const configuredDays = Object.keys(schedule).filter(
      (day) => schedule[day] && schedule[day].length > 0,
    );

    if (configuredDays.length === 0) {
      errors.push('Menu must have meals configured for at least one day.');
    }

    for (const day of configuredDays) {
      const meals = schedule[day] || [];
      for (const meal of meals) {
        if (!meal.variationId) {
          errors.push(`Missing variation ID on ${day}.`);
        }
        if (!meal.items || meal.items.trim() === '') {
          errors.push(`Empty meal items list on ${day}.`);
        }
      }
    }

    const isValid = errors.length === 0;

    if (isValid) {
      await this.advanceOnboarding(user.id, menu.messId, 'MENU_PLANNING');
    }

    return {
      success: true,
      message: isValid ? 'Menu is valid and complete' : 'Menu validation failed',
      data: {
        menuId: menu.id,
        isValid,
        errors,
        configuredDaysCount: configuredDays.length,
      },
    };
  }

  private async advanceOnboarding(userId: string, messId: string, stage: string) {
    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) return;

    let completed: string[] = [];
    if (Array.isArray(session.completedStages)) {
      completed = session.completedStages as string[];
    } else if (typeof session.completedStages === 'string') {
      try {
        completed = JSON.parse(session.completedStages);
      } catch {
        completed = [];
      }
    }

    if (!completed.includes(stage)) {
      completed.push(stage);
    }

    await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        messId,
        currentStage: stage as any,
        completedStages: JSON.stringify(completed),
      },
    });
  }
}
