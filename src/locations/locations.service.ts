import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateLocationDto, UpdateLocationDto } from './dto/location.dto';
import { SupportedCountry } from '@prisma/client';

export const COUNTRY_CONFIG: Record<
  SupportedCountry,
  { name: string; currency: string; currencySymbol: string; timezone: string; phoneCode: string }
> = {
  IN: {
    name: 'India',
    currency: 'INR',
    currencySymbol: '₹',
    timezone: 'Asia/Kolkata',
    phoneCode: '+91',
  },
  AE: {
    name: 'United Arab Emirates',
    currency: 'AED',
    currencySymbol: 'AED',
    timezone: 'Asia/Dubai',
    phoneCode: '+971',
  },
  QA: {
    name: 'Qatar',
    currency: 'QAR',
    currencySymbol: 'QAR',
    timezone: 'Asia/Qatar',
    phoneCode: '+974',
  },
};

type AuthUser = { id: string; role: string };

@Injectable()
export class LocationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertOwnership(userId: string, messId: string) {
    const profile = await this.prisma.messAdminProfile.findFirst({
      where: { userId, messes: { some: { id: messId } } },
    });
    if (!profile) throw new ForbiddenException('You do not own this business');
  }

  // GET /api/v1/locations/countries
  getCountries() {
    const countries = Object.entries(COUNTRY_CONFIG).map(([code, meta]) => ({
      code,
      name: meta.name,
      currency: meta.currency,
      currencySymbol: meta.currencySymbol,
      timezone: meta.timezone,
      phoneCode: meta.phoneCode,
    }));

    return {
      success: true,
      message: 'Supported countries retrieved',
      data: countries,
    };
  }

  // GET /api/v1/businesses/:id/location
  async getLocation(user: AuthUser, messId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const location = await this.prisma.businessLocation.findUnique({
      where: { messId },
    });

    if (!location) {
      return {
        success: true,
        message: 'No location configured yet',
        data: null,
      };
    }

    return {
      success: true,
      message: 'Location retrieved successfully',
      data: location,
    };
  }

  // POST /api/v1/businesses/:id/location
  async createLocation(user: AuthUser, messId: string, dto: CreateLocationDto) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const mess = await this.prisma.mess.findUnique({ where: { id: messId } });
    if (!mess) {
      throw new NotFoundException('Business not found');
    }

    const meta = COUNTRY_CONFIG[dto.country];
    const currency = meta.currency;
    const timezone = meta.timezone;

    const location = await this.prisma.businessLocation.upsert({
      where: { messId },
      create: {
        messId,
        country: dto.country,
        currency,
        timezone,
        building: dto.building || null,
        area: dto.area || null,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
      },
      update: {
        country: dto.country,
        currency,
        timezone,
        building: dto.building || null,
        area: dto.area || null,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
      },
    });

    // Update Mess summary fields
    const fullAddress = [dto.building, dto.area, dto.city, dto.state, dto.postalCode]
      .filter(Boolean)
      .join(', ');

    await this.prisma.mess.update({
      where: { id: messId },
      data: {
        address: fullAddress,
        zipcode: dto.postalCode,
      },
    });

    await this.advanceOnboarding(user.id, messId, 'LOCATION_CONFIG');

    return {
      success: true,
      message: 'Business location saved successfully',
      data: location,
    };
  }

  // PATCH /api/v1/businesses/:id/location
  async updateLocation(user: AuthUser, messId: string, dto: UpdateLocationDto) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertOwnership(user.id, messId);
    }

    const existing = await this.prisma.businessLocation.findUnique({ where: { messId } });
    if (!existing) {
      throw new NotFoundException('Business location not found. Create it first.');
    }

    const updateData: any = {};
    if (dto.country) {
      const meta = COUNTRY_CONFIG[dto.country];
      updateData.country = dto.country;
      updateData.currency = meta.currency;
      updateData.timezone = meta.timezone;
    }
    if (dto.building !== undefined) updateData.building = dto.building;
    if (dto.area !== undefined) updateData.area = dto.area;
    if (dto.city) updateData.city = dto.city;
    if (dto.state) updateData.state = dto.state;
    if (dto.postalCode) updateData.postalCode = dto.postalCode;

    const updated = await this.prisma.businessLocation.update({
      where: { messId },
      data: updateData,
    });

    if (dto.postalCode || dto.building || dto.area || dto.city || dto.state) {
      const fullAddress = [
        updated.building,
        updated.area,
        updated.city,
        updated.state,
        updated.postalCode,
      ]
        .filter(Boolean)
        .join(', ');

      await this.prisma.mess.update({
        where: { id: messId },
        data: {
          address: fullAddress,
          zipcode: updated.postalCode,
        },
      });
    }

    return {
      success: true,
      message: 'Business location updated successfully',
      data: updated,
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
