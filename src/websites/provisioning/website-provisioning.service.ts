import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ProvisioningStatus, WebsiteStatus } from '@prisma/client';

export const RESERVED_SUBDOMAINS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'dashboard',
  'mail',
  'support',
  'staging',
  'assets',
  'static',
  'open',
  'auth',
  'webhook',
  'cdn',
  'test',
  'superadmin',
  'status',
  'docs',
  'blog',
  'billing',
  'graphql',
  'login',
  'signup',
  'register',
  'root',
  'help',
  'account',
  'security',
]);

const SUBDOMAIN_REGEX = /^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;

@Injectable()
export class WebsiteProvisioningService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Normalizes a raw input string to a valid subdomain slug:
   * trims, converts to lowercase, strips leading/trailing dashes and domain extensions.
   */
  normalizeSubdomain(raw: string): string {
    if (!raw) return '';
    let normalized = raw.trim().toLowerCase();
    // If user entered "sub.messmeals.com", extract just "sub"
    normalized = normalized.replace(/\.messmeals\.com$/, '');
    // Replace spaces and underscores with hyphens
    normalized = normalized.replace(/[\s_]+/g, '-');
    // Strip characters that are not alphanumeric or hyphen
    normalized = normalized.replace(/[^a-z0-9-]/g, '');
    // Collapse consecutive hyphens
    normalized = normalized.replace(/-+/g, '-');
    // Strip leading and trailing hyphens
    normalized = normalized.replace(/^-+|-+$/g, '');
    return normalized;
  }

  /**
   * Validates subdomain format and length according to RFC 1123 DNS standards.
   */
  validateSubdomainFormat(slug: string): { valid: boolean; reason?: string } {
    if (!slug || slug.length < 2) {
      return { valid: false, reason: 'Subdomain must be at least 2 characters long' };
    }
    if (slug.length > 63) {
      return { valid: false, reason: 'Subdomain cannot exceed 63 characters' };
    }
    if (!SUBDOMAIN_REGEX.test(slug)) {
      return {
        valid: false,
        reason:
          'Subdomain can only contain lowercase letters, numbers, and hyphens, and cannot start or end with a hyphen',
      };
    }
    return { valid: true };
  }

  /**
   * Checks whether a given subdomain is available for registration.
   */
  async checkAvailability(
    rawName: string,
    excludeMessId?: string,
  ): Promise<{
    available: boolean;
    normalized: string;
    subdomainUrl: string;
    reason?: string;
  }> {
    const normalized = this.normalizeSubdomain(rawName);
    const subdomainUrl = `https://${normalized}.messmeals.com`;

    // 1. Format validation
    const formatCheck = this.validateSubdomainFormat(normalized);
    if (!formatCheck.valid) {
      return {
        available: false,
        normalized,
        subdomainUrl,
        reason: formatCheck.reason,
      };
    }

    // 2. Reserved keyword check
    if (RESERVED_SUBDOMAINS.has(normalized)) {
      return {
        available: false,
        normalized,
        subdomainUrl,
        reason: `The name "${normalized}" is a reserved system subdomain and cannot be registered`,
      };
    }

    // 3. Database uniqueness check on Website table
    const existingWebsite = await this.prisma.website.findFirst({
      where: {
        slug: normalized,
        ...(excludeMessId ? { messId: { not: excludeMessId } } : {}),
      },
      select: { id: true, messId: true },
    });

    if (existingWebsite) {
      return {
        available: false,
        normalized,
        subdomainUrl,
        reason: `Subdomain "${normalized}.messmeals.com" is already registered by another restaurant`,
      };
    }

    // 4. Database uniqueness check on Mess slug
    const existingMess = await this.prisma.mess.findFirst({
      where: {
        slug: normalized,
        ...(excludeMessId ? { id: { not: excludeMessId } } : {}),
      },
      select: { id: true },
    });

    if (existingMess) {
      return {
        available: false,
        normalized,
        subdomainUrl,
        reason: `Subdomain "${normalized}.messmeals.com" is already reserved`,
      };
    }

    // 5. Check against custom domains
    const existingCustomDomain = await this.prisma.customDomain.findFirst({
      where: { domain: normalized },
    });

    if (existingCustomDomain) {
      return {
        available: false,
        normalized,
        subdomainUrl,
        reason: `Domain name "${normalized}" is currently registered as a custom domain`,
      };
    }

    return {
      available: true,
      normalized,
      subdomainUrl,
    };
  }

  /**
   * Atomically reserves a subdomain for a restaurant and returns the reserved Website record.
   * If requestedSlug is passed, validates and claims it.
   * Otherwise uses/generates a clean slug from the Mess.
   */
  async reserveSubdomain(
    messId: string,
    requestedSlug?: string,
  ): Promise<{ websiteId: string; slug: string; websiteUrl: string }> {
    const mess = await this.prisma.mess.findUnique({
      where: { id: messId },
      include: { website: true },
    });

    if (!mess) {
      throw new NotFoundException('Restaurant not found');
    }

    let targetSlug: string;

    if (requestedSlug) {
      const avail = await this.checkAvailability(requestedSlug, messId);
      if (!avail.available) {
        throw new ConflictException(avail.reason || 'Requested subdomain is unavailable');
      }
      targetSlug = avail.normalized;
    } else if (mess.website?.slug) {
      targetSlug = mess.website.slug;
    } else if (mess.slug) {
      const avail = await this.checkAvailability(mess.slug, messId);
      targetSlug = avail.available ? avail.normalized : `${this.normalizeSubdomain(mess.slug)}-${mess.id.substring(0, 4)}`;
    } else {
      const baseSlug = this.normalizeSubdomain(mess.name) || 'mess';
      const avail = await this.checkAvailability(baseSlug, messId);
      targetSlug = avail.available ? baseSlug : `${baseSlug}-${mess.id.substring(0, 6)}`;
    }

    const domain = `${targetSlug}.messmeals.com`;
    const websiteUrl = `https://${domain}`;

    // Atomic transaction for reservation
    const website = await this.prisma.$transaction(async (tx) => {
      // Keep mess.slug in sync with website slug
      if (mess.slug !== targetSlug) {
        await tx.mess.update({
          where: { id: messId },
          data: { slug: targetSlug },
        });
      }

      return tx.website.upsert({
        where: { messId },
        create: {
          messId,
          slug: targetSlug,
          websiteUrl,
          status: WebsiteStatus.GENERATED,
          provisioningStatus: ProvisioningStatus.RESERVED,
          subdomainReservedAt: new Date(),
        },
        update: {
          slug: targetSlug,
          websiteUrl,
          provisioningStatus: ProvisioningStatus.RESERVED,
          subdomainReservedAt: new Date(),
        },
      });
    });

    return {
      websiteId: website.id,
      slug: website.slug,
      websiteUrl: website.websiteUrl ?? websiteUrl,
    };
  }

  /**
   * Activates a subdomain upon successful website publishing.
   */
  async activateSubdomain(websiteId: string): Promise<void> {
    await this.prisma.website.update({
      where: { id: websiteId },
      data: {
        provisioningStatus: ProvisioningStatus.ACTIVE,
      },
    });
  }
}

