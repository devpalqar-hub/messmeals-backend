import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Customer, CustomerProfile, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { TwoFactorService } from 'src/twofactor/twofactor.service';
import { isPhoneOrEmailTaken } from 'src/common/utility/identity.util';
import { CheckPhoneDto } from './dto/check-phone.dto';
import { CustomerLoginVerifyDto } from './dto/customer-otp-verify.dto';
import { CustomerRegisterSendOtpDto, CustomerRegisterVerifyDto } from './dto/customer-register.dto';

/** Dev/non-production OTP — same convention used by the rest of the auth module. */
const DEV_OTP = '123456';
const DEV_SESSION_ID = 'local-dev';

type CustomerWithProfile = Customer & {
    customerProfile: (CustomerProfile & { addresses?: unknown[]; Wallet?: unknown }) | null;
};

/// Dedicated, self-contained auth API for the customer-facing app. Kept separate from
/// AuthService (which carries a lot of shared staff/legacy login logic) so the customer
/// login/register flow can stay simple:
///
///  - POST /customer-auth/check-phone            → { hasAccount } and, when true, an OTP
///                                                   is sent in the same call
///  - POST /customer-auth/login/verify-otp        → verifies OTP for an existing customer,
///                                                   returns accessToken + profile
///  - POST /customer-auth/register/send-otp       → validates phone/email are free, sends
///                                                   OTP; does NOT write to the DB yet
///  - POST /customer-auth/register/verify-otp     → same phone/name/email + otp; the
///                                                   Customer (+ CustomerProfile) row is
///                                                   only created here, once OTP is verified
@Injectable()
export class CustomerAuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly otpService: TwoFactorService,
    ) { }

    async checkPhone(dto: CheckPhoneDto) {
        const phone = dto.phone.trim();
        const customer = await this.prisma.customer.findUnique({ where: { phone } });

        if (!customer) {
            return {
                hasAccount: false,
                message: 'No account found for this phone number. Please register.',
                status: 200,
            };
        }

        const otpResult = await this.dispatchOtp(phone);
        return {
            hasAccount: true,
            message: 'OTP sent successfully',
            status: 200,
            ...otpResult,
        };
    }

    async verifyLoginOtp(dto: CustomerLoginVerifyDto) {
        const phone = dto.phone.trim();

        const customer = await this.prisma.customer.findUnique({
            where: { phone },
            include: { customerProfile: { include: { addresses: true, Wallet: true } } },
        });
        if (!customer) {
            throw new NotFoundException('No account found for this phone number');
        }

        await this.assertOtp(phone, dto.sessionId, dto.otp);

        if (!customer.is_verified) {
            await this.prisma.customer.update({ where: { phone }, data: { is_verified: true } });
            customer.is_verified = true;
        }

        return this.buildAuthResponse(customer, 'Login successful');
    }

    async sendRegisterOtp(dto: CustomerRegisterSendOtpDto) {
        const phone = dto.phone.trim();
        const email = dto.email.trim().toLowerCase();

        if (await isPhoneOrEmailTaken(this.prisma, { phone, email })) {
            throw new BadRequestException(
                'An account already exists with this phone or email. Please login instead.',
            );
        }

        const otpResult = await this.dispatchOtp(phone);
        return {
            message: 'OTP sent successfully',
            status: 200,
            ...otpResult,
        };
    }

    async verifyRegisterOtp(dto: CustomerRegisterVerifyDto) {
        const phone = dto.phone.trim();
        const email = dto.email.trim().toLowerCase();
        const name = dto.name.trim();

        await this.assertOtp(phone, dto.sessionId, dto.otp);

        // Re-check at write time — the OTP round trip is a race window another signup
        // could slip through during.
        if (await isPhoneOrEmailTaken(this.prisma, { phone, email })) {
            throw new BadRequestException('An account already exists with this phone or email');
        }

        const customer = await this.prisma.customer.create({
            data: {
                name,
                email,
                phone,
                is_verified: true,
                customerProfile: { create: {} },
            },
            include: { customerProfile: { include: { addresses: true, Wallet: true } } },
        });

        return this.buildAuthResponse(customer, 'Registered successfully');
    }

    /// Sends an OTP to `phone`, honoring the same PRODUCTION/dev-fallback and
    /// phoneNumbers-bypass conventions used across the rest of the auth module.
    private async dispatchOtp(phone: string): Promise<{ sessionId: string; otp?: string }> {
        if (process.env.NODE_ENV !== 'PRODUCTION') {
            return { sessionId: DEV_SESSION_ID, otp: DEV_OTP };
        }

        const bypass = await this.prisma.phoneNumbers.findUnique({ where: { phone } });
        if (bypass) {
            return { sessionId: '2b37ee5f-41ee-4da6-abcf-d0702168c339', otp: DEV_OTP };
        }

        const otpResponse = await this.otpService.sendOtp(phone);
        if (otpResponse._fallback) {
            return { sessionId: otpResponse.Details, otp: otpResponse._fallbackOtp };
        }
        return { sessionId: otpResponse.Details };
    }

    /// Throws unless `otp` is valid for `sessionId` (or the dev/bypass fallback OTP).
    private async assertOtp(phone: string, sessionId: string, otp: string) {
        if (process.env.NODE_ENV !== 'PRODUCTION') {
            if (otp !== DEV_OTP) throw new BadRequestException('Otp not correct');
            return;
        }

        const bypass = await this.prisma.phoneNumbers.findUnique({ where: { phone } });
        if (bypass) {
            if (otp !== DEV_OTP) throw new BadRequestException('Otp not correct');
            return;
        }

        const verify = await this.otpService.verifyOtp(sessionId, otp);
        if (verify.Status !== 'Success') {
            throw new UnauthorizedException('Invalid OTP');
        }
    }

    private buildAuthResponse(customer: CustomerWithProfile, message: string) {
        const accessToken = this.jwtService.sign({
            sub: customer.id,
            phone: customer.phone,
            email: customer.email,
            role: Role.USER,
        });

        return {
            accessToken,
            profile: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                isVerified: customer.is_verified,
                customerProfile: customer.customerProfile,
                addresses: customer.customerProfile?.addresses ?? [],
                wallet: customer.customerProfile?.Wallet ?? null,
            },
            message,
            status: 200,
        };
    }
}
