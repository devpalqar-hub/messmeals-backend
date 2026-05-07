import { Body, Controller, Post, Get, Query, Patch, Param, DefaultValuePipe, ParseIntPipe, Delete, UseGuards, Req, NotFoundException, BadRequestException } from '@nestjs/common';
import { CustomerService } from './customers.service';
import { choosePlanDto, CreateCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { RenewSubscriptionDto } from './dto/renew-Subscription.dto';
import { CancelSubDto } from './dto/cancel-sub.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PauseSubDto } from './dto/pause-sub.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("MESSADMIN", "SUPERADMIN")
@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customer')
export class CustomerController {
    constructor(private readonly cusomerservice: CustomerService) { }

    @Post('register-user')
    @ApiOperation({ summary: 'Register customer', description: 'Creates a new customer and subscription flow record.' })
    async register(@Body() dto: CreateCustomerDto) {
        return this.cusomerservice.CreateUser(dto);
    }

    @Patch(':id')
    @ApiOperation({ summary: 'Update customer', description: 'Updates a customer profile by UUID.' })
    @ApiParam({ name: 'id', description: 'Customer/user UUID' })
    async updateCustomer(
        @Param('id') id: string,
        @Body() dto: UpdateCustomerDto,
    ) {
        return this.cusomerservice.updateCustomerProfile(id, dto);
    }


    @Get()
    @ApiOperation({ summary: 'List customers', description: 'Returns paginated customers with optional search and mess filters.' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'isActive', required: false })
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
    @ApiOperation({ summary: 'Get customer by id', description: 'Fetches a customer profile by UUID.' })
    @ApiParam({ name: 'id', description: 'Customer/user UUID' })
    async findOne(@Param('id') id: string) {
        return this.cusomerservice.findOne(id);
    }

    // 🔹 Delete Customer
    @Delete(':id')
    @ApiOperation({ summary: 'Delete customer', description: 'Deletes a customer and related data by UUID.' })
    @ApiParam({ name: 'id', description: 'Customer/user UUID' })
    async deleteCustomer(@Param('id') id: string) {
        return this.cusomerservice.deleteCustomer(id);
    }


    @Post('renew-subscription')
    @ApiOperation({ summary: 'Renew subscription', description: 'Renews a subscription and adjusts wallet balance.' })
    async renewSubscription(@Body() dto: RenewSubscriptionDto) {
        return this.cusomerservice.RenewSubscription(dto);
    }

    @Patch('update-wallet/:userId')
    @ApiOperation({ summary: 'Update wallet amount', description: 'Adds funds to a customer wallet.' })
    @ApiParam({ name: 'userId', description: 'Customer profile UUID' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                amount: { type: 'number', example: 250 },
            },
            required: ['amount'],
        },
    })
    async updateWalletAmount(
        @Param('userId') id: string,
        @Body('amount') amount: number,
    ) {
        return this.cusomerservice.UpdateWalletAmount(id, amount);
    }

    @Patch('cancel-subscription/:subscriptionId')
    @ApiOperation({ summary: 'Cancel subscription', description: 'Cancels a subscription with refund options.' })
    @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
    async cancelSubscription(@Param('subscriptionId') id: string, @Body() dto: CancelSubDto) {
        return this.cusomerservice.CancelSubscription(id, dto);
    }

    @Get('variation/count')
    @ApiOperation({ summary: 'Variation count by date', description: 'Returns variation counts for subscriptions active on a given date.' })
    @ApiQuery({ name: 'date', required: true })
    async getVariationCount(@Query('date') date: string) {
        return this.cusomerservice.getVariationCountByDate(date);
    }

    @Get("owners/messes")
    @ApiOperation({ summary: 'List owner messes', description: 'Returns messes available to the authenticated user.' })
    async getAllMesses(@Req() req) {
        const userId = req.user?.id;
        console.log('Extracted userId from JWT payload:', userId);
        if (!userId) {
            throw new NotFoundException('User not found in request');
        }

        return this.cusomerservice.getAllMesses(userId);
    }

    @Post('add/mess')
    @ApiOperation({ summary: 'Add mess to mess admin', description: 'Connects a mess to a mess admin account.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                userId: { type: 'string', example: '9b8c7d6e-1234-5678-90ab-cdef12345678' },
                messId: { type: 'string', example: 'c2b7d4af-7c5f-4d4a-9a08-2f2f7d4e3a11' },
            },
            required: ['userId', 'messId'],
        },
    })
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
    @ApiOperation({ summary: 'Pause subscription', description: 'Pauses a subscription for a date range.' })
    @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
    async pauseSubscription(@Param('subscriptionId') id: string, @Body() dto: PauseSubDto) {
        return this.cusomerservice.PauseSubscription(id, dto);
    }

    // PATCH /customer/:userId/reset-wallet
    @Patch('reset-wallet/:userId')
    @ApiOperation({ summary: 'Reset wallet', description: 'Resets a customer wallet to zero.' })
    @ApiParam({ name: 'userId', description: 'Customer profile UUID' })
    async resetWallet(@Param('userId') userId: string) {
        return this.cusomerservice.ResetWalletAmount(userId);
    }


    @Post('choose/plan')
    @ApiOperation({ summary: 'Choose plan', description: 'Creates a subscription payment flow for a chosen plan.' })
    async ChoosePlan(
        @Body() dto: choosePlanDto,
        @Req() req
    ) {
        return this.cusomerservice.choosePlan(dto, req.user.id);
    }


    @Patch('cancel/subscription')
    @ApiOperation({ summary: 'Cancel own subscription', description: 'Cancels the authenticated user subscription.' })
    async CancelUserSubscription(
        @Body() dto: CancelSubDto,
        @Req() req

    ) {
        return this.cusomerservice.CancelUserSubscription(dto, req.user.id);
    }


    @Patch('pause/subscription')
    @ApiOperation({ summary: 'Pause own subscription', description: 'Pauses the authenticated user subscription.' })
    async PauseSubscription(
        @Body() dto: PauseSubDto,
        @Req() req
    ) {
        return this.cusomerservice.PauseUserSubscription(dto, req.user.id);
    }
} 
