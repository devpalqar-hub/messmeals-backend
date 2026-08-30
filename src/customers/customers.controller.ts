import {
    Body, Controller, Post, Get, Query, Patch, Param,
    DefaultValuePipe, ParseIntPipe, Delete, UseGuards, Req,
    NotFoundException, BadRequestException,
} from '@nestjs/common';
import { CustomerService } from './customers.service';
import { choosePlanDto, CreateCustomerDto, CreateSubscriptionForCustomerDto, UpdateCustomerDto } from './dto/create-customer.dto';
import { RenewSubscriptionDto } from './dto/renew-Subscription.dto';
import { CancelDeliveryDto, CancelSubDto } from './dto/cancel-sub.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PauseSubDto } from './dto/pause-sub.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { ExtendSubscriptionDto } from './dto/extend-subscription.dto';
import { SkipVariationDto } from './dto/skip-variation.dto';
import { Role } from '@prisma/client';
import {
    ApiBearerAuth, ApiBody, ApiOperation, ApiParam,
    ApiQuery, ApiTags,
} from '@nestjs/swagger';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MESSADMIN', 'SUPERADMIN')
@ApiTags('Customers')
@ApiBearerAuth()
@Controller('customer')
export class CustomerController {
    constructor(private readonly cusomerservice: CustomerService) { }

    @Post('register-user')
    @ApiOperation({
        summary: 'Register customer',
        description:
            'Creates a new customer and subscription for the mess that owns `planId`. deliveryPartnerId is optional — ' +
            'a customer can be registered without one and assigned a delivery partner later. If the phone/email is ' +
            'already registered as a customer (e.g. by another mess admin, for a different mess), the existing ' +
            'user/profile is reused and just a new subscription is created for this mess — the same phone number ' +
            'can be a customer of multiple messes. Fails only if the customer already has an active subscription ' +
            'for this exact plan. ' +
            'Monthly plans: totalPrice = number of months (derived from start/end date) × plan.price. ' +
            'Daily plans: totalPrice = chargeable delivery days × plan.price.',
    })
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


    // 🔍 GET /customer/:id
    @Get(':id')
    @ApiOperation({ summary: 'Get customer by id', description: 'Fetches a customer profile by UUID. Active subscriptions include a computed status field (ACTIVE | PAUSED | CANCELLED | INACTIVE).' })
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

    /**
     * PATCH /customer/cancel-subscription/:subscriptionId
     * Cancels delivery for a single selected date only.
     * - Daily plan: refund 1 × plan.price to wallet.
     * - Monthly plan: no wallet refund.
     */
    @Patch('cancel-subscription/:subscriptionId')
    @ApiOperation({
        summary: 'Cancel delivery for a specific date',
        description:
            'Cancels the delivery of the selected date only (not the full subscription). ' +
            'For daily plans, the day\'s price is refunded to the wallet. ' +
            'For monthly plans, no wallet deduction/refund is applied.',
    })
    @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
    async cancelDeliveryForDate(
        @Param('subscriptionId') id: string,
        @Body() dto: CancelDeliveryDto,
    ) {
        return this.cusomerservice.CancelDeliveryForDate(id, dto.date);
    }

    /**
     * PATCH /customer/cancel-full-subscription/:subscriptionId
     * Fully cancels a subscription.
     * - Daily plan: refund remaining days × plan.price.
     * - Monthly plan: no wallet refund.
     */
    @Patch('cancel-full-subscription/:subscriptionId')
    @ApiOperation({
        summary: 'Cancel full subscription',
        description:
            'Fully cancels a subscription and deactivates all future deliveries. ' +
            'For daily plans, remaining days are refunded to the wallet. ' +
            'For monthly plans, no refund is applied.',
    })
    @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
    async cancelFullSubscription(@Param('subscriptionId') id: string) {
        return this.cusomerservice.CancelFullSubscription(id);
    }

