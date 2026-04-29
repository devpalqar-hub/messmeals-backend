import { Body, Controller, DefaultValuePipe, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { DeliveryAgentService } from './deliveryagents.service';
import { DeliveryAgentCreateDto, DeliveryAgentUpdateDto } from './dto/deliveryagents-create.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DeliveryStatus, Role } from '@prisma/client';
import { AssignDeliveryAgentDto } from './dto/assign-delivery-agent.dto';
import { UpdateDeliveryStatusDto } from './dto/update-delivery-status.dto';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Delivery Agents')
@ApiBearerAuth()
@Controller('delivery-agent')
export class DeliveryAgentController {
    constructor(private readonly service: DeliveryAgentService) { }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Create delivery agent', description: 'Creates a delivery agent record.' })
    @ApiResponse({ status: 201, description: 'Delivery agent created successfully.' })
    @Post()
    create(@Body() dto: DeliveryAgentCreateDto) {
        return this.service.create(dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'List delivery agents', description: 'Returns paginated delivery agents with optional filters.' })
    @ApiQuery({ name: 'page', required: false, example: 1 })
    @ApiQuery({ name: 'limit', required: false, example: 10 })
    @ApiQuery({ name: 'search', required: false })
    @ApiQuery({ name: 'messId', required: false })
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
    @ApiOperation({ summary: 'Get delivery agent by id', description: 'Fetches a delivery agent by UUID.' })
    @ApiParam({ name: 'id', description: 'Delivery agent UUID' })
    @Get(':id')
    getById(@Param('id') id: string) {
        return this.service.getById(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Update delivery agent', description: 'Updates a delivery agent by UUID.' })
    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: DeliveryAgentUpdateDto) {
        return this.service.updateDeliveryAgent(id, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Delete delivery agent', description: 'Deletes a delivery agent by UUID.' })
    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(Role.SUPERADMIN, Role.MESSADMIN)
    @ApiOperation({ summary: 'Assign delivery agent to mess', description: 'Assigns or reassigns a delivery agent to a mess.' })
    @Post('assign-delivery-agent-to-mess')
    async assignDeliveryAgentToMess(@Body() dto: AssignDeliveryAgentDto) {
        return this.service.assignDeliveryAgentToMess(dto.agentId, dto.messId);
    }



    // -------------------------------------------------------
    // PHASE 3
    // -------------------------------------------------------
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Toggle online/offline', description: 'Marks the authenticated delivery agent online or offline.' })
    @Patch('toggle/on/off')
    toggleOnlineOffline(@Body('is_online') is_online: boolean, @Req() req) {
        return this.service.toggleOnlineOffline(is_online, req.user.id);
    }


    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get delivery agent stats', description: 'Returns delivery stats for the authenticated delivery agent.' })
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
    @ApiOperation({ summary: 'Get delivery agent profile', description: 'Returns the authenticated delivery agent profile.' })
    @Get('get/profile/')
    async getDeliveryAgentProfile(
        @Req() req,
    ) {
        return this.service.getDeliveryAgentProfile(req.user.id);
    }


    @Get('my/deliveries')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'List my deliveries', description: 'Returns deliveries assigned to the authenticated delivery agent.' })
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
    @ApiOperation({ summary: 'Get active orders', description: 'Returns active orders for the authenticated delivery agent.' })
    @Get('active/orders')
    async activeOrders(@Req() req) {
        const userId = req.user.id;
        return this.service.activeOrders(userId);
    }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Update delivery status', description: 'Updates a delivery status for the authenticated delivery agent.' })
    @Put('update/status')
    async updateStatus(
        @Req() req,
        @Body() dto: UpdateDeliveryStatusDto,
    ) {
        const userId = req.user.id; // from auth token
        return this.service.updateDeliveryStatus(userId, dto);
    }

    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Get delivery by id', description: 'Returns a delivery by UUID for the authenticated delivery agent.' })
    @Get('my/deliveries/:deliveryId')
    async getDeliveryById(
        @Req() req,
        @Param('deliveryId') deliveryId: string,
    ) {
        const userId = req.user.id; // Extract from JWT token
        return this.service.getDeliveryById(userId, deliveryId);
    }
}
