import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateWebsiteDto } from './dto/website.dto';
import {
  GenerationJobStatus,
  OnboardingStage,
  ProvisioningStatus,
  WebsiteStatus,
} from '@prisma/client';
import { WebsiteProvisioningService } from './provisioning/website-provisioning.service';

type AuthUser = { id: string; role: string };

@Injectable()
export class WebsitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioningService: WebsiteProvisioningService,
  ) {}

  private async assertOwnership(userId: string, messId: string) {
    const profile = await this.prisma.messAdminProfile.findFirst({
      where: { userId, messes: { some: { id: messId } } },
    });
    if (!profile) throw new ForbiddenException('You do not own this business');
  }

  private async resolveMessId(user: AuthUser, messId?: string): Promise<string> {
    if (messId) {
      if (user.role !== 'SUPERADMIN') {
        await this.assertOwnership(user.id, messId);
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

  // GET /api/v1/websites/subdomain/check?name=<slug>
  async checkSubdomainAvailability(name: string, user?: AuthUser) {
    let excludeMessId: string | undefined = undefined;
    if (user) {
      try {
        excludeMessId = await this.resolveMessId(user);
      } catch {
        // User may not have registered a mess yet; proceed without exclusion
      }
    }
    return this.provisioningService.checkAvailability(name, excludeMessId);
  }

  // POST /api/v1/websites/generate
  async generate(user: AuthUser, dto: GenerateWebsiteDto) {
    const messId = await this.resolveMessId(user, dto.messId);
    const mess = await this.prisma.mess.findUnique({
      where: { id: messId },
      include: { businessBranding: true, businessLocation: true },
    });

    if (!mess) throw new NotFoundException('Business not found');

    // 1. Reserve subdomain atomically via provisioning service
    const { websiteId, slug, websiteUrl } =
      await this.provisioningService.reserveSubdomain(messId, dto.subdomain);

    // 2. Track real generation job lifecycle: PENDING -> GENERATING -> COMPLETED
    const startedAt = new Date();
    const job = await this.prisma.websiteGenerationJob.create({
      data: {
        websiteId,
        status: GenerationJobStatus.GENERATING,
        startedAt,
      },
    });

    // 3. Apply branding theme if specified
    if (dto.theme) {
      await this.prisma.businessBranding.upsert({
        where: { messId },
        create: { messId, theme: dto.theme },
        update: { theme: dto.theme },
      });
    }

    // 4. Mark generation job as completed
    const completedAt = new Date();
    const updatedJob = await this.prisma.websiteGenerationJob.update({
      where: { id: job.id },
      data: {
        status: GenerationJobStatus.COMPLETED,
        completedAt,
      },
    });

    // 5. Advance onboarding stage
    await this.advanceOnboarding(user.id, messId, OnboardingStage.WEBSITE_GENERATION);

    return {
      success: true,
      message: 'Website generated and subdomain reserved successfully',
      data: {
        jobId: updatedJob.id,
        websiteId,
        status: updatedJob.status,
        provisioningStatus: ProvisioningStatus.RESERVED,
        slug,
        subdomain: `${slug}.messmeals.com`,
        websiteUrl,
        previewUrl: `${websiteUrl}?preview=true`,
        startedAt: updatedJob.startedAt,
        generatedAt: updatedJob.completedAt,
      },
    };
  }

  // GET /api/v1/websites/generation/:jobId
  async getJob(jobId: string) {
    const job = await this.prisma.websiteGenerationJob.findUnique({
      where: { id: jobId },
      include: { website: true },
    });

    if (!job) throw new NotFoundException('Generation job not found');

    return {
      success: true,
      message: 'Generation job status retrieved',
      data: {
        jobId: job.id,
        websiteId: job.websiteId,
        status: job.status,
        progress:
          job.status === GenerationJobStatus.COMPLETED
            ? 100
            : job.status === GenerationJobStatus.GENERATING
              ? 60
              : job.status === GenerationJobStatus.PENDING
                ? 20
                : 0,
        slug: job.website.slug,
        subdomain: `${job.website.slug}.messmeals.com`,
        websiteUrl: job.website.websiteUrl,
        previewUrl: `${job.website.websiteUrl}?preview=true`,
        provisioningStatus: job.website.provisioningStatus,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        errorMessage: job.errorMessage,
      },
    };
  }

  // GET /api/v1/websites/me
  async getMyWebsite(user: AuthUser) {
    const messId = await this.resolveMessId(user);
    const website = await this.prisma.website.findUnique({
      where: { messId },
      include: {
        mess: {
          select: {
            id: true,
            name: true,
            slug: true,
            is_active: true,
            businessLocation: true,
            businessBranding: true,
          },
        },
        customDomains: {
          where: { status: { not: 'DISCONNECTED' } },
        },
      },
    });

    if (!website) {
      return {
        success: true,
        message: 'No website generated yet for this business',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Website retrieved successfully',
      data: {
        ...website,
        subdomain: `${website.slug}.messmeals.com`,
      },
    };
  }

  // GET /api/v1/websites/:id
  async findOne(user: AuthUser, id: string) {
    const website = await this.prisma.website.findUnique({
      where: { id },
      include: {
        mess: {
          select: {
            id: true,
            name: true,
            slug: true,
            is_active: true,
            businessLocation: true,
            businessBranding: true,
          },
        },
        customDomains: {
          where: { status: { not: 'DISCONNECTED' } },
        },
      },
    });

    if (!website) throw new NotFoundException('Website not found');

    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, website.messId);
    }

    return {
      success: true,
      message: 'Website retrieved successfully',
      data: {
        ...website,
        subdomain: `${website.slug}.messmeals.com`,
      },
    };
  }

  // POST /api/v1/websites/:id/publish
  async publish(user: AuthUser, id: string) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) throw new NotFoundException('Website not found');

    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, website.messId);
    }

    // 1. Activate subdomain
    await this.provisioningService.activateSubdomain(website.id);

    // 2. Publish website record
    const updated = await this.prisma.website.update({
      where: { id },
      data: {
        status: WebsiteStatus.PUBLISHED,
        provisioningStatus: ProvisioningStatus.ACTIVE,
        publishedAt: new Date(),
      },
    });

    // 3. Activate the mess business on the platform
    await this.prisma.mess.update({
      where: { id: website.messId },
      data: { is_active: true },
    });

    // 4. Advance onboarding
    await this.advanceOnboarding(user.id, website.messId, OnboardingStage.COMPLETED);

    return {
      success: true,
      message: 'Website published successfully! Your online storefront is live.',
      data: {
        ...updated,
        subdomain: `${updated.slug}.messmeals.com`,
        isLive: true,
      },
    };
  }

  // POST /api/v1/websites/:id/republish
  async republish(user: AuthUser, id: string) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) throw new NotFoundException('Website not found');

    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, website.messId);
    }

    const updated = await this.prisma.website.update({
      where: { id },
      data: {
        status: WebsiteStatus.PUBLISHED,
        provisioningStatus: ProvisioningStatus.ACTIVE,
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Website republished successfully with latest menu and plan updates',
      data: {
        ...updated,
        subdomain: `${updated.slug}.messmeals.com`,
      },
    };
  }

  // GET /api/v1/websites/:id/status
  async getStatus(user: AuthUser, id: string) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) throw new NotFoundException('Website not found');

    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, website.messId);
    }

    return {
      success: true,
      message: 'Website status retrieved',
      data: {
        websiteId: website.id,
        slug: website.slug,
        subdomain: `${website.slug}.messmeals.com`,
        status: website.status,
        provisioningStatus: website.provisioningStatus,
        subdomainReservedAt: website.subdomainReservedAt,
        websiteUrl: website.websiteUrl,
        publishedAt: website.publishedAt,
        isPublished: website.status === WebsiteStatus.PUBLISHED,
      },
    };
  }

  private async advanceOnboarding(userId: string, messId: string, stage: OnboardingStage) {
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
