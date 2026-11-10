import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AddCustomDomainDto } from './dto/custom-domain.dto';
import { CustomDomainStatus } from '@prisma/client';
import { promises as dns } from 'dns';
import * as crypto from 'crypto';

type AuthUser = { id: string; role: string };

@Injectable()
export class CustomDomainService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertWebsiteOwnership(userId: string, websiteId: string) {
    const website = await this.prisma.website.findUnique({
      where: { id: websiteId },
      include: {
        mess: {
          include: {
            messAdmins: true,
          },
        },
      },
    });

    if (!website) {
      throw new NotFoundException('Website not found');
    }

    const isOwner = website.mess.messAdmins.some((admin) => admin.userId === userId);
    if (!isOwner) {
      throw new ForbiddenException('You do not own this website');
    }

    return website;
  }

  /**
   * Registers a new custom domain for a website and provides verification instructions.
   */
  async addCustomDomain(user: AuthUser, websiteId: string, dto: AddCustomDomainDto) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertWebsiteOwnership(user.id, websiteId);
    }

    const domain = dto.domain.toLowerCase().trim();

    // Prevent adding platform domain or subdomains as custom domain
    if (domain.endsWith('messmeals.com') || domain === 'localhost') {
      throw new BadRequestException('Cannot use a messmeals.com platform subdomain as a custom domain');
    }

    // Check if domain is already registered anywhere
    const existing = await this.prisma.customDomain.findUnique({
      where: { domain },
      include: { website: true },
    });

    if (existing) {
      if (existing.websiteId === websiteId && existing.status !== CustomDomainStatus.DISCONNECTED) {
        return {
          success: true,
          message: 'Custom domain is already configured for this website',
          data: this.formatDomainResponse(existing),
        };
      }
      throw new ConflictException(`Domain "${domain}" is already registered to another website`);
    }

    // Generate random verification token
    const token = crypto.randomBytes(16).toString('hex');
    const verificationTxt = `messmeals-verification=${token}`;

    const customDomain = await this.prisma.customDomain.create({
      data: {
        websiteId,
        domain,
        status: CustomDomainStatus.PENDING,
        verificationTxt,
      },
    });

    return {
      success: true,
      message: 'Custom domain added. Please configure DNS TXT record to verify ownership.',
      data: this.formatDomainResponse(customDomain),
    };
  }

  /**
   * Lists all custom domains linked to a website.
   */
  async getCustomDomains(user: AuthUser, websiteId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertWebsiteOwnership(user.id, websiteId);
    }

    const domains = await this.prisma.customDomain.findMany({
      where: { websiteId, status: { not: CustomDomainStatus.DISCONNECTED } },
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      data: domains.map((d) => this.formatDomainResponse(d)),
    };
  }

  /**
   * Queries public DNS for the verification TXT record.
   * If found and matching, marks as VERIFIED / SSL_PENDING / ACTIVE.
   */
  async verifyCustomDomain(user: AuthUser, websiteId: string, domainId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertWebsiteOwnership(user.id, websiteId);
    }

    const record = await this.prisma.customDomain.findFirst({
      where: { id: domainId, websiteId },
    });

    if (!record) {
      throw new NotFoundException('Custom domain record not found');
    }

    if (record.status === CustomDomainStatus.ACTIVE) {
      return {
        success: true,
        message: 'Custom domain is already active and verified',
        data: this.formatDomainResponse(record),
      };
    }

    // Update status to VERIFYING
    await this.prisma.customDomain.update({
      where: { id: domainId },
      data: { status: CustomDomainStatus.VERIFYING },
    });

    try {
      // Query DNS TXT records for the domain
      const txtRecords = await dns.resolveTxt(record.domain);
      const flattened = txtRecords.map((chunk) => chunk.join(''));
      const isVerified = flattened.some((val) => val === record.verificationTxt);

      if (isVerified) {
        // Domain ownership confirmed! Advance to ACTIVE
        const updated = await this.prisma.customDomain.update({
          where: { id: domainId },
          data: {
            status: CustomDomainStatus.ACTIVE,
            verifiedAt: new Date(),
            failureReason: null,
          },
        });

        return {
          success: true,
          message: 'DNS verification successful! Custom domain is now active.',
          data: this.formatDomainResponse(updated),
        };
      } else {
        const failureReason = `TXT record found, but token did not match expected value: "${record.verificationTxt}"`;
        const updated = await this.prisma.customDomain.update({
          where: { id: domainId },
          data: {
            status: CustomDomainStatus.FAILED,
            failureReason,
          },
        });

        return {
          success: false,
          message: failureReason,
          data: this.formatDomainResponse(updated),
        };
      }
    } catch (err: any) {
      const failureReason =
        err.code === 'ENODATA' || err.code === 'ENOTFOUND'
          ? `No DNS TXT records found for "${record.domain}". DNS changes may take up to 24-48 hours to propagate.`
          : `DNS resolution error: ${err.message || 'Lookup failed'}`;

      const updated = await this.prisma.customDomain.update({
        where: { id: domainId },
        data: {
          status: CustomDomainStatus.FAILED,
          failureReason,
        },
      });

      return {
        success: false,
        message: failureReason,
        data: this.formatDomainResponse(updated),
      };
    }
  }

  /**
   * Disconnects / removes a custom domain from a website.
   */
  async disconnectCustomDomain(user: AuthUser, websiteId: string, domainId: string) {
    if (user.role !== 'SUPERADMIN') {
      await this.assertWebsiteOwnership(user.id, websiteId);
    }

    const record = await this.prisma.customDomain.findFirst({
      where: { id: domainId, websiteId },
    });

    if (!record) {
      throw new NotFoundException('Custom domain record not found');
    }

    await this.prisma.customDomain.update({
      where: { id: domainId },
      data: {
        status: CustomDomainStatus.DISCONNECTED,
      },
    });

    return {
      success: true,
      message: `Custom domain "${record.domain}" disconnected successfully`,
    };
  }

  private formatDomainResponse(domain: any) {
    return {
      id: domain.id,
      websiteId: domain.websiteId,
      domain: domain.domain,
      status: domain.status,
      isActive: domain.status === CustomDomainStatus.ACTIVE,
      verifiedAt: domain.verifiedAt,
      failureReason: domain.failureReason,
      dnsInstructions: {
        type: 'TXT',
        host: '@',
        value: domain.verificationTxt,
        cnameTarget: 'storefront.messmeals.com',
      },
      createdAt: domain.createdAt,
    };
  }
}

