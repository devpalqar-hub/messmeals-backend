import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Param,
    Body, Query,
    ParseUUIDPipe,
} from '@nestjs/common';
import { DeliveriesService } from './deliveries.service';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { AssignDeliveryPartnerDto } from './dto/assign-partner.dto';
import { DeliveryStatus } from '@prisma/client';

@Controller('deliveries')
export class DeliveriesController {
    constructor(private readonly deliveriesService: DeliveriesService) { }

    // ✅ POST - Create Delivery
    @Post()
    create(@Body() dto: CreateDeliveryDto) {
        return this.deliveriesService.create(dto);
    }

    // ✅ GET all
    @Get()
    findAll(
        @Query('page') page?: number,
        @Query('limit') limit?: number,
        @Query('status') status?: DeliveryStatus,
    ) {
        return this.deliveriesService.findAll({ page, limit, status });
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

}
