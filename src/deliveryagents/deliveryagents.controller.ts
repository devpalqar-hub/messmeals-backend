import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DeliveryAgentService } from './deliveryagents.service';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { DeliveryStatus } from '@prisma/client';

@Controller('delivery-agent')
export class DeliveryAgentController {
    constructor(private readonly service: DeliveryAgentService) { }

    @Post()
    create(@Body() dto: DeliveryAgentCreateDto) {
        return this.service.create(dto);
    }

    @Get()
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('messId') messId?: string,
    ) {
        return this.service.findAll(page, limit, search, messId);
    }



    @Get(':id')
    getById(@Param('id') id: string) {
        return this.service.getById(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: DeliveryAgentUpdateDto) {
        return this.service.updateDeliveryAgent(id, dto);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(id);
    }



    @UseGuards(JwtAuthGuard)
    @Patch('toggle/on/off')
    toggleOnlineOffline(@Body('is_online') is_online: boolean, @Req() req) {
        return this.service.toggleOnlineOffline(is_online, req.user.id);
    }

    @UseGuards(JwtAuthGuard)  // Optional based on your setup
    @Get('stats')
    async getDeliveryStats(
        @Req() req,
    ) {
        return this.service.DeliveryStats(req.user.id);

    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    async getDeliveryAgentProfile(
        @Req() req,
    ) {
        return this.service.getDeliveryAgentProfile(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my/deliveries')
    async myDeliveries(
        @Req() req,
        @Query('status') status?: DeliveryStatus,
    ) {
        const userId = req.user.id; // assuming JWT adds { user: { id } }

        return this.service.myDeliveries(userId, status);
    }

    @UseGuards(JwtAuthGuard)
    @Get('active/orders')
    async activeOrders(@Req() req) {
        const userId = req.user.id;
        return this.service.activeOrders(userId);
    }
}
