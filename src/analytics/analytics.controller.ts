import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ValidationPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.MESSADMIN)
export class AnalyticsController {
    constructor(private readonly service: AnalyticsService) { }

    @Get('revenue/summary')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revenue summary', description: 'Returns total revenue and payment count for the given date range.' })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'ownerId', required: false })
    @ApiQuery({ name: 'variationId', required: false })
    async revenueSummary(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto) {
        // support restaurantId alias
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };
        return this.service.revenueSummary(payload);
    }

    @Get('revenue/graph')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Revenue graph', description: 'Returns a date-bucketed revenue series for line charting.' })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'ownerId', required: false })
    @ApiQuery({ name: 'variationId', required: false })
    async revenueGraph(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto) {
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };
        return this.service.revenueGraph(payload);
    }

    @Get('orders/graph')
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Order statistics graph', description: 'Returns a date-bucketed order count series for line charting.' })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'messId', required: false })
    @ApiQuery({ name: 'ownerId', required: false })
    @ApiQuery({ name: 'variationId', required: false })
    async ordersGraph(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto) {
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };
        return this.service.orderStatsGraph(payload);
    }

    @Get('delivery-agent/graph')
    @Roles(Role.DELIVERYAGENT, Role.SUPERADMIN, Role.MESSADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delivery agent graph', description: 'Returns a date-bucketed delivery count series for a delivery agent dashboard.' })
    @ApiQuery({ name: 'date1', required: true })
    @ApiQuery({ name: 'date2', required: false })
    @ApiQuery({ name: 'agentId', required: false, description: 'Delivery partner UUID or user UUID for admin views.' })
    async deliveryAgentGraph(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto, @Req() req) {
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };

        // If requester is a delivery agent, use their user id to resolve partner profile
        if (req.user?.role === Role.DELIVERYAGENT) {
            payload.agentId = req.user.id;
        }

        return this.service.deliveryAgentGraph(payload);
    }
}
