import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ClaimOfferDto } from './dto/offer.dto';
import { OfferClaimStatus } from '@prisma/client';

type AuthUser = { id: string; role: string };

@Injectable()
export class OffersService {
  constructor(private readonly prisma: PrismaService) {}

  private async getOrCreateDefaultConfig() {
    let config = await this.prisma.websiteOfferConfig.findFirst({
      where: { isEnabled: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!config) {
      config = await this.prisma.websiteOfferConfig.create({
        data: {
          maxClaims: 200,
          originalPrice: 9999.0,
          promoPrice: 0.0,
          isEnabled: true,
          totalClaimed: 0,
        },
      });
    }

    return config;
  }

  private async resolveMessId(user: AuthUser, messId?: string): Promise<string> {
    if (messId) {
      const profile = await this.prisma.messAdminProfile.findFirst({
        where: { userId: user.id, messes: { some: { id: messId } } },
      });
      if (!profile && user.role !== 'SUPERADMIN') {
        throw new BadRequestException('You do not have access to this business');
      }
      return messId;
    }

    const profile = await this.prisma.messAdminProfile.findUnique({
      where: { userId: user.id },
      include: { messes: { orderBy: { createdAt: 'desc' } } },
    });

    if (!profile || profile.messes.length === 0) {
      throw new NotFoundException('No business found. Please register business first.');
    }

    return profile.messes[0].id;
  }

  // GET /api/v1/offers/website/eligibility
  async getEligibility(user: AuthUser, messIdQuery?: string) {
    const config = await this.getOrCreateDefaultConfig();
    let messId: string | null = null;
    try {
      messId = await this.resolveMessId(user, messIdQuery);
    } catch {
      // If user hasn't created a mess yet, they can still view offer terms
    }

    let existingClaim: any = null;
    if (messId) {
      existingClaim = await this.prisma.websiteOfferClaim.findUnique({
        where: { messId },
      });
    }

    const spotsRemaining = Math.max(0, config.maxClaims - config.totalClaimed);
    const isSpotsAvailable = spotsRemaining > 0;
    const isEligible = !existingClaim && isSpotsAvailable && config.isEnabled;

    return {
      success: true,
      message: 'Offer eligibility retrieved',
      data: {
        isEligible,
        status: existingClaim ? existingClaim.status : 'AVAILABLE',
        spotsRemaining,
        maxClaims: config.maxClaims,
        totalClaimed: config.totalClaimed,
        originalPrice: Number(config.originalPrice),
        promoPrice: Number(config.promoPrice),
        currency: 'INR',
        savings: Number(config.originalPrice) - Number(config.promoPrice),
      },
    };
  }

  // POST /api/v1/offers/website/claim
  async claimOffer(user: AuthUser, dto: ClaimOfferDto) {
    const messId = await this.resolveMessId(user, dto.messId);
    const config = await this.getOrCreateDefaultConfig();

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.websiteOfferClaim.findUnique({ where: { messId } });
      if (existing) {
        if (existing.status === OfferClaimStatus.CLAIMED) {
          throw new ConflictException('This business has already claimed the website offer');
        }
      }

      if (config.totalClaimed >= config.maxClaims) {
        throw new BadRequestException('All promotional website spots have been claimed');
      }

      const claim = await tx.websiteOfferClaim.upsert({
        where: { messId },
        create: {
          userId: user.id,
          messId,
          configId: config.id,
          status: OfferClaimStatus.CLAIMED,
          claimedAt: new Date(),
        },
        update: {
          status: OfferClaimStatus.CLAIMED,
          claimedAt: new Date(),
        },
      });

      await tx.websiteOfferConfig.update({
        where: { id: config.id },
        data: { totalClaimed: { increment: 1 } },
      });

      await this.advanceOnboarding(user.id, messId, 'WEBSITE_OFFER');

      return {
        success: true,
        message: 'Website offer claimed successfully! You unlocked a free website.',
        data: claim,
      };
    });
  }

  // POST /api/v1/offers/website/dismiss
  async dismissOffer(user: AuthUser, dto: ClaimOfferDto) {
    const messId = await this.resolveMessId(user, dto.messId);
    const config = await this.getOrCreateDefaultConfig();

    const claim = await this.prisma.websiteOfferClaim.upsert({
      where: { messId },
      create: {
        userId: user.id,
        messId,
        configId: config.id,
        status: OfferClaimStatus.DISMISSED,
      },
      update: {
        status: OfferClaimStatus.DISMISSED,
      },
    });

    await this.advanceOnboarding(user.id, messId, 'WEBSITE_OFFER');

    return {
      success: true,
      message: 'Website offer dismissed',
      data: claim,
    };
  }

  // GET /api/v1/offers/website/status
  async getStatus(user: AuthUser, messIdQuery?: string) {
    const messId = await this.resolveMessId(user, messIdQuery);
    const claim = await this.prisma.websiteOfferClaim.findUnique({
      where: { messId },
    });

    return {
      success: true,
      message: 'Offer status retrieved',
      data: {
        messId,
        status: claim ? claim.status : 'NOT_CLAIMED',
        claimedAt: claim?.claimedAt ?? null,
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
