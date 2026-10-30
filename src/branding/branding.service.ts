import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { S3Service } from 'src/s3/s3.service';
import { UpdateBrandingDto } from './dto/branding.dto';
import { WebsiteTheme } from '@prisma/client';

type AuthUser = { id: string; role: string };

@Injectable()
export class BrandingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
  ) {}

  private async assertOwnership(userId: string, messId: string) {
    const profile = await this.prisma.messAdminProfile.findFirst({
      where: { userId, messes: { some: { id: messId } } },
    });
    if (!profile) throw new ForbiddenException('You do not own this business');
  }

  // GET /api/v1/businesses/:id/branding
  async getBranding(user: AuthUser, messId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const branding = await this.prisma.businessBranding.findUnique({
      where: { messId },
      include: {
        galleryItems: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!branding) {
      return {
        success: true,
        message: 'No branding configured yet',
        data: {
          messId,
          theme: WebsiteTheme.DEFAULT,
          primaryColor: null,
          secondaryColor: null,
          logoUrl: null,
          coverUrl: null,
          galleryItems: [],
        },
      };
    }

    return {
      success: true,
      message: 'Branding retrieved successfully',
      data: branding,
    };
  }

  // PUT /api/v1/businesses/:id/branding
  async updateBranding(user: AuthUser, messId: string, dto: UpdateBrandingDto) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const mess = await this.prisma.mess.findUnique({ where: { id: messId } });
    if (!mess) throw new NotFoundException('Business not found');

    const updateData: any = {};
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName;
    if (dto.theme !== undefined) updateData.theme = dto.theme;
    if (dto.primaryColor !== undefined) updateData.primaryColor = dto.primaryColor;
    if (dto.secondaryColor !== undefined) updateData.secondaryColor = dto.secondaryColor;
    if (dto.logoUrl !== undefined) updateData.logoUrl = dto.logoUrl;
    if (dto.logoKey !== undefined) updateData.logoKey = dto.logoKey;
    if (dto.coverUrl !== undefined) updateData.coverUrl = dto.coverUrl;
    if (dto.coverKey !== undefined) updateData.coverKey = dto.coverKey;

    const branding = await this.prisma.businessBranding.upsert({
      where: { messId },
      create: {
        messId,
        displayName: dto.displayName ?? mess.name,
        theme: dto.theme ?? WebsiteTheme.DEFAULT,
        primaryColor: dto.primaryColor ?? null,
        secondaryColor: dto.secondaryColor ?? null,
        logoUrl: dto.logoUrl ?? null,
        logoKey: dto.logoKey ?? null,
        coverUrl: dto.coverUrl ?? null,
        coverKey: dto.coverKey ?? null,
      },
      update: updateData,
    });

    if (dto.logoUrl) {
      await this.prisma.mess.update({
        where: { id: messId },
        data: { icon: dto.logoUrl },
      });
    }

    if (dto.galleryItems && Array.isArray(dto.galleryItems)) {
      for (const item of dto.galleryItems) {
        await this.prisma.brandingGallery.create({
          data: {
            brandingId: branding.id,
            url: item.url,
            s3Key: item.s3Key || null,
            altText: item.altText || null,
            sortOrder: item.sortOrder ?? 0,
          },
        });
      }
    }

    const fullBranding = await this.prisma.businessBranding.findUnique({
      where: { id: branding.id },
      include: {
        galleryItems: { orderBy: { sortOrder: 'asc' } },
      },
    });

    await this.advanceOnboarding(user.id, messId, 'BRANDING');

    return {
      success: true,
      message: 'Branding updated successfully',
      data: fullBranding,
    };
  }

  // DELETE /api/v1/businesses/:id/branding/logo
  async deleteLogo(user: AuthUser, messId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const branding = await this.prisma.businessBranding.findUnique({ where: { messId } });
    if (!branding || !branding.logoUrl) {
      return { success: true, message: 'No logo to delete' };
    }

    if (branding.logoKey) {
      try {
        await this.s3Service.deleteFile(branding.logoUrl);
      } catch {
        // ignore s3 deletion error if not found
      }
    }

    await this.prisma.businessBranding.update({
      where: { messId },
      data: { logoUrl: null, logoKey: null },
    });

    await this.prisma.mess.update({
      where: { id: messId },
      data: { icon: null },
    });

    return { success: true, message: 'Logo deleted successfully' };
  }

  // DELETE /api/v1/businesses/:id/branding/cover
  async deleteCover(user: AuthUser, messId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const branding = await this.prisma.businessBranding.findUnique({ where: { messId } });
    if (!branding || !branding.coverUrl) {
      return { success: true, message: 'No cover image to delete' };
    }

    if (branding.coverKey) {
      try {
        await this.s3Service.deleteFile(branding.coverUrl);
      } catch {
        // ignore s3 deletion error if not found
      }
    }

    await this.prisma.businessBranding.update({
      where: { messId },
      data: { coverUrl: null, coverKey: null },
    });

    return { success: true, message: 'Cover image deleted successfully' };
  }

  // GET /api/v1/businesses/:id/branding/gallery/:imageId
  async getGalleryItem(user: AuthUser, messId: string, imageId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const item = await this.prisma.brandingGallery.findFirst({
      where: { id: imageId, branding: { messId } },
    });

    if (!item) throw new NotFoundException('Gallery image not found');

    return { success: true, message: 'Gallery item retrieved', data: item };
  }

  // DELETE /api/v1/businesses/:id/branding/gallery/:imageId
  async deleteGalleryItem(user: AuthUser, messId: string, imageId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const item = await this.prisma.brandingGallery.findFirst({
      where: { id: imageId, branding: { messId } },
    });

    if (!item) throw new NotFoundException('Gallery image not found');

    if (item.url) {
      try {
        await this.s3Service.deleteFile(item.url);
      } catch {
        // ignore s3 deletion error
      }
    }

    await this.prisma.brandingGallery.delete({ where: { id: imageId } });

    return { success: true, message: 'Gallery image deleted successfully' };
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
