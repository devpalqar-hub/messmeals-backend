import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CustomerAuthService } from './customer-auth.service';
import { CheckPhoneDto } from './dto/check-phone.dto';
import { CustomerLoginVerifyDto } from './dto/customer-otp-verify.dto';
import { CustomerRegisterSendOtpDto, CustomerRegisterVerifyDto } from './dto/customer-register.dto';

/// Self-contained login/register API for the customer-facing app.
@ApiTags('Customer Auth')
@Controller('customer-auth')
export class CustomerAuthController {
    constructor(private readonly customerAuthService: CustomerAuthService) { }

    @Post('check-phone')
    @ApiOperation({
        summary: 'Check phone number',
        description:
            'Step 1 of customer login. Returns hasAccount: true/false for this phone number. ' +
            'When true, an OTP is sent in the same call (sessionId in the response) — proceed ' +
            'straight to POST /customer-auth/login/verify-otp. When false, no OTP is sent — ' +
            'route the client to registration instead.',
    })
    @ApiResponse({ status: 200, description: 'Account existence checked (and OTP sent if it exists).' })
    checkPhone(@Body() dto: CheckPhoneDto) {
        return this.customerAuthService.checkPhone(dto);
    }

    @Post('login/verify-otp')
    @ApiOperation({
        summary: 'Verify login OTP',
        description:
            'Step 2 of customer login. Verifies the OTP (sessionId from check-phone) against ' +
            'the phone number and returns an access token + full profile.',
    })
    @ApiResponse({ status: 200, description: 'OTP verified — access token + profile returned.' })
    verifyLoginOtp(@Body() dto: CustomerLoginVerifyDto) {
        return this.customerAuthService.verifyLoginOtp(dto);
    }

    @Post('register/send-otp')
    @ApiOperation({
        summary: 'Send registration OTP',
        description:
            'Step 1 of customer registration. Takes phone, name, email; fails if any is ' +
            'already registered. Sends an OTP but does NOT create the customer yet — the ' +
            'profile is only written to the DB once these same details are confirmed with ' +
            'the OTP at POST /customer-auth/register/verify-otp.',
    })
    @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
    sendRegisterOtp(@Body() dto: CustomerRegisterSendOtpDto) {
        return this.customerAuthService.sendRegisterOtp(dto);
    }

    @Post('register/verify-otp')
    @ApiOperation({
        summary: 'Verify registration OTP',
        description:
            'Step 2 of customer registration. Resubmit the same phone/name/email from ' +
            'send-otp, plus sessionId + otp. Once the OTP is verified, the Customer (+ ' +
            'CustomerProfile) row is created and an access token + profile is returned.',
    })
    @ApiResponse({ status: 201, description: 'Customer registered — access token + profile returned.' })
    verifyRegisterOtp(@Body() dto: CustomerRegisterVerifyDto) {
        return this.customerAuthService.verifyRegisterOtp(dto);
    }
}
