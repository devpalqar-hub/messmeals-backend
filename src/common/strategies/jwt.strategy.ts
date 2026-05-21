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
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        customerProfile: { select: { id: true } },
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
      customerProfileId: user.customerProfile?.id,
      deliveryPartnerProfileId: user.deliveryPartnerProfile?.id,
      messAdminProfileId: user.messAdminProfile?.id,
      messId,
      messIds: user.messAdminProfile?.messes?.map((m) => m.id) ?? [],
    };
  }
}
