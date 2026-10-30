import { Test, TestingModule } from '@nestjs/testing';
import { OffersService } from './offers.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { OfferClaimStatus } from '@prisma/client';

describe('OffersService', () => {
  let service: OffersService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      websiteOfferConfig: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      websiteOfferClaim: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      messAdminProfile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      onboardingSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OffersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<OffersService>(OffersService);
  });

  describe('getEligibility', () => {
    it('should return isEligible = true when spots are remaining and not yet claimed', async () => {
      prisma.websiteOfferConfig.findFirst.mockResolvedValue({
        id: 'cfg-1',
        maxClaims: 200,
        totalClaimed: 45,
        originalPrice: 9999,
        promoPrice: 0,
        isEnabled: true,
      });
      prisma.messAdminProfile.findUnique.mockResolvedValue({
        messes: [{ id: 'mess-1' }],
      });
      prisma.websiteOfferClaim.findUnique.mockResolvedValue(null);

      const result = await service.getEligibility({ id: 'user-1', role: 'MESSADMIN' });
      expect(result.success).toBe(true);
      expect(result.data.isEligible).toBe(true);
      expect(result.data.spotsRemaining).toBe(155);
    });
  });

  describe('claimOffer', () => {
    it('should claim the offer and increment totalClaimed count', async () => {
      prisma.websiteOfferConfig.findFirst.mockResolvedValue({
        id: 'cfg-1',
        maxClaims: 200,
        totalClaimed: 10,
        isEnabled: true,
      });
      prisma.messAdminProfile.findUnique.mockResolvedValue({
        messes: [{ id: 'mess-1' }],
      });
      prisma.websiteOfferClaim.findUnique.mockResolvedValue(null);
      prisma.websiteOfferClaim.upsert.mockResolvedValue({
        id: 'claim-1',
        status: OfferClaimStatus.CLAIMED,
      });
      prisma.websiteOfferConfig.update.mockResolvedValue({});
      prisma.onboardingSession.findFirst.mockResolvedValue(null);

      const result = await service.claimOffer(
        { id: 'user-1', role: 'MESSADMIN' },
        {},
      );

      expect(result.success).toBe(true);
      expect(prisma.websiteOfferConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { totalClaimed: { increment: 1 } },
        }),
      );
    });
  });
});
