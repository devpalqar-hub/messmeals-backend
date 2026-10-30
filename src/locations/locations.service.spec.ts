import { Test, TestingModule } from '@nestjs/testing';
import { LocationsService, COUNTRY_CONFIG } from './locations.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupportedCountry } from '@prisma/client';

describe('LocationsService', () => {
  let service: LocationsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      messAdminProfile: {
        findFirst: jest.fn(),
      },
      mess: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      businessLocation: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      onboardingSession: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
  });

  describe('getCountries', () => {
    it('should return list of supported countries with currency and timezone', () => {
      const result = service.getCountries();
      expect(result.success).toBe(true);
      expect(result.data.length).toBe(3);
      expect(result.data.map((c) => c.code)).toEqual(['IN', 'AE', 'QA']);
    });
  });

  describe('createLocation', () => {
    it('should upsert location and set currency/timezone server-side', async () => {
      prisma.messAdminProfile.findFirst.mockResolvedValue({ id: 'prof-1' });
      prisma.mess.findUnique.mockResolvedValue({ id: 'mess-1' });
      prisma.businessLocation.upsert.mockResolvedValue({
        id: 'loc-1',
        messId: 'mess-1',
        country: SupportedCountry.IN,
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        city: 'Bengaluru',
      });
      prisma.mess.update.mockResolvedValue({});
      prisma.onboardingSession.findFirst.mockResolvedValue(null);

      const result = await service.createLocation(
        { id: 'user-1', role: 'MESSADMIN' },
        'mess-1',
        {
          country: SupportedCountry.IN,
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560034',
        },
      );

      expect(result.success).toBe(true);
      expect(result.data.currency).toBe('INR');
      expect(prisma.businessLocation.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            currency: 'INR',
            timezone: 'Asia/Kolkata',
          }),
        }),
      );
    });
  });
});
