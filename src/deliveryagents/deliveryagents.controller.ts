import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { DeliveryAgentService } from './deliveryagents.service';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DeliveryStatus, Role } from '@prisma/client';
import { AssignDeliveryAgentDto } from './dto/assign-delivery-agent.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';

@Controller('delivery-agent')
export class DeliveryAgentController {
    constructor(private readonly service: DeliveryAgentService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Post()
    create(@Body() dto: DeliveryAgentCreateDto) {
        return this.service.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Get()
    async findAll(
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
        @Query('search') search?: string,
        @Query('messId') messId?: string,
    ) {
        return this.service.findAll(page, limit, search, messId);
    }



    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Get(':id')
    getById(@Param('id') id: string) {
        return this.service.getById(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: DeliveryAgentUpdateDto) {
        return this.service.updateDeliveryAgent(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @Post('assign-delivery-agent-to-mess')
    async assignDeliveryAgentToMess(@Body() dto: AssignDeliveryAgentDto) {
        return this.service.assignDeliveryAgentToMess(dto.agentId, dto.messId);
    }



    // -------------------------------------------------------
    // PHASE 3
    // -------------------------------------------------------
    @UseGuards(JwtAuthGuard)
    @Patch('toggle/on/off')
    toggleOnlineOffline(@Body('is_online') is_online: boolean, @Req() req) {
        return this.service.toggleOnlineOffline(is_online, req.user.id);
    }


    @UseGuards(JwtAuthGuard)
    @Get('get/stats')
    async getDeliveryStats(
        @Req() req,
        @Query('date1') date1?: string,
        @Query('date2') date2?: string,
        @Query('status') status?: DeliveryStatus,
        @Query('variationId') variationId?: string,
    ) {
        return this.service.DeliveryStats(req.user.id, {
            date1: date1 ? new Date(date1) : undefined,
            date2: date2 ? new Date(date2) : undefined,
            status,
            variationId,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Get('get/profile/')
    async getDeliveryAgentProfile(
        @Req() req,
    ) {
        return this.service.getDeliveryAgentProfile(req.user.id);
    }


    @Get('my/deliveries')
    @UseGuards(JwtAuthGuard)
    async myDeliveries(
        @Req() req,
        @Query('status') status?: DeliveryStatus,
        @Query('date') date?: string,
        @Query('page') page?: number,
        @Query('limit') limit?: number,
    ) {
        return this.service.myDeliveries(
            req.user.id,
            status,
            date,
            Number(page) || 1,
            Number(limit) || 10,
        );
    }


    @UseGuards(JwtAuthGuard)
    @Get('active/orders')
    async activeOrders(@Req() req) {
        const userId = req.user.id;
        return this.service.activeOrders(userId);
    }

    @UseGuards(JwtAuthGuard)
    @Put('update/status')
    async updateStatus(
        @Req() req,
        @Body() dto: UpdateDeliveryStatusDto,
    ) {
        const userId = req.user.id; // from auth token
        return this.service.updateDeliveryStatus(userId, dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('my/deliveries/:deliveryId')
    async getDeliveryById(
        @Req() req,
        @Param('deliveryId') deliveryId: string,
    ) {
        const userId = req.user.id; // Extract from JWT token
        return this.service.getDeliveryById(userId, deliveryId);
    }
}
