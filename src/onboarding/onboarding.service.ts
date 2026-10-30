import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { StartOnboardingDto, TransitionStageDto } from './dto/onboarding.dto';
import { OnboardingStage, OnboardingStatus } from '@prisma/client';

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

  // POST /api/v1/onboarding/start
  async start(user: AuthUser, dto: StartOnboardingDto) {
    const messId = await this.resolveMessId(user, dto.messId);

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

      await this.prisma.onboardingEvent.create({
        data: {
          sessionId: session.id,
          stage: OnboardingStage.PHONE_VERIFICATION,
          eventType: 'ENTERED',
        },
      });
    }

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

  // GET /api/v1/onboarding/status
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

  // GET /api/v1/onboarding/progress
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

  // POST /api/v1/onboarding/resume
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

  // PATCH /api/v1/onboarding/stage
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

  // POST /api/v1/onboarding/complete
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
}
