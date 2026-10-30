import { Test, TestingModule } from '@nestjs/testing';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OnboardingStage, OnboardingStatus } from '@prisma/client';

describe('OnboardingService', () => {
  let service: OnboardingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      onboardingSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      onboardingEvent: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      mess: {
        update: jest.fn(),
      },
      messAdminProfile: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OnboardingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OnboardingService>(OnboardingService);
  });

  describe('start', () => {
    it('should create a new session if none exists', async () => {
      prisma.messAdminProfile.findUnique.mockResolvedValue({
        messes: [{ id: 'mess-1' }],
      });
      prisma.onboardingSession.findFirst.mockResolvedValue(null);
      prisma.onboardingSession.create.mockResolvedValue({
        id: 'sess-1',
        currentStage: OnboardingStage.PHONE_VERIFICATION,
        status: OnboardingStatus.IN_PROGRESS,
        completedStages: JSON.stringify([OnboardingStage.PHONE_VERIFICATION]),
      });
      prisma.onboardingEvent.create.mockResolvedValue({});

      const result = await service.start({ id: 'user-1', role: 'MESSADMIN' }, {});
      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBe('sess-1');
      expect(result.data.currentStage).toBe(OnboardingStage.PHONE_VERIFICATION);
    });
  });

  describe('transitionStage', () => {
    it('should advance to the given stage and log an audit event', async () => {
      prisma.messAdminProfile.findUnique.mockResolvedValue({
        messes: [{ id: 'mess-1' }],
      });
      prisma.onboardingSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        currentStage: OnboardingStage.PHONE_VERIFICATION,
        completedStages: JSON.stringify([OnboardingStage.PHONE_VERIFICATION]),
      });
      prisma.onboardingSession.update.mockResolvedValue({
        id: 'sess-1',
        currentStage: OnboardingStage.LOCATION,
        completedStages: JSON.stringify([
          OnboardingStage.PHONE_VERIFICATION,
          OnboardingStage.LOCATION,
        ]),
      });
      prisma.onboardingEvent.create.mockResolvedValue({});

      const result = await service.transitionStage(
        { id: 'user-1', role: 'MESSADMIN' },
        { stage: OnboardingStage.LOCATION },
      );

      expect(result.success).toBe(true);
      expect(prisma.onboardingEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'sess-1',
            stage: OnboardingStage.LOCATION,
          }),
        }),
      );
    });
  });

  describe('complete', () => {
    it('should mark session as COMPLETED and activate mess', async () => {
      prisma.messAdminProfile.findUnique.mockResolvedValue({
        messes: [{ id: 'mess-1' }],
      });
      prisma.onboardingSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        currentStage: OnboardingStage.WEBSITE_READY,
        completedStages: JSON.stringify([OnboardingStage.WEBSITE_READY]),
      });
      prisma.onboardingSession.update.mockResolvedValue({
        id: 'sess-1',
        status: OnboardingStatus.COMPLETED,
        completedAt: new Date(),
      });
      prisma.mess.update.mockResolvedValue({});
      prisma.onboardingEvent.create.mockResolvedValue({});

      const result = await service.complete(
        { id: 'user-1', role: 'MESSADMIN' },
        'mess-1',
      );

      expect(result.success).toBe(true);
      expect(prisma.mess.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mess-1' },
          data: { is_active: true },
        }),
      );
    });
  });
});
