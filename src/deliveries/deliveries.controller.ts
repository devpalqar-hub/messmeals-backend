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
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AssignDeliveryPartnerDto, AssignDeliveryPartnerPhs2Dto, AssignDeliveryPartnerToDeliveriesDto } from './dto/assign-partner.dto';
import { DeliveryStatus, Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('deliveries')
export class DeliveriesController {
    constructor(private readonly deliveriesService: DeliveriesService) { }

    // ✅ POST - Create Delivery
    @Post()
    create(@Body() dto: CreateDeliveryDto) {
        return this.deliveriesService.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.DELIVERYAGENT, Role.MESSADMIN, Role.SUPERADMIN, Role.USER)
    @Get()
    findAll(
        @Req() req: any,
        @Query('page') page?: number | string,
        @Query('limit') limit?: number | string,
        @Query('status') status?: DeliveryStatus,
        @Query('date') date?: string,
        @Query('messId') messId?: string,
        @Query('partnerId') partnerId?: string,
    ) {
        return this.deliveriesService.findAll(
            { page, limit, status, date, messId, partnerId },
            req.user,
        );
    }

    // ✅ GET by ID
    @Get(':id')
    findOne(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.deliveriesService.findOne(id);
    }

    // ✅ PATCH - Update
    @Patch(':id')
    update(
        @Param('id', new ParseUUIDPipe()) id: string,
        @Body() dto: UpdateDeliveryDto,
    ) {
        return this.deliveriesService.update(id, dto);
    }

    // ✅ DELETE
    @Delete(':id')
    remove(@Param('id', new ParseUUIDPipe()) id: string) {
        return this.deliveriesService.remove(id);
    }

    @Patch(":id/status")
    updateStatus(@Param('id') id: string, @Body() updatestatusdto: UpdateDeliveryStatusDto) {
        return this.deliveriesService.updateStatus(id, updatestatusdto)
    }

    @Patch(":id/partner")
    updatePartner(@Param('id') id: string, @Body() updatestatusdto: AssignDeliveryPartnerDto) {
        return this.deliveriesService.updatePartner(id, updatestatusdto)
    }

    @Post('create-by-date')
    async createDeliveries(@Body('date') date: string) {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            throw new Error('Invalid date format');
        }
        return this.deliveriesService.createDeliveriesForDate(parsedDate);
    }

    @Get('recent-deliveries-partner/:id')
    async getRecentDeliveries(@Param('id', new ParseUUIDPipe()) customerId: string,
        @Query('messId') messId?: string,
        @Query('limit') limit?: number,) {
        return this.deliveriesService.PartnerRecentDeliveries(customerId, limit, messId);

    }
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
    @Patch("assign/partner/subscription")
    AssignPartner(@Param('id') id: string,
        @Body() dto: AssignDeliveryPartnerPhs2Dto,
        @Req() req

    ) {
        return this.deliveriesService.AssignPartner(dto, req.user.id)
    }

    @UseGuards(JwtAuthGuard)
    @Patch('assign/partner/deliveries')
    assignPartnerToDeliveries(
        @Body() dto: AssignDeliveryPartnerToDeliveriesDto,
        @Req() req,
    ) {
        return this.deliveriesService.assignPartnerToDeliveries(dto, req.user.id);
    }
}
