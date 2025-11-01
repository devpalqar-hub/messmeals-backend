import { Body, Controller, Post, Get, Query, UseGuards, Param } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/Registration.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';


@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('send-reg-otp')
    async sendOtp(@Body() regDto: RegisterDto) {
        return this.authService.sendOtpForRegistration(regDto);
    }

    @Post('send-login-otp')
    async sendOtpForLogin(@Body() loginDto: LoginDto) {
        return this.authService.sendOtpForLogin(loginDto);
    }

    @Post('verify-otp')
    async verifyOtp(@Body() otpVerifyDto: OtpVerifyDto) {
        return this.authService.verifyOtp(otpVerifyDto);
    }


    @Get('delivery-agents')
    async listDeliveryAgents(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
        @Query('search') search?: string,
    ) {
        return this.authService.ListDeliveryAgents(Number(page), Number(limit), search);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles("MESSADMIN")
    @Get('stats')
    async getDashboardStats() {
        return this.authService.getDashboardStats();
    }

    @Get('mess-admins/:id')
    async getAllMessAdmins(@Param('id') id: string) {
        return this.authService.getallmessadmin(id);
    }

}
