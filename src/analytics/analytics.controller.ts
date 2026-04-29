import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ValidationPipe } from '@nestjs/common';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN, Role.MESSADMIN)
export class AnalyticsController {
    constructor(private readonly service: AnalyticsService) { }

    @Get('revenue/summary')
    async revenueSummary(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto) {
        // support restaurantId alias
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };
        return this.service.revenueSummary(payload);
    }

    @Get('revenue/graph')
    async revenueGraph(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto) {
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };
        return this.service.revenueGraph(payload);
    }

    @Get('orders/graph')
    async ordersGraph(@Query(new ValidationPipe({ transform: true })) query: AnalyticsQueryDto) {
        const { restaurantId, ...rest } = query as any;
        const payload = { ...rest, messId: rest.messId || restaurantId };
        return this.service.orderStatsGraph(payload);
    }

    @Get('delivery-agent/graph')
    @Roles(Role.DELIVERYAGENT, Role.SUPERADMIN, Role.MESSADMIN)
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
