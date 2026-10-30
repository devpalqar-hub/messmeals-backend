import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { GenerateWebsiteDto } from './dto/website.dto';
import { GenerationJobStatus, WebsiteStatus } from '@prisma/client';

type AuthUser = { id: string; role: string };

@Injectable()
export class WebsitesService {
  constructor(private readonly prisma: PrismaService) {}

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

  // POST /api/v1/websites/generate
  async generate(user: AuthUser, dto: GenerateWebsiteDto) {
    const messId = await this.resolveMessId(user, dto.messId);
    const mess = await this.prisma.mess.findUnique({
      where: { id: messId },
      include: { businessBranding: true, businessLocation: true },
    });

    if (!mess) throw new NotFoundException('Business not found');

    const slug = mess.slug || `mess-${mess.id.substring(0, 8)}`;
    const domain = dto.customDomain || `${slug}.messmeals.com`;
    const websiteUrl = `https://${domain}`;

    const website = await this.prisma.website.upsert({
      where: { messId },
      create: {
        messId,
        slug,
        websiteUrl,
        status: WebsiteStatus.GENERATED,
      },
      update: {
        slug,
        websiteUrl,
        status: WebsiteStatus.GENERATED,
      },
    });

    const job = await this.prisma.websiteGenerationJob.create({
      data: {
        websiteId: website.id,
        status: GenerationJobStatus.COMPLETED,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    if (dto.theme) {
      await this.prisma.businessBranding.upsert({
        where: { messId },
        create: { messId, theme: dto.theme },
        update: { theme: dto.theme },
      });
    }

    await this.advanceOnboarding(user.id, messId, 'WEBSITE_GENERATION');

    return {
      success: true,
      message: 'Website generated successfully',
      data: {
        jobId: job.id,
        websiteId: website.id,
        status: job.status,
        slug: website.slug,
        websiteUrl: website.websiteUrl,
        previewUrl: `${website.websiteUrl}?preview=true`,
        generatedAt: job.completedAt,
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
        progress: job.status === GenerationJobStatus.COMPLETED ? 100 : 50,
        slug: job.website.slug,
        websiteUrl: job.website.websiteUrl,
        previewUrl: `${job.website.websiteUrl}?preview=true`,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
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
          select: { id: true, name: true, slug: true, businessLocation: true, businessBranding: true },
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
      data: website,
    };
  }

  // GET /api/v1/websites/:id
  async findOne(user: AuthUser, id: string) {
    const website = await this.prisma.website.findUnique({
      where: { id },
      include: {
        mess: {
          select: { id: true, name: true, slug: true, businessLocation: true, businessBranding: true },
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
      data: website,
    };
  }

  // POST /api/v1/websites/:id/publish
  async publish(user: AuthUser, id: string) {
    const website = await this.prisma.website.findUnique({ where: { id } });
    if (!website) throw new NotFoundException('Website not found');

    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, website.messId);
    }

    const updated = await this.prisma.website.update({
      where: { id },
      data: {
        status: WebsiteStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });

    await this.advanceOnboarding(user.id, website.messId, 'REVIEW_LAUNCH');

    return {
      success: true,
      message: 'Website published successfully! Your online storefront is live.',
      data: updated,
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
        updatedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Website republished successfully with latest menu and plan updates',
      data: updated,
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
        status: website.status,
        websiteUrl: website.websiteUrl,
        publishedAt: website.publishedAt,
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
