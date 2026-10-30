import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { TwoFactorService } from 'src/twofactor/twofactor.service';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

export const COUNTRY_META: Record<string, { currency: string; timezone: string }> = {
  IN: { currency: 'INR', timezone: 'Asia/Kolkata' },
  AE: { currency: 'AED', timezone: 'Asia/Dubai' },
  QA: { currency: 'QAR', timezone: 'Asia/Qatar' },
};

@Injectable()
export class OnboardingOtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otpService: TwoFactorService,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(phone: string, countryCode: string) {
    if (!COUNTRY_META[countryCode]) {
      throw new BadRequestException(
        `Unsupported country code: ${countryCode}. Supported: IN, AE, QA`,
      );
    }

    const existing = await this.prisma.otpSession.findFirst({
      where: { phone, verified: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      const secondsSince = Math.floor(
        (Date.now() - existing.lastSentAt.getTime()) / 1000,
      );
      if (secondsSince < RESEND_COOLDOWN_SECONDS) {
        throw new BadRequestException(
          `Please wait ${RESEND_COOLDOWN_SECONDS - secondsSince} seconds before requesting another OTP.`,
        );
      }
    }

    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
    let sessionId: string | undefined;
    let fallbackOtp: string | undefined;

    if (process.env.NODE_ENV === 'PRODUCTION') {
      const bypass = await this.prisma.phoneNumbers.findUnique({ where: { phone } });
      if (bypass) {
        fallbackOtp = '123456';
      } else {
        const resp = await this.otpService.sendOtp(phone);
        sessionId = resp.Details;
        if (resp._fallback) {
          fallbackOtp = resp._fallbackOtp;
        }
      }
    } else {
      fallbackOtp = '123456';
    }

    if (existing) {
      await this.prisma.otpSession.update({
        where: { id: existing.id },
        data: {
          countryCode,
          sessionId,
          otp: fallbackOtp,
          expiresAt,
          attempts: 0,
          lastSentAt: new Date(),
        },
      });
    } else {
      await this.prisma.otpSession.create({
        data: {
          phone,
          countryCode,
          sessionId,
          otp: fallbackOtp,
          expiresAt,
          lastSentAt: new Date(),
        },
      });
    }

    const response: any = {
      success: true,
      message: 'OTP sent successfully',
      data: {
        phone,
        expiresIn: OTP_EXPIRY_MINUTES * 60,
        cooldown: RESEND_COOLDOWN_SECONDS,
      },
    };

    if (process.env.NODE_ENV !== 'PRODUCTION' || fallbackOtp) {
      response.data.otp = fallbackOtp ?? '123456';
    }

    return response;
  }

  async resendOtp(phone: string, countryCode: string) {
    const session = await this.prisma.otpSession.findFirst({
      where: { phone, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      return this.sendOtp(phone, countryCode);
    }

    const secondsSince = Math.floor(
      (Date.now() - session.lastSentAt.getTime()) / 1000,
    );
    if (secondsSince < RESEND_COOLDOWN_SECONDS) {
      throw new BadRequestException(
        `Please wait ${RESEND_COOLDOWN_SECONDS - secondsSince} seconds before resending OTP.`,
      );
    }

    return this.sendOtp(phone, countryCode);
  }

  async verifyOtp(phone: string, otp: string) {
    const session = await this.prisma.otpSession.findFirst({
      where: { phone, verified: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!session) {
      throw new BadRequestException('No OTP session found. Please request OTP first.');
    }

    if (new Date() > session.expiresAt) {
      throw new BadRequestException('OTP has expired. Please request a new one.');
    }

    if (session.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException('Maximum OTP attempts exceeded. Please request a new OTP.');
    }

    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });

    let verified = false;
    if (process.env.NODE_ENV === 'PRODUCTION') {
      const bypass = await this.prisma.phoneNumbers.findUnique({ where: { phone } });
      if (bypass) {
        verified = otp === '123456';
      } else if (session.sessionId) {
        const r = await this.otpService.verifyOtp(session.sessionId, otp);
        verified = r.Status === 'Success';
      } else if (session.otp) {
        verified = otp === session.otp;
      }
    } else {
      verified = otp === '123456' || otp === session.otp;
    }

    if (!verified) {
      const remaining = MAX_ATTEMPTS - (session.attempts + 1);
      throw new UnauthorizedException(
        `Invalid OTP. ${remaining} attempt(s) remaining.`,
      );
    }

    await this.prisma.otpSession.update({
      where: { id: session.id },
      data: { verified: true },
    });

    const phone_trimmed = phone.trim();
    let user = await this.prisma.user.findUnique({
      where: { phone: phone_trimmed },
      include: {
        messAdminProfile: {
          include: { messes: { select: { id: true, name: true, slug: true } } },
        },
      },
    });

    const isNewUser = !user;

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          name: '',
          phone: phone_trimmed,
          role: Role.MESSADMIN,
          is_verified: true,
          messAdminProfile: { create: {} },
        },
        include: {
          messAdminProfile: {
            include: { messes: { select: { id: true, name: true, slug: true } } },
          },
        },
      });

      await this.prisma.onboardingSession.create({
        data: {
          userId: user.id,
          currentStage: 'PHONE_VERIFICATION',
          completedStages: JSON.stringify(['PHONE_VERIFICATION']),
        },
      });
    } else if (!user.is_verified) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { is_verified: true },
      });
    }

    const accessToken = this.jwtService.sign({
      sub: user.id,
      phone: user.phone,
      email: user.email,
      role: user.role,
    });

    return {
      success: true,
      message: isNewUser
        ? 'Phone verified. Welcome to MessMeals!'
        : 'OTP verified successfully',
      data: {
        accessToken,
        isNewUser,
        user: {
          id: user.id,
          name: user.name || null,
          phone: user.phone,
          email: user.email || null,
          role: user.role,
        },
        businesses: (user.messAdminProfile?.messes ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
        })),
        onboardingStage: isNewUser ? 'PHONE_VERIFICATION' : null,
      },
    };
  }

  async getMe(user: { id: string; role: string }) {
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        messAdminProfile: {
          include: {
            messes: {
              select: { id: true, name: true, slug: true, is_verified: true },
            },
          },
        },
        onboardingSessions: {
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!dbUser) {
      throw new NotFoundException('User not found');
    }

    return {
      success: true,
      message: 'User profile retrieved',
      data: {
        id: dbUser.id,
        name: dbUser.name,
        phone: dbUser.phone,
        email: dbUser.email,
        role: dbUser.role,
        businesses: (dbUser.messAdminProfile?.messes ?? []).map((m) => ({
          id: m.id,
          name: m.name,
          slug: m.slug,
          isVerified: m.is_verified,
        })),
        onboarding: dbUser.onboardingSessions[0]
          ? {
              currentStage: dbUser.onboardingSessions[0].currentStage,
              status: dbUser.onboardingSessions[0].status,
              completedStages: dbUser.onboardingSessions[0].completedStages,
            }
          : null,
      },
    };
  }
}
