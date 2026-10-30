import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBusinessDto, UpdateBusinessDto } from './dto/business.dto';
import { generateUniqueMessSlug } from 'src/common/utility/slug.util';

type AuthUser = { id: string; role: string; messIds?: string[]; messAdminProfileId?: string };

@Injectable()
export class BusinessesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwnership(userId: string, messId: string) {
    const profile = await this.prisma.messAdminProfile.findFirst({
      where: { userId, messes: { some: { id: messId } } },
    });
    if (!profile) throw new ForbiddenException('You do not own this business');
  }

  // POST /api/v1/businesses
  async create(user: AuthUser, dto: CreateBusinessDto) {
    let adminProfile = await this.prisma.messAdminProfile.findUnique({
      where: { userId: user.id },
      include: { messes: true },
    });

    if (!adminProfile) {
      adminProfile = await this.prisma.messAdminProfile.create({
        data: { userId: user.id },
        include: { messes: true },
      });
    }

    // Check if user already has a mess without a name (placeholder from OTP verify)
    const placeholder = adminProfile.messes.find((m) => m.name === '' || !m.name);
    if (placeholder) {
      const slug = await generateUniqueMessSlug(this.prisma, dto.name);
      const updated = await this.prisma.mess.update({
        where: { id: placeholder.id },
        data: {
          name: dto.name,
          slug,
          phone: dto.phone,
          email: dto.email,
        },
      });

      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.ownerName, email: dto.email },
      });

      await this.advanceOnboarding(user.id, placeholder.id, 'BUSINESS_DETAILS');
      return {
        success: true,
        message: 'Business registered successfully',
        data: this.formatBusiness(updated),
      };
    }

    // Check duplicate email
    const existing = await this.prisma.mess.findFirst({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('A business with this email already exists');
    }

    const slug = await generateUniqueMessSlug(this.prisma, dto.name);
    const mess = await this.prisma.$transaction(async (tx) => {
      const newMess = await tx.mess.create({
        data: {
          name: dto.name,
          slug,
          phone: dto.phone,
          email: dto.email,
          is_verified: false,
          messAdmins: { connect: { id: adminProfile.id } },
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { name: dto.ownerName, email: dto.email },
      });
      return newMess;
    });

    await this.advanceOnboarding(user.id, mess.id, 'BUSINESS_DETAILS');
    return {
      success: true,
      message: 'Business registered successfully',
      data: this.formatBusiness(mess),
    };
  }

  // GET /api/v1/businesses/me
  async getMyBusiness(user: AuthUser) {
    const profile = await this.prisma.messAdminProfile.findUnique({
      where: { userId: user.id },
      include: {
        messes: {
          include: {
            businessLocation: true,
            businessBranding: true,
            website: true,
            onboardingSession: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!profile || profile.messes.length === 0) {
      return { success: true, message: 'No business found', data: null };
    }

    const mess = profile.messes[0];
    return { success: true, message: 'Business retrieved', data: this.formatBusiness(mess) };
  }

  // GET /api/v1/businesses/:id
  async findOne(user: AuthUser, messId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }
    const mess = await this.prisma.mess.findUnique({
      where: { id: messId },
      include: {
        businessLocation: true,
        businessBranding: true,
        website: true,
        onboardingSession: true,
      },
    });

    if (!mess) {
      throw new NotFoundException('Business not found');
    }

    return { success: true, message: 'Business retrieved', data: this.formatBusiness(mess) };
  }

  // PATCH /api/v1/businesses/:id
  async update(user: AuthUser, messId: string, dto: UpdateBusinessDto) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const existing = await this.prisma.mess.findUnique({ where: { id: messId } });
    if (!existing) {
      throw new NotFoundException('Business not found');
    }

    const updateData: any = {};
    if (dto.name) {
      updateData.name = dto.name;
      updateData.slug = await generateUniqueMessSlug(this.prisma, dto.name);
    }
    if (dto.email) updateData.email = dto.email;
    if (dto.phone) updateData.phone = dto.phone;

    const mess = await this.prisma.mess.update({
      where: { id: messId },
      data: updateData,
    });

    if (dto.ownerName) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { name: dto.ownerName },
      });
    }

    return { success: true, message: 'Business updated successfully', data: this.formatBusiness(mess) };
  }

  private formatBusiness(mess: any) {
    return {
      id: mess.id,
      name: mess.name,
      slug: mess.slug,
      phone: mess.phone,
      email: mess.email,
      isVerified: mess.is_verified,
      isActive: mess.is_active,
      location: mess.businessLocation ?? null,
      branding: mess.businessBranding ?? null,
      website: mess.website ?? null,
      onboarding: mess.onboardingSession
        ? {
            currentStage: mess.onboardingSession.currentStage,
            status: mess.onboardingSession.status,
            completedStages: mess.onboardingSession.completedStages,
          }
        : null,
      createdAt: mess.createdAt,
      updatedAt: mess.updatedAt,
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
