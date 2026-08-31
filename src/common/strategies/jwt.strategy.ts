import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BillingService } from 'src/billing/billing.service';
import { Role } from '@prisma/client';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly billingService: BillingService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('❌ JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret, // ✅ TypeScript now knows it's a string
    });
  }

  async validate(payload: any) {
    // Customers live in their own `Customer` table, split out from the shared `User`
    // table (see prisma/schema.prisma) — the JWT's `role` claim tells us which table
    // to resolve `payload.sub` against, but the returned `req.user` shape is kept
    // identical either way so every downstream consumer is unaffected.
    if (payload.role === Role.USER) {
      const customer = await this.prisma.customer.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          customerProfile: { select: { id: true } },
        },
      });

      if (!customer) {
        throw new UnauthorizedException('User not found');
      }

      return {
        id: customer.id,
        email: customer.email,
        role: Role.USER,
        customerProfileId: customer.customerProfile?.id,
        deliveryPartnerProfileId: undefined,
        messAdminProfileId: undefined,
        messId: undefined,
        messIds: [],
      };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        deliveryPartnerProfile: { select: { id: true, messId: true } },
        messAdminProfile: { select: { id: true, messes: { select: { id: true } } } },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.role === Role.MESSADMIN) {
      const messIds = user.messAdminProfile?.messes?.map((m) => m.id) ?? [];
      await Promise.all(messIds.map((id) => this.billingService.enforceBillingStatus(id)));
    }

    const messId =
      user.role === Role.MESSADMIN
        ? (user.messAdminProfile?.messes?.length === 1 ? user.messAdminProfile.messes[0].id : undefined)
        : user.role === Role.DELIVERYAGENT
          ? user.deliveryPartnerProfile?.messId
          : undefined;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      customerProfileId: undefined,
      deliveryPartnerProfileId: user.deliveryPartnerProfile?.id,
      messAdminProfileId: user.messAdminProfile?.id,
      messId,
      messIds: user.messAdminProfile?.messes?.map((m) => m.id) ?? [],
    };
  }
}
