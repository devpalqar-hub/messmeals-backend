import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/decorators/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ValidationPipe } from '@nestjs/common';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPERADMIN)
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
}
