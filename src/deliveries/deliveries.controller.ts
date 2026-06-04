import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Body, Query,
    ParseUUIDPipe,
    Req,
    UseGuards,
} from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryStatusDto, UpdateDeliveryOwnerStatusDto } from './dto/update-delivery-status.dto';
import { UpdateVariationStatusDto } from './dto/update-variation-status.dto';
import { AssignDeliveryPartnerDto, AssignDeliveryPartnerPhs2Dto, AssignDeliveryPartnerToDeliveriesDto } from './dto/assign-partner.dto';
import { DeliveryStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Deliveries')
@ApiBearerAuth()
@Controller('deliveries')
export class DeliveriesController {
    constructor(private readonly deliveriesService: DeliveriesService) { }

    // ✅ POST - Create Delivery
    @ApiOperation({ summary: 'Create delivery', description: 'Creates a new delivery record.' })
    @ApiResponse({ status: 201, description: 'Delivery created successfully.' })
    @Post()
    create(@Body() dto: CreateDeliveryDto) {
        return this.deliveriesService.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.DELIVERYAGENT, Role.MESSADMIN, Role.SUPERADMIN, Role.USER)
    @ApiOperation({ summary: 'List deliveries', description: 'Returns deliveries with filters. Each delivery includes its variation statuses (e.g. Breakfast, Lunch, Dinner).' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'status', required: false })
    @ApiQuery({ name: 'date', required: false, description: 'Filter by exact date (YYYY-MM-DD)' })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'partnerId', required: false })
    @ApiQuery({ name: 'variationId', required: false, description: 'Filter deliveries that include this variation (e.g. Breakfast variation ID)' })
    @Get()
    findAll(
        @Req() req: any,
        @Query('page') page?: number | string,
        @Query('limit') limit?: number | string,
        @Query('status') status?: DeliveryStatus,
        @Query('date') date?: string,
        @Query('messId') messId?: string,
        @Query('partnerId') partnerId?: string,
        @Query('variationId') variationId?: string,
    ) {
        return this.deliveriesService.findAll(
            { page, limit, status, date, messId, partnerId, variationId },
            req.user,
        );
    }

    // ✅ GET by ID
    @ApiOperation({ summary: 'Get delivery by id', description: 'Fetches a delivery by UUID.' })
    @ApiParam({ name: 'id', description: 'Delivery UUID' })
    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.deliveriesService.findOne(id);
    }

    // ✅ PATCH - Update
    @ApiOperation({ summary: 'Update delivery', description: 'Updates an existing delivery by UUID.' })
    @ApiParam({ name: 'id', description: 'Delivery UUID' })
    @Patch(':id')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateDeliveryDto,
    ) {
        return this.deliveriesService.update(id, dto);
    }

    // ✅ DELETE
    @ApiOperation({ summary: 'Delete delivery', description: 'Deletes a delivery by UUID.' })
    @ApiParam({ name: 'id', description: 'Delivery UUID' })
    @Delete(':id')
    remove(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.deliveriesService.remove(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.MESSADMIN, Role.SUPERADMIN, Role.DELIVERYAGENT)
    @ApiOperation({ summary: 'Update delivery status', description: 'Updates the status of a delivery by UUID.' })
    @Patch(':id/status')
    updateStatus(@Param('id') id: string, @Body() updatestatusdto: UpdateDeliveryStatusDto) {
        return this.deliveriesService.updateStatus(id, updatestatusdto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.MESSADMIN, Role.SUPERADMIN)
    @ApiOperation({
        summary: 'Owner: mark delivery COMPLETED or UNDELIVERED',
        description:
            'Allows mess admin or superadmin to set the final outcome of a delivery. ' +
            'Status must be COMPLETED or UNDELIVERED. ' +
            'Mess admins can only update deliveries belonging to their mess.',
    })
    @Patch(':id/owner-status')
    updateOwnerStatus(
        @Param('id') id: string,
        @Body() dto: UpdateDeliveryOwnerStatusDto,
        @Req() req,
    ) {
        // SUPERADMIN bypasses the mess-admin check by passing a flag
        if (req.user?.role === Role.SUPERADMIN) {
            return this.deliveriesService.updateStatus(id, { status: dto.status });
        }
        return this.deliveriesService.updateOwnerStatus(id, dto, req.user.id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.MESSADMIN, Role.SUPERADMIN, Role.DELIVERYAGENT)
    @ApiOperation({
        summary: 'Update a single variation status within a delivery',
        description:
            'Allows mess admin or the assigned delivery partner to update the status of one variation ' +
            '(e.g. Breakfast, Lunch, Dinner) within a delivery. ' +
            'Valid statuses: PENDING, DELIVERED, COMPLETED, UNDELIVERED.',
    })
    @ApiParam({ name: 'id', description: 'Delivery UUID' })
    @ApiParam({ name: 'variationId', description: 'Variation UUID (e.g. Breakfast variation ID)' })
    @Patch(':id/variations/:variationId/status')
    updateVariationStatus(
        @Param('id') id: string,
        @Param('variationId') variationId: string,
        @Body() dto: UpdateVariationStatusDto,
        @Req() req,
    ) {
        return this.deliveriesService.updateVariationStatus(id, variationId, dto, req.user.id);
    }

    @ApiOperation({ summary: 'Update delivery partner', description: 'Updates the assigned delivery partner for a delivery.' })
    @Patch(':id/partner')
    updatePartner(@Param('id') id: string, @Body() updatestatusdto: AssignDeliveryPartnerDto) {
        return this.deliveriesService.updatePartner(id, updatestatusdto);
    }

    @ApiOperation({ summary: 'Create deliveries for a date', description: 'Generates deliveries for a provided date.' })
    @ApiBody({
        schema: {
            type: 'object',
            properties: {
                date: { type: 'string', example: '2026-05-07' },
            },
            required: ['date'],
        },
    })
    @Post('create-by-date')
    async createDeliveries(@Body('date') date: string) {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            throw new Error('Invalid date format');
        }
        return this.deliveriesService.createDeliveriesForDate(parsedDate);
    }

    @ApiOperation({ summary: 'Get recent partner deliveries', description: 'Returns the recent deliveries for a partner.' })
    @ApiParam({ name: 'id', description: 'Partner UUID' })
    @Get('recent-deliveries-partner/:id')
    async getRecentDeliveries(@Param('id', new ParseUUIDPipe()) customerId: string,
        @Query('messId') messId?: string,
        @Query('limit') limit?: number,) {
        return this.deliveriesService.PartnerRecentDeliveries(customerId, limit, messId);

    }

    @ApiOperation({ summary: 'Get recent customer deliveries', description: 'Returns the recent deliveries for a customer.' })
    @ApiParam({ name: 'id', description: 'Customer UUID' })
    @Get('recent-deliveries-customer/:id')
    async CustomerRecentDeliveries(
        @Param('id', new ParseUUIDPipe()) customerId: string,
        @Query('messId') messId?: string,
        @Query('limit') limit?: number,
    ) {
        return this.deliveriesService.CustomerRecentDeliveries(customerId, limit, messId);
    }

    // phase 2 api.
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Assign partner to subscription', description: 'Assigns a delivery partner to a subscription.' })
    @Patch("assign/partner/subscription")
    AssignPartner(@Param('id') id: string,
        @Body() dto: AssignDeliveryPartnerPhs2Dto,
        @Req() req

    ) {
        return this.deliveriesService.AssignPartner(dto, req.user.id)
    }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Assign partner to deliveries', description: 'Assigns a delivery partner to deliveries.' })
    @Patch('assign/partner/deliveries')
    assignPartnerToDeliveries(
        @Body() dto: AssignDeliveryPartnerToDeliveriesDto,
        @Req() req,
    ) {
        return this.deliveriesService.assignPartnerToDeliveries(dto, req.user.id);
    }
}
