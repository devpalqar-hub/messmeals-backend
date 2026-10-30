import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { OnboardingOtpController } from './onboarding-otp.controller';
import { OnboardingOtpService } from './onboarding-otp.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { TwoFactorModule } from 'src/twofactor/twofactor.module';

@Module({
  imports: [
    PrismaModule,
    TwoFactorModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'super-secret-key',
      signOptions: { expiresIn: '365d' },
    }),
  ],
  controllers: [OnboardingOtpController],
  providers: [OnboardingOtpService],
  exports: [OnboardingOtpService],
})
export class OnboardingOtpModule {}
