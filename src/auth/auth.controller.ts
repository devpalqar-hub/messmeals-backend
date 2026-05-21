import { Body, Controller, Post, Get, Query, UseGuards, Param, Req, Patch } from '@nestjs/common';
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
import { CreateMessAdminBySuperAdminDto, MessAdminListQueryDto, UpdateMessAdminBySuperAdminDto } from './dto/messadmin-admin.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MessOwnerSendOtpDto, MessOwnerSignupDto } from './dto/mess-owner-signup.dto';


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('send-reg-otp')
    @ApiOperation({ summary: 'Send registration OTP', description: 'Sends OTP for registration flows.' })
    @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
    async sendOtp(@Body() regDto: RegisterDto) {
        return this.authService.sendOtpForRegistration(regDto);
    }

    @Post('send-login-otp')
    @ApiOperation({ summary: 'Send login OTP', description: 'Sends OTP for login flows.' })
    @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
    async sendOtpForLogin(@Body() loginDto: LoginDto) {
        return this.authService.sendOtpForLogin(loginDto);
    }

    @Post('verify-otp')
    @ApiOperation({ summary: 'Verify OTP', description: 'Verifies OTP and returns a JWT access token.' })
    @ApiResponse({ status: 200, description: 'OTP verified successfully.' })
    async verifyOtp(@Body() otpVerifyDto: OtpVerifyDto) {
        return this.authService.verifyOtp(otpVerifyDto);
    }

    @Post('mess-owner/send-otp')
    @ApiOperation({
        summary: 'Send OTP for mess owner signup',
        description: 'Sends an OTP to a new mess owner. Fails if phone/email already exists.',
    })
    @ApiResponse({ status: 200, description: 'OTP sent successfully.' })
    sendOtpForMessOwnerSignup(@Body() dto: MessOwnerSendOtpDto) {
        return this.authService.sendOtpForMessOwnerSignup(dto);
    }

    @Post('mess-owner/signup')
    @ApiOperation({
        summary: 'Mess owner signup',
        description: 'Verifies OTP, then creates a mess owner (MESSADMIN) account + mess + enquiry, and returns access token + owner profile.',
    })
    @ApiResponse({ status: 201, description: 'Mess owner signed up successfully.' })
    signupMessOwner(@Body() dto: MessOwnerSignupDto) {
        return this.authService.signupMessOwner(dto);
    }


    @Get('delivery-agents')
    @ApiOperation({ summary: 'List delivery agents', description: 'Returns paginated delivery agents with search.' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'search', required: false, description: 'Search by agent email/name.' })
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
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get dashboard stats', description: 'Returns dashboard stats for the authenticated admin.' })
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



    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Get('mess-admins')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List mess admins', description: 'Superadmin-only listing of mess admins.' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    async getAllMessAdmins(@Query() query: MessAdminListQueryDto) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 10;
        return this.authService.getallmessadmin(query, page, limit);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Post('mess-admins')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create mess admin', description: 'Creates a new mess admin from superadmin.' })
    async createMessAdmin(@Body() dto: CreateMessAdminBySuperAdminDto) {
        return this.authService.createMessAdminBySuperAdmin(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN)
    @Patch('mess-admins/:id')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update mess admin', description: 'Updates a mess admin by id.' })
    async updateMessAdmin(
        @Param('id') id: string,
        @Body() dto: UpdateMessAdminBySuperAdminDto,
    ) {
        return this.authService.updateMessAdminBySuperAdmin(id, dto);
    }


    // -------------------------------------------------------
    // PHASE 3
    // -------------------------------------------------------
    @Post('send/user/reg/otp')
    @ApiOperation({ summary: 'Send customer registration OTP', description: 'Sends OTP for customer registration.' })
    async sendOtpForClientRegistration(@Body() regDto: UserRegisterDto) {
        return this.authService.sendOtpForClientRegistration(regDto);
    }

    @Post('send/dlvryagent/reg/otp')
    @ApiOperation({ summary: 'Send delivery agent registration OTP', description: 'Sends OTP for delivery agent registration.' })
    async sendOtpForDeliveryAgentRegistration(@Body() regDto: RegisterDeliveryAgentDto) {
        return this.authService.sendOtpForDeliveryAgentRegistration(regDto);
    }

    // @UseGuards(JwtAuthGuard, RolesGuard)
    // @Roles(Role.SUPERADMIN)
    @Post('admin/add/number')
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                phone: { type: 'string', example: '+919876543221' },
            },
            required: ['phone'],
        },
    })
    @ApiOperation({ summary: 'Add OTP bypass phone', description: 'Adds a phone number to the OTP bypass list.' })
    async AddPhoneNumber(@Body('phone') number: string) {
        return this.authService.AddPhoneNumber(number);
    }


    @Post('superadmin/register')
    @ApiOperation({ summary: 'Register superadmin', description: 'Registers a superadmin account.' })
    registerSuperAdmin(@Body() dto: SuperAdminRegisterDto) {
        return this.authService.registerSuperAdmin(dto);
    }

    @Post('superadmin/login')
    @ApiOperation({ summary: 'Login superadmin', description: 'Authenticates a superadmin and returns a token.' })
    loginSuperAdmin(@Body() dto: SuperAdminLoginDto) {
        return this.authService.loginSuperAdmin(dto);
    }
}