    /**
     * GET /customer/subscription/:subscriptionId/deliveries
     * List all deliveries for a subscription with optional filters.
     */
    @Get('subscription/:subscriptionId/deliveries')
    @ApiOperation({
        summary: 'List deliveries for a subscription',
        description: 'Returns all deliveries for a subscription. Supports optional filters by status, date range, and pagination.',
    })
    @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
    @ApiQuery({ name: 'status', required: false, description: 'Filter by delivery status: PENDING | PROGRESS | DELIVERED' })
    @ApiQuery({ name: 'startDate', required: false, description: 'Filter deliveries from this date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'endDate', required: false, description: 'Filter deliveries up to this date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'page', required: false, description: 'Page number (default 1)' })
    @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default 20)' })
    async getDeliveriesForSubscription(
        @Param('subscriptionId') subscriptionId: string,
        @Query('status') status?: string,
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number = 1,
        @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number = 20,
    ) {
        return this.cusomerservice.getDeliveriesForSubscription(
            subscriptionId, status, startDate, endDate, page, limit,
        );
    }

    @Get('variation/count')
    @ApiOperation({ summary: 'Variation count by date', description: 'Returns variation counts for subscriptions active on a given date.' })
    @ApiQuery({ name: 'date', required: true })
    async getVariationCount(@Query('date') date: string) {
        return this.cusomerservice.getVariationCountByDate(date);
    }

    @Get('owners/messes')
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


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Post('choose/plan')
    @ApiOperation({
        summary: 'Book a mess plan',
        description:
            'Customer direct-booking: pick a plan, start/end date (monthly = start date + number of months, ' +
            'daily = start date + end date with optional weekday selection), and a pickup address. ' +
            'Creates a pending subscription and a Razorpay order (successUrl/cancelUrl are echoed back by Razorpay ' +
            'after checkout). Deliveries are generated only once payment succeeds.',
    })
    async ChoosePlan(
        @Body() dto: choosePlanDto,
        @Req() req
    ) {
        return this.cusomerservice.choosePlan(dto, req.user.id);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Post('choose/plan/price')
    @ApiOperation({
        summary: 'Calculate plan price',
        description:
            'Same request body as "Book a mess plan" (choose/plan), but performs no writes — ' +
            'no subscription and no Razorpay order are created. Returns only the calculated price ' +
            'so the frontend can show a quote before the user confirms booking.',
    })
    async CalculatePlanPrice(
        @Body() dto: choosePlanDto,
    ) {
        return this.cusomerservice.calculatePlanPrice(dto);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Get('my/subscriptions')
    @ApiOperation({
        summary: 'List own subscriptions',
        description:
            'Returns the authenticated user\'s own subscriptions, with a computed status ' +
            '(ACTIVE | PAUSED | CANCELLED | INACTIVE). Defaults to active subscriptions only ' +
            '— pass status=all to include paused/cancelled/inactive ones too.',
    })
    @ApiQuery({ name: 'status', required: false, example: 'active', description: '"active" (default) or "all"' })
    async getMySubscriptions(
        @Req() req,
        @Query('status') status?: string,
    ) {
        return this.cusomerservice.getMySubscriptions(req.user.id, status);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Patch('cancel/subscription')
    @ApiOperation({ summary: 'Cancel own subscription', description: 'Cancels the authenticated user subscription, fully or for a date range.' })
    async CancelUserSubscription(
        @Body() dto: CancelSubDto,
        @Req() req

    ) {
        return this.cusomerservice.CancelUserSubscription(dto, req.user.id);
    }


    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Patch('pause/subscription')
    @ApiOperation({
        summary: 'Pause own subscription',
        description:
            'Pauses the authenticated user subscription for a selected date range. ' +
            'Deliveries within the pause window are shifted forward and end_date is extended by the same duration.',
    })
    async PauseSubscription(
        @Body() dto: PauseSubDto,
        @Req() req
    ) {
        return this.cusomerservice.PauseUserSubscription(dto, req.user.id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Patch('extend/subscription')
    @ApiOperation({
        summary: 'Extend own subscription',
        description:
            'Extends the authenticated user subscription to a later end date. Only the incremental days are ' +
            'charged via a new Razorpay order; end_date is pushed and the extra deliveries are created once ' +
            'payment succeeds.',
    })
    async ExtendSubscription(
        @Body() dto: ExtendSubscriptionDto,
        @Req() req,
    ) {
        return this.cusomerservice.ExtendSubscription(dto, req.user.id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Patch('subscription/:subscriptionId/skip-variation')
    @ApiOperation({
        summary: 'Skip one meal on a date',
        description:
            'Skips a single variation (e.g. Lunch only) for one delivery date without cancelling the whole ' +
            'day\'s delivery — for frequency/meal-based plans (Breakfast/Lunch/Dinner).',
    })
    @ApiParam({ name: 'subscriptionId', description: 'Subscription UUID' })
    async skipVariation(
        @Param('subscriptionId') subscriptionId: string,
        @Body() dto: SkipVariationDto,
        @Req() req,
    ) {
        return this.cusomerservice.SkipDeliveryVariation(subscriptionId, dto, req.user.id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.USER)
    @ApiBearerAuth()
    @Patch('complete-profile')
    @ApiOperation({
        summary: 'Complete customer profile',
        description:
            'Filled in right after first OTP verification (see /auth/verify-otp -> isNewUser) to set name, ' +
            'email and an initial pickup address.',
    })
    async completeProfile(
        @Body() dto: CompleteProfileDto,
        @Req() req,
    ) {
        return this.cusomerservice.completeProfile(req.user.id, dto);
    }


    /**
     * POST /customer/subscription/create
     * Admin endpoint to create a new subscription for an existing customer.
     * Pricing:
     *   - Monthly plan  → numMonths × plan.price
     *   - Daily plan    → chargeableDays × plan.price
     * Deliveries are auto-generated based on the delivery schedule.
     */
    @Post('subscription/create')
    @ApiOperation({
        summary: 'Create subscription for existing customer',
        description:
            'Creates a new subscription for an existing customer. ' +
            'Monthly plans: totalPrice = number of months (derived from start/end date) × plan.price. ' +
            'Daily plans: totalPrice = chargeable delivery days × plan.price. ' +
            'Wallet is debited by discountedPrice. Deliveries are auto-created based on the schedule.',
    })
    async createSubscription(@Body() dto: CreateSubscriptionForCustomerDto) {
        return this.cusomerservice.createSubscriptionForCustomer(dto);
    }
}
