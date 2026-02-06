import { Body, Controller, Post, Get, Query, UseGuards, Param, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDeliveryAgentDto, RegisterDto, UserRegisterDto } from './dto/Registration.dto';
import { LoginDto } from './dto/login.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { SuperAdminRegisterDto } from './dto/superadmin-register.dto';
import { SuperAdminLoginDto } from './dto/superadmin-login.dto';


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

    @Get('stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles("MESSADMIN", "SUPERADMIN")
    async getDashboardStats(
        @Req() req,
        @Query('messId') messId?: string,
        @Query('date1') date1?: string,
        @Query('date2') date2?: string,
    ) {
        return this.authService.getDashboardStats(
            req.user,
            messId,
            date1,
            date2
        );
    }



    @Get('mess-admins/')
    async getAllMessAdmins() {
        return this.authService.getallmessadmin();
    }


    // -------------------------------------------------------
    // PHASE 3
    // -------------------------------------------------------
    @Post('send/user/reg/otp')
    async sendOtpForClientRegistration(@Body() regDto: UserRegisterDto) {
        return this.authService.sendOtpForClientRegistration(regDto);
    }

    @Post('send/dlvryagent/reg/otp')
    async sendOtpForDeliveryAgentRegistration(@Body() regDto: RegisterDeliveryAgentDto) {
        return this.authService.sendOtpForDeliveryAgentRegistration(regDto);
    }

    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.SUPERADMIN)
    @Post('admin/add/number')
    async AddPhoneNumber(@Body('phone') number: string) {
        return this.authService.AddPhoneNumber(number);
    }


    @Post('superadmin/register')
    registerSuperAdmin(@Body() dto: SuperAdminRegisterDto) {
        return this.authService.registerSuperAdmin(dto);
    }

    @Post('superadmin/login')
    loginSuperAdmin(@Body() dto: SuperAdminLoginDto) {
        return this.authService.loginSuperAdmin(dto);
    }
}
