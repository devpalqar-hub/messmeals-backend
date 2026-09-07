import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

/// POST /customer-auth/register/send-otp — step 1 of customer registration. No DB write
/// happens here — the customer profile is only created once these same details are
/// resubmitted with the OTP at POST /customer-auth/register/verify-otp.
export class CustomerRegisterSendOtpDto {
    @ApiProperty({ example: '+919876543210' })
    @IsString()
    @MinLength(10)
    phone: string;

    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    @IsNotEmpty({ message: 'name is required' })
    name: string;

    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email: string;
}

/// POST /customer-auth/register/verify-otp — step 2. Carries the same phone/name/email
/// as the send-otp call plus the sessionId + otp; the Customer (+ CustomerProfile) row is
/// created here, once the OTP is confirmed.
export class CustomerRegisterVerifyDto extends CustomerRegisterSendOtpDto {
    @ApiProperty({ example: '2b37ee5f-41ee-4da6-abcf-d0702168c339' })
    @IsString()
    @IsNotEmpty({ message: 'sessionId is required' })
    sessionId: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @IsNotEmpty({ message: 'otp is required' })
    otp: string;
}
