import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CustomDomainStatus, WebsiteStatus } from '@prisma/client';
import { RESERVED_SUBDOMAINS } from './website-provisioning.service';

@Injectable()
export class WebsiteHostnameResolverService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Cleans a raw hostname header by stripping port and converting to lowercase.
   */
  sanitizeHostname(rawHost: string): string {
    if (!rawHost) return '';
    // Strip port if present (e.g., "annapoorna.messmeals.com:3011" -> "annapoorna.messmeals.com")
    return rawHost.split(':')[0].trim().toLowerCase();
  }

  /**
   * Resolves a public storefront by incoming HTTP request hostname.
   * Works for both:
   * 1. Subdomains: e.g. "annapoorna.messmeals.com" or "annapoorna.localhost"
   * 2. Verified Custom Domains: e.g. "order.annapoornamess.in"
   */
  async resolveStorefront(rawHostname: string) {
    const hostname = this.sanitizeHostname(rawHostname);

    if (!hostname) {
      throw new BadRequestException('Hostname header is required');
    }

    let websiteSlug: string | null = null;
    let customDomainName: string | null = null;

    // Pattern 1: Platform Subdomain (*.messmeals.com or *.localhost for dev)
    const platformDomainMatch = hostname.match(/^([a-z0-9-]+)\.(messmeals\.com|localhost)$/);

    if (platformDomainMatch) {
      const sub = platformDomainMatch[1];
      if (RESERVED_SUBDOMAINS.has(sub)) {
        throw new NotFoundException(`The subdomain "${sub}" is a reserved system address`);
      }
      websiteSlug = sub;
    } else {
      // Pattern 2: Custom domain lookup
      const customDomainRecord = await this.prisma.customDomain.findFirst({
        where: {
          domain: hostname,
          status: CustomDomainStatus.ACTIVE,
        },
        include: {
          website: { select: { slug: true } },
        },
      });

      if (customDomainRecord) {
        websiteSlug = customDomainRecord.website.slug;
        customDomainName = customDomainRecord.domain;
      }
    }

    if (!websiteSlug) {
      throw new NotFoundException(`No registered website found for host: ${hostname}`);
    }

    // Load website and associated active mess
    const website = await this.prisma.website.findFirst({
      where: {
        slug: websiteSlug,
        status: WebsiteStatus.PUBLISHED,
      },
      include: {
        mess: {
          include: {
            businessBranding: {
              include: {
                galleryItems: true,
              },
            },
            businessLocation: true,
            images: true,
            foodTypes: true,
            tags: true,
            District: { select: { id: true, name: true } },
            Testimonials: {
              where: { isActive: true },
              take: 10,
              orderBy: { createdAt: 'desc' },
              include: {
                customer: {
                  include: {
                    user: { select: { name: true } },
                  },
                },
              },
            },
            menus: {
              where: { isActive: true },
            },
            plans: {
              where: { isActive: true, deletedAt: null },
              include: {
                images: true,
                Variation: { where: { isActive: true } },
                menus: { where: { isActive: true } },
              },
            },
          },
        },
      },
    });

    if (!website || !website.mess || !website.mess.is_active) {
      throw new NotFoundException(
        `Website for "${websiteSlug}" is either unpublished, suspended, or does not exist`,
      );
    }

    const { mess } = website;
    const branding = mess.businessBranding;
    const cover = mess.images.find((img) => img.isCover) ?? mess.images[0];

    return {
      success: true,
      message: 'Storefront loaded successfully',
      data: {
        storefront: {
          websiteId: website.id,
          slug: website.slug,
          subdomain: `${website.slug}.messmeals.com`,
          websiteUrl: website.websiteUrl,
          customDomain: customDomainName,
          publishedAt: website.publishedAt,
        },
        mess: {
          id: mess.id,
          name: mess.name,
          slug: mess.slug,
          description: mess.description,
          phone: mess.phone,
          email: mess.email,
          openingHours: mess.openingHours,
          features: mess.features,
          logo: branding?.logoUrl ?? mess.icon ?? null,
          coverImage: branding?.coverUrl ?? cover?.url ?? null,
          location: mess.businessLocation
            ? {
                building: mess.businessLocation.building,
                area: mess.businessLocation.area,
                city: mess.businessLocation.city,
                state: mess.businessLocation.state,
                postalCode: mess.businessLocation.postalCode,
                country: mess.businessLocation.country,
                currency: mess.businessLocation.currency,
                timezone: mess.businessLocation.timezone,
              }
            : {
                address: mess.address,
                location: mess.location,
                zipcode: mess.zipcode,
                district: mess.District?.name,
              },
          status: {
            isVerified: mess.is_verified,
            isFeatured: mess.isFeatured,
            isPremium: mess.isPremium,
          },
          foodTypes: mess.foodTypes.map((f) => f.foodType),
          tags: mess.tags.map((t) => t.tag),
        },
        branding: branding
          ? {
              displayName: branding.displayName || mess.name,
              theme: branding.theme,
              primaryColor: branding.primaryColor || '#E65100',
              secondaryColor: branding.secondaryColor || '#FFB74D',
              logoUrl: branding.logoUrl,
              coverUrl: branding.coverUrl,
              gallery: branding.galleryItems.map((g) => ({
                id: g.id,
                url: g.url,
                altText: g.altText,
              })),
            }
          : {
              displayName: mess.name,
              theme: 'DEFAULT',
              primaryColor: '#E65100',
              secondaryColor: '#FFB74D',
              logoUrl: mess.icon ?? null,
              coverUrl: cover?.url ?? null,
              gallery: [],
            },
        menus: mess.menus.map((m) => ({
          id: m.id,
          name: m.name,
          schedule: m.schedule,
        })),
        plans: mess.plans.map((plan) => ({
          id: plan.id,
          planName: plan.planName,
          description: plan.description,
          price: plan.price,
          minPrice: plan.minPrice,
          isMonthlyPlan: plan.isMonthlyPlan,
          isDailyPlan: plan.isDailyPlan,
          scheduleType: plan.scheduleType,
          availableDays: plan.availableDays,
          images: plan.images.map((img) => ({
            id: img.id,
            url: img.url,
            altText: img.altText,
          })),
          variations: plan.Variation.map((v) => ({
            id: v.id,
            title: v.title,
            description: v.description,
          })),
          menus: plan.menus.map((menu) => ({
            id: menu.id,
            name: menu.name,
            schedule: menu.schedule,
          })),
        })),
        testimonials: mess.Testimonials.map((t) => ({
          id: t.id,
          name: t.customer?.user?.name ?? 'Verified Customer',
          review: t.reviews,
          rating: t.ratings,
          createdAt: t.createdAt,
        })),
      },
    };
  }
}

