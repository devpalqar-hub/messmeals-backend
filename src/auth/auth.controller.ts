import { Body, Controller, Post, Get, Query } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('logout')
    async logout() {
        return this.authService.logout();
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
