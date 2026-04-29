import { Body, Controller, Post, Get, Query, Patch, Param, DefaultValuePipe, ParseIntPipe, Delete, UseGuards, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomerService } from './customers.service';
import { choosePlanDto, CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { RenewSubscriptionDto } from './dto/renew-Subscription.dto';
import { CancelSubDto } from './dto/cancel-sub.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PauseSubDto } from './dto/pause-sub.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("MESSADMIN", "SUPERADMIN")
@Controller('customer')
export class CustomerController {
    constructor(private readonly cusomerservice: CustomerService) { }

    @Post('register-user')
    async register(@Body() dto: CreateCustomerDto) {
        return this.cusomerservice.CreateUser(dto);
    }

    @Patch(':id')
    async updateCustomer(
        @Param('id') id: string,
        @Body() dto: UpdateCustomerDto,
    ) {
        return this.cusomerservice.updateCustomerProfile(id, dto);
    }


    @Get()
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('messId') messId?: string,
        @Query('isActive') isActive?: string,
    ) {
        return this.cusomerservice.findAll(
            page,
            limit,
            search,
            messId,
            isActive !== undefined ? isActive === 'true' : undefined,
        );
    }


    // 🔍 GET /customers/:id
    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.cusomerservice.findOne(id);
    }

    // 🔹 Delete Customer
    @Delete(':id')
    async deleteCustomer(@Param('id') id: string) {
        return this.cusomerservice.deleteCustomer(id);
    }


    @Post('renew-subscription')
    async renewSubscription(@Body() dto: RenewSubscriptionDto) {
        return this.cusomerservice.RenewSubscription(dto);
    }

    @Patch('update-wallet/:userId')
    async updateWalletAmount(
        @Param('userId') id: string,
        @Body('amount') amount: number,
    ) {
        return this.cusomerservice.UpdateWalletAmount(id, amount);
    }

    @Patch('cancel-subscription/:subscriptionId')
    async cancelSubscription(@Param('subscriptionId') id: string, @Body() dto: CancelSubDto) {
        return this.cusomerservice.CancelSubscription(id, dto);
    }

    @Get('variation/count')
    async getVariationCount(@Query('date') date: string) {
        return this.cusomerservice.getVariationCountByDate(date);
    }

    @Get("owners/messes")
    async getAllMesses(@Req() req) {
        const userId = req.user?.id;
        console.log('Extracted userId from JWT payload:', userId);
        if (!userId) {
            throw new NotFoundException('User not found in request');
        }

        return this.cusomerservice.getAllMesses(userId);
    }

    @Post('add/mess')
    async addMessToMessAdmin(
        @Body('userId') userId: string,
        @Body('messId') messId: string,
    ) {
        // ✅ Validate inputs
        if (!userId) {
            throw new BadRequestException('userId is required');
        }

        if (!messId) {
            throw new BadRequestException('messId is required');
        }

        // ✅ Call the service function
        return this.cusomerservice.addMessToMessAdmin(userId, messId);
    }

    @Patch('pause-subscription/:subscriptionId')
    async pauseSubscription(@Param('subscriptionId') id: string, @Body() dto: PauseSubDto) {
        return this.cusomerservice.PauseSubscription(id, dto);
    }

    // PATCH /customer/:userId/reset-wallet
    @Patch('reset-wallet/:userId')
    async resetWallet(@Param('userId') userId: string) {
        return this.cusomerservice.ResetWalletAmount(userId);
    }


    @Post('choose/plan')
    async ChoosePlan(
        @Body() dto: choosePlanDto,
        @Req() req
    ) {
        return this.cusomerservice.choosePlan(dto, req.user.id);
    }


    @Patch('cancel/subscription')
    async CancelUserSubscription(
        @Body() dto: CancelSubDto,
        @Req() req

    ) {
        return this.cusomerservice.CancelUserSubscription(dto, req.user.id);
    }


    @Patch('pause/subscription')
    async PauseSubscription(
        @Body() dto: PauseSubDto,
        @Req() req
    ) {
        return this.cusomerservice.PauseUserSubscription(dto, req.user.id);
    }
} 
