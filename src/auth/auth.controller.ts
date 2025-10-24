import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('send-otp')
    async sendOtp(@Body() loginDto: LoginDto) {
        return this.authService.sendOtp(loginDto);
    }

    @Post('verify-otp')
    async verifyOtp(@Body() otpVerifyDto: OtpVerifyDto) {
        return this.authService.verifyOtp(otpVerifyDto.email, otpVerifyDto.otp);
    }


    @Get('delivery-agents')
    async listDeliveryAgents(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,
    ) {
        return this.authService.ListDeliveryAgents(Number(page), Number(limit), search);
    }

    @Get('stats')
    async getCustomerStats() {
        const stats = await this.authService.getCustomerStats();
        return {
            totalCustomers: stats.totalCustomers,
            avgWalletPerCustomer: `$${stats.avgWalletPerCustomer.toFixed(2)}`,
            pendingAmount: `$${stats.pendingAmount.toFixed(2)}`,
        };
    }


}
