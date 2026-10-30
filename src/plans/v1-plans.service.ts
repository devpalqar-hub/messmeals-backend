import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { assertMessAccess } from 'src/common/utility/mess-access.util';
import {
  SetPlanMealsDto,
  SetPlanPricingDto,
  SetPlanAvailabilityDto,
} from './dto/v1-plan.dto';
import { BillingPeriod, DayOfWeek, ScheduleType } from '@prisma/client';

type AuthUser = { id: string; role: string };

@Injectable()
export class V1PlansService {
  constructor(private readonly prisma: PrismaService) {}

  private async getPlanAndAssert(user: AuthUser, planId: string) {
    const plan = await this.prisma.plans.findUnique({
      where: { id: planId },
      include: { mess: true },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    await assertMessAccess(this.prisma, user, plan.messId);
    return plan;
  }

  // GET /api/v1/plans/:id/meals
  async getPlanMeals(user: AuthUser, planId: string) {
    const plan = await this.getPlanAndAssert(user, planId);

    const fullPlan = await this.prisma.plans.findUnique({
      where: { id: plan.id },
      include: {
        Variation: {
          select: { id: true, title: true, description: true, isActive: true },
        },
      },
    });

    return {
      success: true,
      message: 'Plan meals retrieved successfully',
      data: {
        planId: plan.id,
        meals: fullPlan?.Variation ?? [],
      },
    };
  }

  // PUT /api/v1/plans/:id/meals
  async setPlanMeals(user: AuthUser, planId: string, dto: SetPlanMealsDto) {
    const plan = await this.getPlanAndAssert(user, planId);

    if (dto.variationIds.length > 0) {
      const existing = await this.prisma.variation.findMany({
        where: { id: { in: dto.variationIds } },
        select: { id: true },
      });
      if (existing.length !== dto.variationIds.length) {
        throw new BadRequestException('One or more variation IDs are invalid');
      }
    }

    const updated = await this.prisma.plans.update({
      where: { id: plan.id },
      data: {
        Variation: {
          set: dto.variationIds.map((id) => ({ id })),
        },
      },
      include: {
        Variation: { select: { id: true, title: true, description: true } },
      },
    });

    return {
      success: true,
      message: 'Plan meals updated successfully',
      data: {
        planId: updated.id,
        meals: updated.Variation,
      },
    };
  }

  // GET /api/v1/plans/:id/pricing
  async getPlanPricing(user: AuthUser, planId: string) {
    const plan = await this.getPlanAndAssert(user, planId);

    const pricing = await this.prisma.planPricing.findUnique({
      where: { planId: plan.id },
    });

    if (!pricing) {
      return {
        success: true,
        message: 'No pricing configured yet',
        data: {
          planId: plan.id,
          regularPrice: Number(plan.price),
          discountEnabled: false,
          discountedPrice: null,
          billingPeriod: plan.isMonthlyPlan ? BillingPeriod.MONTHLY : BillingPeriod.DAILY,
          currency: 'INR',
          savings: 0,
        },
      };
    }

    return {
      success: true,
      message: 'Plan pricing retrieved successfully',
      data: {
        ...pricing,
        regularPrice: Number(pricing.regularPrice),
        discountedPrice: pricing.discountedPrice ? Number(pricing.discountedPrice) : null,
        savings: pricing.savings ? Number(pricing.savings) : 0,
      },
    };
  }

  // PUT /api/v1/plans/:id/pricing
  async setPlanPricing(user: AuthUser, planId: string, dto: SetPlanPricingDto) {
    const plan = await this.getPlanAndAssert(user, planId);

    if (dto.discountEnabled && dto.discountedPrice && dto.discountedPrice >= dto.regularPrice) {
      throw new BadRequestException('Discounted price must be less than regular price');
    }

    const savings =
      dto.discountEnabled && dto.discountedPrice
        ? dto.regularPrice - dto.discountedPrice
        : 0;

    const pricing = await this.prisma.planPricing.upsert({
      where: { planId: plan.id },
      create: {
        planId: plan.id,
        billingPeriod: dto.billingPeriod,
        regularPrice: dto.regularPrice,
        discountEnabled: dto.discountEnabled ?? false,
        discountedPrice: dto.discountedPrice ?? null,
        currency: dto.currency ?? 'INR',
        savings,
      },
      update: {
        billingPeriod: dto.billingPeriod,
        regularPrice: dto.regularPrice,
        discountEnabled: dto.discountEnabled ?? false,
        discountedPrice: dto.discountedPrice ?? null,
        currency: dto.currency ?? 'INR',
        savings,
      },
    });

    // Sync Plans table price & flags for backward compatibility
    const effectivePrice =
      dto.discountEnabled && dto.discountedPrice ? dto.discountedPrice : dto.regularPrice;

    await this.prisma.plans.update({
      where: { id: plan.id },
      data: {
        price: effectivePrice,
        minPrice: dto.discountedPrice ?? dto.regularPrice,
        isMonthlyPlan: dto.billingPeriod === BillingPeriod.MONTHLY,
        isDailyPlan: dto.billingPeriod === BillingPeriod.DAILY,
      },
    });

    return {
      success: true,
      message: 'Plan pricing updated successfully',
      data: {
        ...pricing,
        regularPrice: Number(pricing.regularPrice),
        discountedPrice: pricing.discountedPrice ? Number(pricing.discountedPrice) : null,
        savings: Number(pricing.savings),
      },
    };
  }

  // GET /api/v1/plans/:id/availability
  async getPlanAvailability(user: AuthUser, planId: string) {
    const plan = await this.getPlanAndAssert(user, planId);

    return {
      success: true,
      message: 'Plan availability retrieved successfully',
      data: {
        planId: plan.id,
        scheduleType: plan.scheduleType,
        availableDays: (plan.availableDays as DayOfWeek[]) ?? (
          plan.scheduleType === ScheduleType.EVERYDAY
            ? Object.values(DayOfWeek)
            : []
        ),
      },
    };
  }

  // PUT /api/v1/plans/:id/availability
  async setPlanAvailability(
    user: AuthUser,
    planId: string,
    dto: SetPlanAvailabilityDto,
  ) {
    const plan = await this.getPlanAndAssert(user, planId);

    if (dto.scheduleType === ScheduleType.CUSTOM && (!dto.availableDays || dto.availableDays.length === 0)) {
      throw new BadRequestException('Custom schedule requires at least one available day');
    }

    const availableDays =
      dto.scheduleType === ScheduleType.EVERYDAY
        ? Object.values(DayOfWeek)
        : (dto.availableDays ?? []);

    const updated = await this.prisma.plans.update({
      where: { id: plan.id },
      data: {
        scheduleType: dto.scheduleType,
        availableDays: availableDays as any,
      },
    });

    return {
      success: true,
      message: 'Plan availability updated successfully',
      data: {
        planId: updated.id,
        scheduleType: updated.scheduleType,
        availableDays,
      },
    };
  }

  // GET /api/v1/plans/:id/summary
  async getPlanSummary(user: AuthUser, planId: string) {
    const plan = await this.getPlanAndAssert(user, planId);

    const fullPlan = await this.prisma.plans.findUnique({
      where: { id: plan.id },
      include: {
        Variation: true,
        planPricing: true,
        images: true,
        menus: { select: { id: true, name: true, isActive: true } },
      },
    });

    const isComplete =
      fullPlan &&
      fullPlan.Variation.length > 0 &&
      (fullPlan.planPricing !== null || Number(fullPlan.price) > 0);

    if (isComplete) {
      await this.advanceOnboarding(user.id, plan.messId, 'PLAN_SETUP');
    }

    return {
      success: true,
      message: 'Plan summary retrieved',
      data: {
        planId: plan.id,
        planName: plan.planName,
        description: plan.description,
        isComplete,
        meals: fullPlan?.Variation ?? [],
        pricing: fullPlan?.planPricing
          ? {
              ...fullPlan.planPricing,
              regularPrice: Number(fullPlan.planPricing.regularPrice),
              discountedPrice: fullPlan.planPricing.discountedPrice
                ? Number(fullPlan.planPricing.discountedPrice)
                : null,
              savings: Number(fullPlan.planPricing.savings),
            }
          : {
              regularPrice: Number(plan.price),
              discountEnabled: false,
              discountedPrice: null,
              currency: 'INR',
              savings: 0,
            },
        availability: {
          scheduleType: plan.scheduleType,
          availableDays: plan.availableDays ?? Object.values(DayOfWeek),
        },
        menus: fullPlan?.menus ?? [],
        images: fullPlan?.images ?? [],
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
