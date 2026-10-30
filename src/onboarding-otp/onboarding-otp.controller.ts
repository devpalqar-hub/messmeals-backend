import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { OnboardingOtpService } from './onboarding-otp.service';
import { SendOtpDto, VerifyOtpDto, ResendOtpDto } from './dto/send-otp.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Onboarding Auth (v1)')
@Controller(['api/v1/auth', 'v1/auth'])
export class OnboardingOtpController {
  constructor(private readonly svc: OnboardingOtpService) {}

  @Post('otp/send')
  @ApiOperation({ summary: 'Send OTP for onboarding', description: 'Sends a 6-digit OTP to the phone number. Supports IN, AE, QA.' })
  sendOtp(@Body() dto: SendOtpDto) {
    return this.svc.sendOtp(dto.phone, dto.countryCode);
  }

  @Post('otp/verify')
  @ApiOperation({ summary: 'Verify OTP and issue JWT', description: 'Verifies OTP server-side. Creates user if new. Returns accessToken.' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.svc.verifyOtp(dto.phone, dto.otp);
  }

  @Post('otp/resend')
  @ApiOperation({ summary: 'Resend OTP', description: 'Resends OTP with cooldown check.' })
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.svc.resendOtp(dto.phone, dto.countryCode ?? 'IN');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get authenticated user profile' })
  async getMe(@Req() req: any) {
    return this.svc.getMe(req.user);
  }
}
