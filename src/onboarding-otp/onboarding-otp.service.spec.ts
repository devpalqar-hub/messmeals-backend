import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingOtpService, COUNTRY_META } from './onboarding-otp.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { TwoFactorService } from 'src/twofactor/twofactor.service';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('OnboardingOtpService', () => {
  let service: OnboardingOtpService;
  let prisma: any;
  let otpService: any;
  let jwtService: any;

  beforeEach(async () => {
    prisma = {
      otpSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      phoneNumbers: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      onboardingSession: {
        create: jest.fn(),
      },
    };

    otpService = {
      sendOtp: jest.fn().mockResolvedValue({ Details: 'session-123' }),
      verifyOtp: jest.fn().mockResolvedValue({ Status: 'Success' }),
    };

    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingOtpService,
        { provide: PrismaService, useValue: prisma },
        { provide: TwoFactorService, useValue: otpService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<OnboardingOtpService>(OnboardingOtpService);
  });

  describe('sendOtp', () => {
    it('should throw BadRequestException if country code is unsupported', async () => {
      await expect(service.sendOtp('+919999999999', 'US')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create an OTP session and return response for IN', async () => {
      prisma.otpSession.findFirst.mockResolvedValue(null);
      prisma.otpSession.create.mockResolvedValue({ id: 'session-id' });

      const result = await service.sendOtp('+919876543210', 'IN');
      expect(result.success).toBe(true);
      expect(result.data.phone).toBe('+919876543210');
      expect(prisma.otpSession.create).toHaveBeenCalled();
    });

    it('should enforce cooldown if recent OTP was sent', async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        id: 'session-id',
        lastSentAt: new Date(), // just now
      });

      await expect(service.sendOtp('+919876543210', 'IN')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('verifyOtp', () => {
    it('should throw BadRequestException if no session exists', async () => {
      prisma.otpSession.findFirst.mockResolvedValue(null);
      await expect(service.verifyOtp('+919876543210', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should verify OTP and return access token for new user', async () => {
      prisma.otpSession.findFirst.mockResolvedValue({
        id: 'session-id',
        attempts: 0,
        expiresAt: new Date(Date.now() + 600000),
        otp: '123456',
      });
      prisma.otpSession.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'new-user-id',
        phone: '+919876543210',
        role: 'MESSADMIN',
        messAdminProfile: { messes: [] },
      });
      prisma.onboardingSession.create.mockResolvedValue({});

      const result = await service.verifyOtp('+919876543210', '123456');
      expect(result.success).toBe(true);
      expect(result.data.accessToken).toBe('mock-jwt-token');
      expect(result.data.isNewUser).toBe(true);
    });
  });
});
