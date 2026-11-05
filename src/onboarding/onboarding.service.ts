import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  SaveOnboardingDataDto,
  StartOnboardingDto,
  TransitionStageDto,
} from './dto/onboarding.dto';
import {
  OfferClaimStatus,
  OnboardingStage,
  OnboardingStatus,
} from '@prisma/client';

type AuthUser = { id: string; role: string };

const ORDERED_STAGES: OnboardingStage[] = [
  OnboardingStage.PHONE_VERIFICATION,
  OnboardingStage.BUSINESS_DETAILS,
  OnboardingStage.LOCATION,
  OnboardingStage.WEBSITE_OFFER,
  OnboardingStage.BRANDING,
  OnboardingStage.MENU_DAYS,
  OnboardingStage.DAILY_DISHES,
  OnboardingStage.PRICING,
  OnboardingStage.AVAILABILITY,
  OnboardingStage.WEBSITE_GENERATION,
  OnboardingStage.WEBSITE_READY,
  OnboardingStage.COMPLETED,
];

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────

  private parseCompletedStages(raw: any): string[] {
    if (Array.isArray(raw)) return raw as string[];
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw);
      } catch {
        return [];
      }
    }
    return [];
  }

  private async resolveMessId(user: AuthUser, messId?: string): Promise<string | null> {
    if (messId) return messId;
    const profile = await this.prisma.messAdminProfile.findUnique({
      where: { userId: user.id },
      include: { messes: { orderBy: { createdAt: 'desc' } } },
    });
    return profile?.messes[0]?.id ?? null;
  }

  /**
   * Get or create an onboarding session for the user/mess pair.
   * Returns the session with completedStages as a parsed string[].
   */
  private async getOrCreateSession(user: AuthUser, messId: string | null) {
    let session = await this.prisma.onboardingSession.findFirst({
      where: { userId: user.id, ...(messId ? { messId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: {
          userId: user.id,
          messId,
          currentStage: OnboardingStage.PHONE_VERIFICATION,
          status: OnboardingStatus.IN_PROGRESS,
          completedStages: JSON.stringify([OnboardingStage.PHONE_VERIFICATION]),
        },
      });
    }

    return session;
  }

  // ─────────────────────────────────────────────
  // POST /api/v1/onboarding/start
  // ─────────────────────────────────────────────
  async start(user: AuthUser, dto: StartOnboardingDto) {
    const messId = await this.resolveMessId(user, dto.messId);

    const session = await this.getOrCreateSession(user, messId);

    return {
      success: true,
      message: 'Onboarding session started',
      data: {
        sessionId: session.id,
        currentStage: session.currentStage,
        status: session.status,
        completedStages: this.parseCompletedStages(session.completedStages),
      },
    };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/onboarding/status
  // ─────────────────────────────────────────────
  async getStatus(user: AuthUser, messIdQuery?: string) {
    const messId = await this.resolveMessId(user, messIdQuery);

    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId: user.id, ...(messId ? { messId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return {
        success: true,
        message: 'No active onboarding session found',
        data: null,
      };
    }

    const completed = this.parseCompletedStages(session.completedStages);
    const currentIndex = ORDERED_STAGES.indexOf(session.currentStage);
    const nextStage =
      currentIndex >= 0 && currentIndex < ORDERED_STAGES.length - 1
        ? ORDERED_STAGES[currentIndex + 1]
        : null;

    return {
      success: true,
      message: 'Onboarding status retrieved',
      data: {
        sessionId: session.id,
        messId: session.messId,
        currentStage: session.currentStage,
        nextStage,
        status: session.status,
        completedStages: completed,
        completedAt: session.completedAt,
        updatedAt: session.updatedAt,
      },
    };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/onboarding/progress
  // ─────────────────────────────────────────────
  async getProgress(user: AuthUser, messIdQuery?: string) {
    const messId = await this.resolveMessId(user, messIdQuery);

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        messAdminProfile: {
          include: {
            messes: {
              where: messId ? { id: messId } : undefined,
              include: {
                businessLocation: true,
                businessBranding: true,
                website: true,
                menus: { where: { isActive: true } },
                plans: { where: { isActive: true } },
                websiteOfferClaim: true,
              },
            },
          },
        },
      },
    });

    const mess = dbUser?.messAdminProfile?.messes[0];

    const checklist = [
      {
        stage: OnboardingStage.PHONE_VERIFICATION,
        title: 'Phone Number Verification',
        isComplete: !!dbUser?.is_verified,
      },
      {
        stage: OnboardingStage.BUSINESS_DETAILS,
        title: 'Business Information',
        isComplete: !!mess?.name && mess.name !== '',
      },
      {
        stage: OnboardingStage.LOCATION,
        title: 'Kitchen & Serving Location',
        isComplete: !!mess?.businessLocation,
      },
      {
        stage: OnboardingStage.WEBSITE_OFFER,
        title: 'Promotional Website Offer',
        isComplete: !!mess?.websiteOfferClaim,
      },
      {
        stage: OnboardingStage.BRANDING,
        title: 'Logo & Visual Identity',
        isComplete: !!mess?.businessBranding?.logoUrl || !!mess?.businessBranding?.displayName,
      },
      {
        stage: OnboardingStage.MENU_DAYS,
        title: 'Weekly Menu Schedule',
        isComplete: (mess?.menus?.length ?? 0) > 0,
      },
      {
        stage: OnboardingStage.DAILY_DISHES,
        title: 'Daily Meal Items',
        isComplete: (mess?.menus?.length ?? 0) > 0,
      },
      {
        stage: OnboardingStage.PRICING,
        title: 'Meal Subscription Plans',
        isComplete: (mess?.plans?.length ?? 0) > 0,
      },
      {
        stage: OnboardingStage.WEBSITE_GENERATION,
        title: 'Storefront Website Generation',
        isComplete: !!mess?.website,
      },
      {
        stage: OnboardingStage.COMPLETED,
        title: 'Review & Storefront Launch',
        isComplete: mess?.website?.status === 'PUBLISHED',
      },
    ];

    const completedCount = checklist.filter((item) => item.isComplete).length;
    const totalCount = checklist.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    return {
      success: true,
      message: 'Onboarding progress calculated',
      data: {
        messId: mess?.id ?? null,
        percentage,
        completedCount,
        totalCount,
        checklist,
        isFullyComplete: percentage === 100,
      },
    };
  }

  // ─────────────────────────────────────────────
  // POST /api/v1/onboarding/resume
  // ─────────────────────────────────────────────
  async resume(user: AuthUser, messIdQuery?: string) {
    const progressResp = await this.getProgress(user, messIdQuery);
    const incomplete = progressResp.data.checklist.find((item) => !item.isComplete);
    const nextStage = incomplete ? incomplete.stage : OnboardingStage.COMPLETED;

    return {
      success: true,
      message: `Resume onboarding at stage: ${nextStage}`,
      data: {
        resumeStage: nextStage,
        percentage: progressResp.data.percentage,
        messId: progressResp.data.messId,
      },
    };
  }

  // ─────────────────────────────────────────────
  // PATCH /api/v1/onboarding/stage
  // ─────────────────────────────────────────────
  async transitionStage(user: AuthUser, dto: TransitionStageDto) {
    const messId = await this.resolveMessId(user);

    let session = await this.prisma.onboardingSession.findFirst({
      where: { userId: user.id, ...(messId ? { messId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      session = await this.prisma.onboardingSession.create({
        data: {
          userId: user.id,
          messId,
          currentStage: dto.stage,
          completedStages: JSON.stringify([dto.stage]),
        },
      });
    } else {
      const completed = this.parseCompletedStages(session.completedStages);
      if (!completed.includes(dto.stage)) {
        completed.push(dto.stage);
      }

      session = await this.prisma.onboardingSession.update({
        where: { id: session.id },
        data: {
          currentStage: dto.stage,
          completedStages: JSON.stringify(completed),
          metadata: dto.metadata ? (dto.metadata as any) : undefined,
        },
      });
    }

    await this.prisma.onboardingEvent.create({
      data: {
        sessionId: session.id,
        stage: dto.stage,
        eventType: dto.eventType || 'COMPLETED',
        metadata: dto.metadata ? (dto.metadata as any) : undefined,
      },
    });

    return {
      success: true,
      message: `Onboarding transitioned to stage: ${dto.stage}`,
      data: {
        sessionId: session.id,
        currentStage: session.currentStage,
        completedStages: this.parseCompletedStages(session.completedStages),
      },
    };
  }

  // ─────────────────────────────────────────────
  // POST /api/v1/onboarding/complete
  // ─────────────────────────────────────────────
  async complete(user: AuthUser, messIdQuery?: string) {
    const messId = await this.resolveMessId(user, messIdQuery);

    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId: user.id, ...(messId ? { messId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      throw new NotFoundException('No active onboarding session found');
    }

    const completed = this.parseCompletedStages(session.completedStages);
    if (!completed.includes(OnboardingStage.COMPLETED)) {
      completed.push(OnboardingStage.COMPLETED);
    }

    const updated = await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        currentStage: OnboardingStage.COMPLETED,
        status: OnboardingStatus.COMPLETED,
        completedStages: JSON.stringify(completed),
        completedAt: new Date(),
      },
    });

    if (messId) {
      await this.prisma.mess.update({
        where: { id: messId },
        data: { is_active: true },
      });
    }

    await this.prisma.onboardingEvent.create({
      data: {
        sessionId: session.id,
        stage: OnboardingStage.COMPLETED,
        eventType: 'COMPLETED',
      },
    });

    return {
      success: true,
      message: 'Onboarding completed successfully! Your business is live on MessMeals.',
      data: {
        sessionId: updated.id,
        status: updated.status,
        completedAt: updated.completedAt,
      },
    };
  }

  // ─────────────────────────────────────────────
  // POST /api/v1/onboarding/data  (NEW)
  // ─────────────────────────────────────────────
  async saveOnboardingData(user: AuthUser, dto: SaveOnboardingDataDto) {
    const messId = await this.resolveMessId(user, dto.messId);

    if (!messId) {
      throw new BadRequestException(
        'No mess found for this account. Please create a business first (POST /api/v1/businesses) or supply messId.',
      );
    }

    // Ensure session exists
    const session = await this.getOrCreateSession(user, messId);
    const completedStages = this.parseCompletedStages(session.completedStages);
    const newlyCompleted: OnboardingStage[] = [];

    const markComplete = (stage: OnboardingStage) => {
      if (!completedStages.includes(stage)) {
        completedStages.push(stage);
        newlyCompleted.push(stage);
      }
    };

    const savedSections: string[] = [];

    // ── BUSINESS_DETAILS ────────────────────────
    if (dto.business) {
      const { name, email, phone, description, ownerName } = dto.business;

      const updateData: Record<string, any> = {};
      if (name !== undefined) updateData.name = name;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (description !== undefined) updateData.description = description;

      if (Object.keys(updateData).length > 0) {
        await this.prisma.mess.update({ where: { id: messId }, data: updateData });
      }

      if (ownerName !== undefined) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { name: ownerName },
        });
      }

      markComplete(OnboardingStage.BUSINESS_DETAILS);
      savedSections.push('business');
    }

    // ── LOCATION ────────────────────────────────
    if (dto.location) {
      const { country, building, area, city, state, postalCode } = dto.location;

      // BusinessLocation.country, city, state, postalCode are non-nullable in schema
      // but we allow partial updates — only update provided fields.
      const existing = await this.prisma.businessLocation.findUnique({ where: { messId } });

      if (existing) {
        const updateData: Record<string, any> = {};
        if (country !== undefined) updateData.country = country;
        if (building !== undefined) updateData.building = building;
        if (area !== undefined) updateData.area = area;
        if (city !== undefined) updateData.city = city;
        if (state !== undefined) updateData.state = state;
        if (postalCode !== undefined) updateData.postalCode = postalCode;
        await this.prisma.businessLocation.update({ where: { messId }, data: updateData });
      } else {
        // For a new record, required fields default if missing
        await this.prisma.businessLocation.create({
          data: {
            messId,
            country: country ?? 'IN' as any,
            currency: country === 'AE' ? 'AED' : country === 'QA' ? 'QAR' : 'INR',
            timezone:
              country === 'AE'
                ? 'Asia/Dubai'
                : country === 'QA'
                  ? 'Asia/Qatar'
                  : 'Asia/Kolkata',
            building: building ?? null,
            area: area ?? null,
            city: city ?? '',
            state: state ?? '',
            postalCode: postalCode ?? '',
          },
        });
      }

      markComplete(OnboardingStage.LOCATION);
      savedSections.push('location');
    }

    // ── BRANDING ────────────────────────────────
    if (dto.branding) {
      const { displayName, theme, primaryColor, secondaryColor, logoUrl, coverUrl } = dto.branding;

      const brandingData: Record<string, any> = {};
      if (displayName !== undefined) brandingData.displayName = displayName;
      if (theme !== undefined) brandingData.theme = theme;
      if (primaryColor !== undefined) brandingData.primaryColor = primaryColor;
      if (secondaryColor !== undefined) brandingData.secondaryColor = secondaryColor;
      if (logoUrl !== undefined) brandingData.logoUrl = logoUrl;
      if (coverUrl !== undefined) brandingData.coverUrl = coverUrl;

      await this.prisma.businessBranding.upsert({
        where: { messId },
        create: { messId, ...brandingData },
        update: brandingData,
      });

      markComplete(OnboardingStage.BRANDING);
      savedSections.push('branding');
    }

    // ── WEBSITE_OFFER ────────────────────────────
    if (dto.offer !== undefined) {
      const shouldClaim = dto.offer.claim !== false; // default true

      // Find the first active offer config
      const config = await this.prisma.websiteOfferConfig.findFirst({
        where: { isEnabled: true },
        orderBy: { createdAt: 'asc' },
      });

      if (config) {
        const existingClaim = await this.prisma.websiteOfferClaim.findUnique({
          where: { messId },
        });

        const claimStatus: OfferClaimStatus = shouldClaim
          ? OfferClaimStatus.CLAIMED
          : OfferClaimStatus.DISMISSED;

        if (existingClaim) {
          await this.prisma.websiteOfferClaim.update({
            where: { messId },
            data: {
              status: claimStatus,
              claimedAt: shouldClaim ? existingClaim.claimedAt ?? new Date() : null,
            },
          });
        } else {
          await this.prisma.websiteOfferClaim.create({
            data: {
              userId: user.id,
              messId,
              configId: config.id,
              status: claimStatus,
              claimedAt: shouldClaim ? new Date() : null,
            },
          });

          // Atomically increment totalClaimed counter
          if (shouldClaim) {
            await this.prisma.websiteOfferConfig.update({
              where: { id: config.id },
              data: { totalClaimed: { increment: 1 } },
            });
          }
        }
      }

      markComplete(OnboardingStage.WEBSITE_OFFER);
      savedSections.push('offer');
    }

    // ── MENU_DAYS + DAILY_DISHES ─────────────────
    if (dto.menu) {
      const menuName = dto.menu.name ?? 'Default Menu';
      const schedule = dto.menu.schedule ?? {};
      const planId = dto.menu.planId;

      // Manual upsert — Menu has no composite unique index in schema
      const existingMenu = await this.prisma.menu.findFirst({
        where: { messId, name: menuName },
      });

      if (existingMenu) {
        await this.prisma.menu.update({
          where: { id: existingMenu.id },
          data: {
            schedule: schedule as any,
            ...(planId ? { plans: { connect: { id: planId } } } : {}),
          },
        });
      } else {
        await this.prisma.menu.create({
          data: {
            messId,
            name: menuName,
            schedule: schedule as any,
            isActive: true,
            ...(planId ? { plans: { connect: { id: planId } } } : {}),
          },
        });
      }

      markComplete(OnboardingStage.MENU_DAYS);
      // If schedule has at least one day with items, also mark DAILY_DISHES
      const hasItems = Object.values(schedule).some((entries) => entries.length > 0);
      if (hasItems) {
        markComplete(OnboardingStage.DAILY_DISHES);
      }
      savedSections.push('menu');
    }

    // ── PRICING ──────────────────────────────────
    if (dto.plans && dto.plans.length > 0) {
      // Deduplicate by planName (last entry wins)
      const deduped = new Map<string, typeof dto.plans[0]>();
      for (const plan of dto.plans) {
        deduped.set(plan.planName, plan);
      }

      for (const plan of deduped.values()) {
        const existing = await this.prisma.plans.findFirst({
          where: { messId, planName: plan.planName, deletedAt: null },
        });

        const planData = {
          planName: plan.planName,
          price: plan.price,
          description: plan.description ?? null,
          isDailyPlan: plan.isDailyPlan ?? true,
          isMonthlyPlan: plan.isMonthlyPlan ?? false,
          scheduleType: plan.scheduleType ?? undefined,
          availableDays: plan.availableDays ? (plan.availableDays as any) : undefined,
          isActive: true,
        };

        if (existing) {
          await this.prisma.plans.update({ where: { id: existing.id }, data: planData });
        } else {
          await this.prisma.plans.create({ data: { messId, ...planData } });
        }
      }

      markComplete(OnboardingStage.PRICING);
      savedSections.push('plans');
    }

    // ── Update session ───────────────────────────
    // Determine the new currentStage:
    // 1. Use dto.currentStage if explicitly provided
    // 2. Otherwise use the last newly completed stage
    // 3. Otherwise keep the existing currentStage
    let newCurrentStage: OnboardingStage = session.currentStage;
    if (dto.currentStage) {
      newCurrentStage = dto.currentStage;
      if (!completedStages.includes(dto.currentStage)) {
        completedStages.push(dto.currentStage);
      }
    } else if (newlyCompleted.length > 0) {
      // Pick the latest stage in ORDERED_STAGES order
      const sortedNew = newlyCompleted.sort(
        (a, b) => ORDERED_STAGES.indexOf(a) - ORDERED_STAGES.indexOf(b),
      );
      newCurrentStage = sortedNew[sortedNew.length - 1];
    }

    const updatedSession = await this.prisma.onboardingSession.update({
      where: { id: session.id },
      data: {
        currentStage: newCurrentStage,
        completedStages: JSON.stringify(completedStages),
      },
    });

    // Log an event for each newly completed stage
    for (const stage of newlyCompleted) {
      await this.prisma.onboardingEvent.create({
        data: { sessionId: session.id, stage, eventType: 'COMPLETED' },
      });
    }

    // Compute nextStage
    const currentIndex = ORDERED_STAGES.indexOf(newCurrentStage);
    const nextStage =
      currentIndex >= 0 && currentIndex < ORDERED_STAGES.length - 1
        ? ORDERED_STAGES[currentIndex + 1]
        : null;

    return {
      success: true,
      message:
        savedSections.length > 0
          ? `Onboarding data saved: ${savedSections.join(', ')}`
          : 'No data sections provided — session unchanged',
      data: {
        sessionId: updatedSession.id,
        messId,
        currentStage: updatedSession.currentStage,
        completedStages: this.parseCompletedStages(updatedSession.completedStages),
        savedSections,
        nextStage,
      },
    };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/onboarding/session  (NEW)
  // ─────────────────────────────────────────────
  async getSessionWithData(user: AuthUser, messIdQuery?: string) {
    const messId = await this.resolveMessId(user, messIdQuery);

    const session = await this.prisma.onboardingSession.findFirst({
      where: { userId: user.id, ...(messId ? { messId } : {}) },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) {
      return {
        success: true,
        message: 'No active onboarding session found',
        data: null,
      };
    }

    // Fetch mess with all related onboarding data
    const mess = messId
      ? await this.prisma.mess.findUnique({
          where: { id: messId },
          include: {
            businessLocation: true,
            businessBranding: true,
            websiteOfferClaim: true,
            menus: {
              where: { isActive: true },
              orderBy: { updatedAt: 'desc' },
              take: 1,
            },
            plans: {
              where: { isActive: true, deletedAt: null },
              orderBy: { createdAt: 'asc' },
            },
          },
        })
      : null;

    // Also fetch user verification status for PHONE_VERIFICATION stage
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { is_verified: true, name: true },
    });

    // Build stage data map
    const stageData = {
      business: mess
        ? {
            name: mess.name,
            ownerName: dbUser?.name ?? null,
            email: mess.email,
            phone: mess.phone,
            description: mess.description,
          }
        : null,
      location: mess?.businessLocation ?? null,
      branding: mess?.businessBranding ?? null,
      offer: mess?.websiteOfferClaim ?? null,
      menu: mess?.menus[0] ?? null,
      plans: mess?.plans ?? [],
    };

    // Build stage completion flags (mirrors getProgress logic)
    const stageCompletion: Record<string, boolean> = {
      [OnboardingStage.PHONE_VERIFICATION]: !!dbUser?.is_verified,
      [OnboardingStage.BUSINESS_DETAILS]: !!mess?.name && mess.name !== '',
      [OnboardingStage.LOCATION]: !!mess?.businessLocation,
      [OnboardingStage.WEBSITE_OFFER]: !!mess?.websiteOfferClaim,
      [OnboardingStage.BRANDING]:
        !!mess?.businessBranding?.logoUrl || !!mess?.businessBranding?.displayName,
      [OnboardingStage.MENU_DAYS]: (mess?.menus?.length ?? 0) > 0,
      [OnboardingStage.DAILY_DISHES]: (mess?.menus?.length ?? 0) > 0,
      [OnboardingStage.PRICING]: (mess?.plans?.length ?? 0) > 0,
      [OnboardingStage.AVAILABILITY]: false, // future feature
      [OnboardingStage.WEBSITE_GENERATION]: false, // handled by website module
      [OnboardingStage.WEBSITE_READY]: false,
      [OnboardingStage.COMPLETED]: false,
    };

    const completedStages = this.parseCompletedStages(session.completedStages);
    const completedCount = Object.values(stageCompletion).filter(Boolean).length;
    const totalCount = ORDERED_STAGES.length;
    const percentage = Math.round((completedCount / totalCount) * 100);

    // Next incomplete stage after PHONE_VERIFICATION
    const nextStage =
      ORDERED_STAGES.find(
        (s) => s !== OnboardingStage.PHONE_VERIFICATION && !stageCompletion[s],
      ) ?? null;

    return {
      success: true,
      message: 'Session data retrieved',
      data: {
        sessionId: session.id,
        messId: session.messId,
        currentStage: session.currentStage,
        status: session.status,
        completedStages,
        nextStage,
        percentage,
        stageData,
        stageCompletion,
      },
    };
  }
}
